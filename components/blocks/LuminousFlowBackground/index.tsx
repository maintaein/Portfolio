'use client';

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type CSSProperties } from 'react';
import { CYAN_PALETTE } from '../Hyperspeed/presets';
import { buildFlowGeometry, normalOffset, type FlowGeometry, type FlowPoint } from './geometry';
import styles from './styles.module.css';

export type LuminousFlowBackgroundProps = {
  className?: string;
  scrollScene?: boolean;
  minimumSceneScreens?: number;
  paused?: boolean;
};

export interface LuminousFlowBackgroundHandle {
  setRevealProgress(progress: number): void;
}

// Speed multipliers relative to the original flow; times are in seconds.
const SCROLL_FLOW = {
  idleSpeed: .5,
  maxSpeed: 3.3,
  fullSpeedScroll: 1800, // Scroll velocity (px/s) that reaches maxSpeed.
  responseTime: .18, // Smaller values respond to scrolling faster.
  decayTime: .3, // Smaller values slow down sooner after scrolling stops.
};

const createCurve = (points: number[][]) => {
  const coordinate = (point: number[]) => point.slice(0, 2).map(value => value.toFixed(3)).join(' ');
  return `M ${coordinate(points[0])}` + points.slice(0, -1).map((point, sample) => {
    const before = points[Math.max(sample - 1, 0)];
    const next = points[sample + 1];
    const after = points[Math.min(sample + 2, points.length - 1)];
    const control1 = point.map((value, axis) => value + (next[axis] - before[axis]) / 6);
    const control2 = next.map((value, axis) => value - (after[axis] - point[axis]) / 6);
    return ` C ${coordinate(control1)} ${coordinate(control2)} ${coordinate(next)}`;
  }).join('');
};

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const rgb = (color: number) => `${color >> 16 & 255} ${color >> 8 & 255} ${color & 255}`;
const palette = {
  background: hex(CYAN_PALETTE.background),
  cyan: hex(CYAN_PALETTE.sticks),
  blue: hex(CYAN_PALETTE.leftCars[1]),
  glow: hex(CYAN_PALETTE.leftCars[2]),
  depth: hex(CYAN_PALETTE.rightCars[2]),
};
// The glow envelope is drawn in document pixels from the same center the strands follow.
const createEnvelope = ({ width, center }: FlowGeometry) => {
  const frames = center.map((point, index) => {
    const before = center[Math.max(index - 1, 0)], after = center[Math.min(index + 1, center.length - 1)];
    const [ax, ay, bx, by] = [point.x - before.x, point.y - before.y, after.x - point.x, after.y - point.y];
    const chord = Math.hypot(ax + bx, ay + by) || 1;
    // Menger curvature of the neighboring samples; zero at the open ends.
    const curvature = 2 * (ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by) * chord || 1);
    return [point.x, point.y, point.halfWidth, -(ay + by) / chord, (ax + bx) / chord, curvature];
  });
  return Array.from({ length: 80 }, (_, layer) => [-1, 1].map(side => frames.map(([x, y, halfWidth, nx, ny, curvature]) => {
    const offset = normalOffset(side * (25 * width / 492 + halfWidth) * (1 - layer / 80), curvature, .65);
    return [x + nx * offset, y + ny * offset];
  })));
};
const envelopePath = ([left, right]: number[][][]) => `${createCurve(left)}${createCurve([...right].reverse()).replace(/^M/, 'L')} Z`;
// The outermost glow edges up to the cut, closed straight across the band where the strands end.
const revealOutline = ([left, right]: number[][][], end: number, t: number) => {
  const edge = (points: number[][]) => [...points.slice(0, end), points[end - 1].map((value, axis) => value + (points[end][axis] - value) * t)];
  return `M ${[...edge(left), ...edge(right).reverse()].map(point => point.join(' ')).join(' L ')} Z`;
};
// The part of a cubic Bezier before parameter t, along one axis (de Casteljau).
const bezierHead = (t: number, a: number, b: number, c: number, d: number) => {
  const ab = a + (b - a) * t, bc = b + (c - b) * t, abc = ab + (bc - ab) * t;
  return [ab, abc, abc + (bc + (c + (d - c) * t - bc) * t - abc) * t];
};

// One color per geometry strand; the renderer owns color, the geometry owns shape.
const colors = [palette.cyan, palette.glow, palette.cyan, palette.blue, palette.depth];
const strandColors = Array.from({ length: 28 }, (_, index) => index % 7 === 0 ? palette.blue : colors[index % colors.length]);
const BEND_HEIGHTS = [219, 710, 1230, 1493, 1792].map(y => y / 2162);

const atoms = Array.from({ length: 48 }, (_, index) => ({
  index,
  strand: (index * 11 + 3) % strandColors.length,
  phase: ((index * .618034 + .07) % 1).toFixed(4),
  duration: 58 + index % 7 * 6,
  radius: .65 + index % 5 * .3,
}));

const LuminousFlowBackground = forwardRef<LuminousFlowBackgroundHandle, LuminousFlowBackgroundProps>(function LuminousFlowBackground({ className, scrollScene = false, minimumSceneScreens = 0, paused = false }, ref) {
  const id = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hazeRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const revealRef = useRef(1);
  const syncMotionRef = useRef<(() => void) | null>(null);
  const requestDrawRef = useRef<(() => void) | null>(null);
  pausedRef.current = paused;
  useEffect(() => { syncMotionRef.current?.(); }, [paused]);
  useImperativeHandle(ref, () => ({
    setRevealProgress(progress: number) {
      revealRef.current = Math.min(1, Math.max(0, progress));
      requestDrawRef.current?.();
    },
  }), []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!root || !canvas || !context) return;
    const rimCanvas = document.createElement('canvas');
    const rim = rimCanvas.getContext('2d');
    if (!rim) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = true;
    let bounds = root.getBoundingClientRect();
    let boundsDirty = true;
    const atmosphere = root.querySelector<SVGSVGElement>('svg');
    let atmosphereTexture: HTMLCanvasElement | null = null;
    let textureVersion = 0;
    let textureUrl: string | null = null;
    const cacheAtmosphere = (width: number, height: number) => {
      if (!atmosphere) return;
      const version = ++textureVersion;
      if (textureUrl) URL.revokeObjectURL(textureUrl);
      const copy = atmosphere.cloneNode(true) as SVGSVGElement;
      copy.removeAttribute('style');
      copy.removeAttribute('class');
      // The texture holds the whole glow; the reveal clips it when drawn.
      copy.querySelector('[data-flow-envelope]')?.removeAttribute('clip-path');
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(width));
      copy.setAttribute('height', String(height));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
      textureUrl = url;
      const image = new Image();
      image.onload = () => {
        if (version !== textureVersion) return;
        const texture = document.createElement('canvas');
        // This layer contains broad glow only; retain the paths without a giant GPU layer.
        const ratio = Math.min(1, Math.sqrt(4e6 / (width * height)));
        texture.width = Math.ceil(width * ratio);
        texture.height = Math.ceil(height * ratio);
        const paint = texture.getContext('2d');
        if (paint) {
          paint.drawImage(image, 0, 0, texture.width, texture.height);
          atmosphereTexture = texture;
          atmosphere.style.visibility = 'hidden';
          requestDraw();
        }
        URL.revokeObjectURL(url);
        if (textureUrl === url) textureUrl = null;
      };
      image.src = url;
    };
    // A scene-space pattern follows the draw transform without recreating a viewport gradient.
    const strandPaints = strandColors.map((color, index) => {
      const texture = document.createElement('canvas');
      texture.width = 1; texture.height = 2162;
      const paint = texture.getContext('2d');
      if (!paint) return color;
      const gradient = paint.createLinearGradient(0, 0, 0, 2162);
      gradient.addColorStop(0, `${color}a6`);
      gradient.addColorStop(.2 + index % 5 * .12, color);
      gradient.addColorStop(1, `${color}bf`);
      paint.fillStyle = gradient;
      paint.fillRect(0, 0, 1, 2162);
      return context.createPattern(texture, 'repeat') ?? color;
    });
    // Rim and particle glows are fixed in design units, so each is built once and moved into place.
    const rimGlow = rim.createRadialGradient(0, 0, 0, 0, 0, 45);
    rimGlow.addColorStop(0, '#fff');
    rimGlow.addColorStop(.3, '#ffffffe6');
    rimGlow.addColorStop(1, '#ffffff00');
    const atomGlows = atoms.map(({ radius }) => {
      const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius * 5);
      [[0, palette.glow], [.12, `${palette.glow}e6`], [.3, `${palette.cyan}61`], [.65, `${palette.blue}14`], [1, `${palette.blue}00`]].forEach(([stop, color]) => glow.addColorStop(Number(stop), String(color)));
      return glow;
    });
    const glowGroup = atmosphere?.querySelector('[data-flow-envelope]');
    const haze = hazeRef.current;
    const revealShape = atmosphere?.querySelector('clipPath path');
    let glowOutline: number[][][] = [];
    let revealClip: Path2D | null = null;
    let appliedReveal = NaN;
    let pausedApplied = pausedRef.current;
    let drawn = false;
    let geometry: FlowGeometry | null = null;
    let bends: FlowPoint[] = [];
    let interpolated: number[][][] = [];
    let cumulativeLengths: Float64Array[] = [];
    let viewportHeight = window.innerHeight;
    let viewportWidth = window.innerWidth;
    let overscan = viewportHeight / 2;
    let pixelRatio = 1;
    const started = performance.now();
    let previousFrame = started;
    let previousScrollTime = started;
    let previousScrollY = window.scrollY;
    let scrollVelocity = 0;
    let flowSpeed = SCROLL_FLOW.idleSpeed;
    let flowTime = 0;
    let sceneTime = 0;

    const resize = () => {
      boundsDirty = true;
      viewportHeight = window.innerHeight;
      viewportWidth = window.innerWidth;
      overscan = viewportHeight / 2;
      const renderHeight = viewportHeight + overscan * 2;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1, Math.sqrt(18e5 / (viewportWidth * renderHeight)));
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${renderHeight}px`;
      const nextWidth = Math.ceil(viewportWidth * pixelRatio);
      const nextHeight = Math.ceil(renderHeight * pixelRatio);
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      requestDraw();
    };
    const updateBounds = () => {
      const measured = root.getBoundingClientRect();
      const next = new DOMRect(measured.left, measured.top, measured.width, Math.max(measured.height, viewportHeight * minimumSceneScreens));
      const sizeChanged = !geometry || next.left !== bounds.left || next.height !== bounds.height || next.width !== bounds.width;
      const positionChanged = sizeChanged || next.top !== bounds.top;
      bounds = next;
      if (positionChanged) {
        // The browser scrolls this raster with the document between animation frames.
        // Redrawing and moving the crop together preserves the same scene coordinates.
        canvas.style.transform = `translate3d(0, ${-bounds.top - overscan}px, 0)`;
      }
      if (sizeChanged) {
        const mobile = viewportWidth <= 600 && !scrollScene;
        // Only a new document or viewport size makes a new shape; scrolling only moves the crop.
        const shape = buildFlowGeometry(bounds.width * (mobile ? 3 : 1), bounds.height * (scrollScene ? 1 : 2162 / 318));
        geometry = shape;
        bends = BEND_HEIGHTS.map(y => shape.center.reduce((nearest, point) => Math.abs(point.y - y * shape.height) < Math.abs(nearest.y - y * shape.height) ? point : nearest));
        interpolated = shape.strands.map(poses => poses[0].map(() => [0, 0]));
        cumulativeLengths = shape.strands.map(poses => new Float64Array(poses[0].length));
        // Keep each strand's color fade spanning the whole scene.
        strandPaints.forEach(paint => { if (typeof paint !== 'string') paint.setTransform({ d: shape.height / shape.width * 492 / 2162 }); });
        // The SVG is a texture source; glow and energy share the document canvas.
        if (atmosphere) {
          atmosphere.setAttribute('viewBox', `0 0 ${shape.width} ${shape.height}`);
          const gradient = atmosphere.querySelector('linearGradient');
          gradient?.setAttribute('y2', String(shape.height));
          if (gradient) gradient.innerHTML = Array.from({ length: 81 }, (_, index) => {
            const emission = Math.min(1, .24 + bends.reduce((sum, { y }) => sum + .76 * Math.exp(-(((index / 80 - y / shape.height) * 2162 / 85) ** 2)), 0));
            return `<stop offset="${index / 80}" stop-color="${palette.glow}" stop-opacity="${emission.toFixed(4)}"/>`;
          }).join('');
          const layers = createEnvelope(shape);
          glowOutline = layers[0];
          appliedReveal = NaN;
          if (glowGroup) glowGroup.innerHTML = layers.map(edges => `<path d="${envelopePath(edges)}" opacity=".025"/>`).join('');
          atmosphere.style.position = 'fixed';
          atmosphere.style.inset = 'auto';
          atmosphere.style.top = '0';
          atmosphere.style.left = `${bounds.left - (mobile ? bounds.width * .8 : 0)}px`;
          atmosphere.style.width = `${shape.width}px`;
          atmosphere.style.height = `${shape.height}px`;
          // A texture of the previous size must not stretch over the new shape.
          atmosphereTexture = null;
          atmosphere.style.visibility = '';
          cacheAtmosphere(shape.width, shape.height);
        }
      }
      if (atmosphere && positionChanged) atmosphere.style.transform = `translate3d(0, ${bounds.top}px, 0)`;
      boundsDirty = false;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    const visibilityObserver = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncMotion();
    });
    visibilityObserver.observe(root);

    const draw = (now: number) => {
      frame = 0;
      drawn = true;
      if (boundsDirty) updateBounds();
      const delta = Math.min(.1, Math.max(0, now - previousFrame) / 1000);
      previousFrame = now;
      if (!media.matches && !pausedRef.current) {
        sceneTime += delta;
        const targetSpeed = SCROLL_FLOW.idleSpeed + (SCROLL_FLOW.maxSpeed - SCROLL_FLOW.idleSpeed)
          * Math.min(1, scrollVelocity / SCROLL_FLOW.fullSpeedScroll);
        const nextSpeed = flowSpeed + (targetSpeed - flowSpeed) * (1 - Math.exp(-delta / SCROLL_FLOW.responseTime));
        // Integrate speed so changing it never jumps the animation phase.
        flowTime += delta * (flowSpeed + nextSpeed) / 2;
        flowSpeed = nextSpeed;
        scrollVelocity *= Math.exp(-delta / SCROLL_FLOW.decayTime);
      }
      const time = media.matches ? 0 : flowTime;
      const bobTime = media.matches ? 0 : sceneTime;
      const mobile = viewportWidth <= 600 && !scrollScene;
      const { width, height, length, center, strands } = geometry!;
      // Stroke widths and dashes keep their design units under a uniform scale, so circles stay round.
      const unit = width / 492;
      const left = bounds.left - (mobile ? bounds.width * .8 : 0);
      const paths: Path2D[] = [];
      const points = interpolated;
      const lengths = cumulativeLengths;
      context.resetTransform();
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio * unit, 0, 0, pixelRatio * unit, pixelRatio * (left - bounds.left), pixelRatio * (bounds.top + overscan));
      context.lineCap = 'round';
      const top = Math.max(0, (-bounds.top - overscan) / unit);
      const bottom = Math.min(height / unit, (viewportHeight + overscan - bounds.top) / unit);
      if (!unit || bottom <= top) return;

      // One cut along the shared center length: strands, particles and glow end in the same segment.
      const reveal = revealRef.current;
      const cut = reveal * length;
      const end = reveal < 1 ? center.findIndex(point => point.s > cut) : center.length;
      const partial = end < center.length ? (cut - center[end - 1].s) / (center[end].s - center[end - 1].s) : 1;
      if (appliedReveal !== reveal) {
        appliedReveal = reveal;
        const outline = reveal < 1 ? revealOutline(glowOutline, end, partial) : null;
        revealClip = outline ? new Path2D(outline) : null;
        // The live SVG shows until the texture loads, so it takes the same cut.
        revealShape?.setAttribute('d', outline ?? '');
        if (outline) glowGroup?.setAttribute('clip-path', `url(#${id}-reveal)`);
        else glowGroup?.removeAttribute('clip-path');
        // The source haze is glow too: hidden at 0, untouched at 1.
        if (haze) haze.style.opacity = reveal < 1 ? String(reveal) : '';
      }

      if (atmosphereTexture && cut) {
        context.save();
        // The texture and its reveal outline are in document pixels.
        context.scale(1 / unit, 1 / unit);
        if (revealClip) context.clip(revealClip);
        context.globalAlpha = 1;
        context.drawImage(atmosphereTexture, 0, 0, width, height);
        context.restore();
      }

      strands.forEach((poses, index) => {
        const blue = index % 7 === 0;
        const pose = (time / (8 + index % 5 * 1.5) % 1) * 16;
        const first = Math.floor(pose), fraction = pose - first;
        // The last pose blends back into the first, the same object, so the seam matches exactly.
        const from = poses[first], to = poses[(first + 1) % poses.length];
        const current = interpolated[index];
        for (let sample = 0; sample < current.length; sample++) {
          current[sample][0] = (from[sample].x + (to[sample].x - from[sample].x) * fraction) / unit;
          current[sample][1] = (from[sample].y + (to[sample].y - from[sample].y) * fraction) / unit;
        }
        let total = 0;
        const cumulative = cumulativeLengths[index];
        for (let sample = 0; sample < current.length; sample++) {
          if (sample) total += Math.hypot(current[sample][0] - current[sample - 1][0], current[sample][1] - current[sample - 1][1]);
          cumulative[sample] = total;
        }
        let skippedLength = 0;
        const path = new Path2D();
        // Skip segments far outside the viewport, including their glow radius.
        let connected = false;
        current.slice(0, -1).forEach((point, sample) => {
          const before = current[Math.max(sample - 1, 0)];
          const next = current[sample + 1];
          const after = current[Math.min(sample + 2, current.length - 1)];
          const portion = sample < end - 1 ? 1 : sample === end - 1 ? partial : 0;
          if (!portion || Math.max(point[1], next[1]) < top - 50 || Math.min(point[1], next[1]) > bottom + 50) {
            connected = false;
            return;
          }
          if (!connected) {
            path.moveTo(point[0], point[1]);
            skippedLength = cumulative[sample];
          }
          if (portion < 1) {
            const [x, y] = [0, 1].map(axis => bezierHead(portion, point[axis], point[axis] + (next[axis] - before[axis]) / 6,
              next[axis] - (after[axis] - point[axis]) / 6, next[axis]));
            path.bezierCurveTo(x[0], y[0], x[1], y[1], x[2], y[2]);
          } else path.bezierCurveTo(point[0] + (next[0] - before[0]) / 6, point[1] + (next[1] - before[1]) / 6,
            next[0] - (after[0] - point[0]) / 6, next[1] - (after[1] - point[1]) / 6, next[0], next[1]);
          connected = true;
        });
        paths.push(path);
        context.strokeStyle = strandPaints[index];
        const strength = .8 + index % 6 * .16;
        const coreWidth = .17 + index % 5 * .075;
        context.setLineDash([]);
        [[13, .023 * strength], [2 + coreWidth * 5, .13 * strength], [coreWidth, .48 * strength]].forEach(([strokeWidth, opacity]) => {
          context.lineWidth = strokeWidth;
          context.globalAlpha = opacity;
          context.stroke(path);
        });
        context.lineWidth = (index + 1) % 4 === 0 ? .75 : .48;
        context.globalAlpha = (index + 1) % 3 === 0 ? .38 : .85;
        context.setLineDash([34, 7, 9, 230]);
        context.lineDashOffset = skippedLength - (time + index * .137) * 280 / ((index + 1) % 3 === 0 ? 1.65 : 2.2);
        context.stroke(path);
        context.strokeStyle = blue ? palette.cyan : palette.glow;
        context.lineWidth = .65;
        context.globalAlpha = media.matches ? .18 : .48;
        context.setLineDash([.6, 69.4]);
        context.lineDashOffset = skippedLength - (time + index * .081) * 70 / .7;
        context.stroke(path);
      });

      // Each bend mask gets a small local surface rather than a full-scene texture.
      const combinedPath = new Path2D();
      paths.forEach(path => combinedPath.addPath(path));
      bends.map(bend => [bend.x / unit, bend.y / unit]).filter(([, y]) => y + 38 >= top && y - 38 <= bottom).forEach(([x, y]) => {
        const rimWidth = Math.ceil(90 * unit * pixelRatio);
        const rimHeight = Math.ceil(76 * unit * pixelRatio);
        if (rimCanvas.width !== rimWidth) rimCanvas.width = rimWidth;
        if (rimCanvas.height !== rimHeight) rimCanvas.height = rimHeight;
        rim.resetTransform();
        rim.clearRect(0, 0, rimCanvas.width, rimCanvas.height);
        rim.setTransform(rimWidth / 90, 0, 0, rimHeight / 76, -(x - 45) * rimWidth / 90, -(y - 38) * rimHeight / 76);
        rim.globalCompositeOperation = 'source-over';
        rim.strokeStyle = palette.glow;
        rim.lineWidth = 1.1;
        rim.lineCap = 'round';
        rim.stroke(combinedPath);
        rim.globalCompositeOperation = 'destination-in';
        rim.translate(x, y);
        rim.scale(1, 38 / 45);
        rim.fillStyle = rimGlow;
        rim.fillRect(-700, -4000, 1400, 8000);
        context.globalAlpha = 1;
        context.drawImage(rimCanvas, x - 45, y - 38, 90, 76);
      });
      context.setLineDash([]);
      context.lineDashOffset = 0;
      atoms.forEach(({ index, strand, phase, duration, radius }) => {
        const progress = (Number(phase) + time / duration) % 1;
        const cumulative = lengths[strand];
        const travel = progress * cumulative[cumulative.length - 1];
        let sample = cumulative.findIndex(value => value >= travel);
        sample = Math.max(1, sample);
        const mix = (travel - cumulative[sample - 1]) / (cumulative[sample] - cumulative[sample - 1]);
        const path = points[strand];
        const bob = media.matches ? 0 : (1 - Math.cos((bobTime + index * .37) * Math.PI / (1.8 + index % 5 * .45))) / 2;
        const x = path[sample - 1][0] + (path[sample][0] - path[sample - 1][0]) * mix + (-4 + index % 5 * 2) * bob;
        const y = path[sample - 1][1] + (path[sample][1] - path[sample - 1][1]) * mix + (-5 - index % 4 * 2) * bob;
        const s = center[sample - 1].s + (center[sample].s - center[sample - 1].s) * mix;
        if (y < top - 15 || y > bottom + 15 || reveal < 1 && s >= cut) return;
        context.globalAlpha = .4 + index % 4 * .14;
        context.translate(x, y);
        context.fillStyle = atomGlows[index];
        context.beginPath(); context.arc(0, 0, radius * 5, 0, Math.PI * 2); context.fill();
        context.strokeStyle = palette.glow; context.lineWidth = .22;
        context.globalAlpha *= .45;
        context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.stroke();
        context.globalAlpha = .4 + index % 4 * .14;
        context.fillStyle = palette.glow;
        context.beginPath(); context.arc(0, 0, radius * .35, 0, Math.PI * 2); context.fill();
        context.translate(-x, -y);
      });
      if (!pausedRef.current && !media.matches && !document.hidden && visible) frame = requestAnimationFrame(draw);
    };
    // One frame for layout, texture or reveal changes; the loop itself reschedules only while running.
    const requestDraw = () => {
      if (!frame && !document.hidden && visible) frame = requestAnimationFrame(draw);
    };
    const syncMotion = () => {
      const pausing = pausedRef.current && !pausedApplied;
      pausedApplied = pausedRef.current;
      cancelAnimationFrame(frame);
      frame = 0;
      // Resuming measures from now, so the phase continues from where it stopped.
      previousFrame = performance.now();
      previousScrollTime = previousFrame;
      previousScrollY = window.scrollY;
      if (pausedRef.current || media.matches || document.hidden || !visible) {
        scrollVelocity = 0;
        flowSpeed = SCROLL_FLOW.idleSpeed;
      }
      // A pause keeps the last frame on screen instead of drawing another.
      if (!pausing || !drawn) requestDraw();
    };
    const onScroll = () => {
      const now = performance.now();
      const elapsed = Math.max(16, Math.min(100, now - previousScrollTime));
      scrollVelocity = Math.min(SCROLL_FLOW.fullSpeedScroll, Math.abs(window.scrollY - previousScrollY) / elapsed * 1000);
      previousScrollY = window.scrollY;
      previousScrollTime = now;
      boundsDirty = true;
      if (media.matches) syncMotion();
    };
    syncMotionRef.current = syncMotion;
    requestDrawRef.current = requestDraw;
    let previousWheelTime = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || pausedRef.current || media.matches || !visible) return;
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
      const elapsed = Math.max(16, Math.min(100, event.timeStamp - previousWheelTime));
      previousWheelTime = event.timeStamp;
      scrollVelocity = Math.max(scrollVelocity, Math.min(SCROLL_FLOW.fullSpeedScroll, Math.abs(event.deltaY * units) / elapsed * 1000));
    };
    resize();
    syncMotion();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    media.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    return () => {
      syncMotionRef.current = null;
      requestDrawRef.current = null;
      textureVersion++;
      if (textureUrl) URL.revokeObjectURL(textureUrl);
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      media.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncMotion);
    };
  }, [id, scrollScene, minimumSceneScreens]);

  return (
    <div ref={rootRef} className={[styles.background, scrollScene && styles.scrollScene, className].filter(Boolean).join(' ')} style={{
      '--flow-background': palette.background,
      '--flow-color': palette.cyan,
      '--flow-blue': palette.blue,
      '--flow-glow': palette.glow,
      '--flow-rgb': rgb(CYAN_PALETTE.sticks),
      '--flow-blue-rgb': rgb(CYAN_PALETTE.leftCars[1]),
      '--flow-glow-rgb': rgb(CYAN_PALETTE.leftCars[2]),
    } as CSSProperties} aria-hidden="true">
      <div ref={hazeRef} className={styles.sourceHaze} />
      {/* Paths and stops are written from the measured geometry; React owns only the empty shells. */}
      <svg className={`${styles.flow} ${styles.atmosphere}`} focusable="false">
        <defs>
          <linearGradient id={`${id}-envelope`} x1="0" y1="0" x2="0" gradientUnits="userSpaceOnUse" />
          <clipPath id={`${id}-reveal`}><path /></clipPath>
        </defs>
        <g data-flow-envelope="" fill={`url(#${id}-envelope)`} opacity=".45" />
      </svg>
      <canvas ref={canvasRef} className={styles.motionCanvas} />
      <div className={styles.grain} />
    </div>
  );
});

export default LuminousFlowBackground;
