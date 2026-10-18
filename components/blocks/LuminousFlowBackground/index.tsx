'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { CYAN_PALETTE } from '../Hyperspeed/presets';
import styles from './styles.module.css';

type LuminousFlowBackgroundProps = {
  className?: string;
  scrollScene?: boolean;
  minimumSceneScreens?: number;
};

// Speed multipliers relative to the original flow; times are in seconds.
const SCROLL_FLOW = {
  idleSpeed: .5,
  maxSpeed: 3.3,
  fullSpeedScroll: 1800, // Scroll velocity (px/s) that reaches maxSpeed.
  responseTime: .18, // Smaller values respond to scrolling faster.
  decayTime: .3, // Smaller values slow down sooner after scrolling stops.
};

// x, y, half-width: broad pools alternate with narrow, luminous turns.
const anchors = [
  [540, -50, 48], [342, 65, 24], [251, 112, 55], [178, 219, 2],
  [282, 267, 37], [390, 410, 67], [295, 535, 23], [85, 635, 76],
  [32, 710, 3], [202, 818, 72], [348, 970, 26], [468, 1130, 65],
  [453, 1230, 4], [249, 1350, 79], [38, 1493, 3], [214, 1602, 58],
  [424, 1715, 24], [463, 1792, 47], [294, 1870, 54], [110, 1860, 20],
  [-40, 1925, 38],
];
const constrictions = [-3, 3, 8, 12, 14, 17, 24];

const centerline = anchors.slice(0, -1).flatMap((anchor, segment) => {
  const previous = anchors[Math.max(segment - 1, 0)];
  const next = anchors[segment + 1];
  const after = anchors[Math.min(segment + 2, anchors.length - 1)];
  return Array.from({ length: segment === anchors.length - 2 ? 7 : 6 }, (_, step) => {
    const t = step / 6;
    const controls = [previous, anchor, next, after];
    // A cubic B-spline keeps position, tangent and curvature continuous at knots.
    const basis = [(1 - t) ** 3, 3 * t ** 3 - 6 * t * t + 4, -3 * t ** 3 + 3 * t * t + 3 * t + 1, t ** 3];
    const coordinates = [0, 1].map(axis => controls.reduce((sum, point, index) => sum + point[axis] * basis[index] / 6, 0));
    const velocity = [-.5 * (1 - t) ** 2, 1.5 * t * t - 2 * t, -1.5 * t * t + t + .5, .5 * t * t];
    const acceleration = [1 - t, 3 * t - 2, 1 - 3 * t, t];
    const [dx, dy] = [0, 1].map(axis => controls.reduce((sum, point, index) => sum + point[axis] * velocity[index], 0));
    const [ax, ay] = [0, 1].map(axis => controls.reduce((sum, point, index) => sum + point[axis] * acceleration[index], 0));
    const length = Math.hypot(dx, dy);
    const curvature = (dx * ay - dy * ax) / length ** 3;
    // One broad, smooth fan between turns, rather than a bump at every anchor.
    const position = segment + t;
    const interval = constrictions.findIndex((knot, index) => index > 0 && knot >= position);
    const start = constrictions[interval - 1], end = constrictions[interval];
    const progress = (position - start) / (end - start);
    const peak = Math.max(...anchors.slice(Math.max(0, start), Math.min(anchors.length, end + 1)).map(point => point[2])) * 1.35 * Math.min(1, (end - start) / 3);
    const width = 2 + (peak - 2) * 64 * progress ** 3 * (1 - progress) ** 3;
    return [...coordinates, width, -dy / length, dx / length, curvature];
  });
});

let distance = 0;
const distances = centerline.map(([x, y], index) => {
  if (index) distance += Math.hypot(x - centerline[index - 1][0], y - centerline[index - 1][1]);
  return distance;
});

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
const centerlinePath = createCurve(centerline);

// Only the inside of a turn needs a curvature limit; outer branches can fan out.
const normalOffset = (offset: number, curvature: number, limit: number) => offset / Math.sqrt(1 + (Math.max(0, offset * curvature) / limit) ** 2);
const envelopePaths = Array.from({ length: 80 }, (_, layer) => {
  const edges = [-1, 1].map(side => centerline.map(([x, y, width, nx, ny, curvature]) => {
    const offset = normalOffset(side * (25 + width) * (1 - layer / 80), curvature, .65);
    return [x + nx * offset, y + ny * offset];
  }));
  return `${createCurve(edges[0])}${createCurve(edges[1].reverse()).replace(/^M/, 'L')} Z`;
});

const strands = Array.from({ length: 28 }, (_, index) => {
  const phase = index * 2.399963;
  const lane = Math.sin(phase) * .73;
  const createPath = (clock: number) => {
    const points = centerline.map(([x, y, width, nx, ny, curvature], sample) => {
      const travel = distances[sample];
      const wanderingLane = lane + Math.sin(travel * .007 + phase - clock) * .28
        + Math.sin(travel * .003 + phase * .7 + clock) * .18;
      const ripple = (Math.sin(travel * (.014 + index % 5 * .001) + phase - clock * 2) * 3
        + Math.sin(travel * .009 + index * .7 - clock) * 5) * width / 35;
      const offset = normalOffset(wanderingLane * width + ripple, curvature, .2);
      return [x + nx * offset, y + ny * offset];
    });
    return points;
  };
  const poses = Array.from({ length: 16 }, (_, frame) => createPath(frame / 16 * Math.PI * 2));
  // Match the first pose exactly at the seam, including numeric rounding.
  poses.push(poses[0]);
  const blue = index % 7 === 0;
  const colors = [palette.cyan, palette.glow, palette.cyan, palette.blue, palette.depth];
  return { poses, blue, index, color: blue ? palette.blue : colors[index % colors.length] };
});

const bends = [219, 710, 1230, 1493, 1792].map(y => centerline.reduce((nearest, point) => Math.abs(point[1] - y) < Math.abs(nearest[1] - y) ? point : nearest).slice(0, 2));

const atoms = Array.from({ length: 48 }, (_, index) => ({
  index,
  strand: (index * 11 + 3) % strands.length,
  phase: ((index * .618034 + .07) % 1).toFixed(4),
  duration: 58 + index % 7 * 6,
  radius: .65 + index % 5 * .3,
}));

export default function LuminousFlowBackground({ className, scrollScene = false, minimumSceneScreens = 0 }: LuminousFlowBackgroundProps) {
  const id = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
          if (media.matches) syncMotion();
        }
        URL.revokeObjectURL(url);
        if (textureUrl === url) textureUrl = null;
      };
      image.src = url;
    };
    // A scene-space pattern follows the draw transform without recreating a viewport gradient.
    const strandPaints = strands.map(({ index, color }) => {
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
    let atmosphereSized = false;
    const interpolated = strands.map(strand => strand.poses[0].map(point => [...point]));
    const cumulativeLengths = strands.map(strand => new Float64Array(strand.poses[0].length));
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
    const sceneHeight = scrollScene ? 2162 : 318;

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
      if (media.matches) syncMotion();
    };
    const updateBounds = () => {
      const measured = root.getBoundingClientRect();
      const next = new DOMRect(measured.left, measured.top, measured.width, Math.max(measured.height, viewportHeight * minimumSceneScreens));
      const sizeChanged = !atmosphereSized || next.left !== bounds.left || next.height !== bounds.height || next.width !== bounds.width;
      const positionChanged = sizeChanged || next.top !== bounds.top;
      bounds = next;
      if (positionChanged) {
        // The browser scrolls this raster with the document between animation frames.
        // Redrawing and moving the crop together preserves the same scene coordinates.
        canvas.style.transform = `translate3d(0, ${-bounds.top - overscan}px, 0)`;
      }
      // The SVG is a texture source; glow and energy share the document canvas.
      if (atmosphere) {
        if (sizeChanged) {
          const mobile = viewportWidth <= 600 && !scrollScene;
          atmosphere.style.position = 'fixed';
          atmosphere.style.inset = 'auto';
          atmosphere.style.top = '0';
          atmosphere.style.left = `${bounds.left - (mobile ? bounds.width * .8 : 0)}px`;
          atmosphere.style.width = `${bounds.width * (mobile ? 3 : 1)}px`;
          atmosphere.style.height = `${bounds.height}px`;
          cacheAtmosphere(bounds.width * (mobile ? 3 : 1), bounds.height);
          atmosphereSized = true;
        }
        if (positionChanged) atmosphere.style.transform = `translate3d(0, ${bounds.top}px, 0)`;
      }
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
      if (boundsDirty) updateBounds();
      const delta = Math.min(.1, Math.max(0, now - previousFrame) / 1000);
      previousFrame = now;
      if (!media.matches) {
        const targetSpeed = SCROLL_FLOW.idleSpeed + (SCROLL_FLOW.maxSpeed - SCROLL_FLOW.idleSpeed)
          * Math.min(1, scrollVelocity / SCROLL_FLOW.fullSpeedScroll);
        const nextSpeed = flowSpeed + (targetSpeed - flowSpeed) * (1 - Math.exp(-delta / SCROLL_FLOW.responseTime));
        // Integrate speed so changing it never jumps the animation phase.
        flowTime += delta * (flowSpeed + nextSpeed) / 2;
        flowSpeed = nextSpeed;
        scrollVelocity *= Math.exp(-delta / SCROLL_FLOW.decayTime);
      }
      const time = media.matches ? 0 : flowTime;
      const bobTime = Math.max(0, now - started) / 1000;
      const mobile = viewportWidth <= 600 && !scrollScene;
      const scaleX = bounds.width * (mobile ? 3 : 1) / 492;
      const scaleY = bounds.height / sceneHeight;
      const left = bounds.left - (mobile ? bounds.width * .8 : 0);
      const paths: Path2D[] = [];
      const points = interpolated;
      const lengths = cumulativeLengths;
      context.resetTransform();
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio * scaleX, 0, 0, pixelRatio * scaleY, pixelRatio * (left - bounds.left), pixelRatio * (bounds.top + overscan));
      context.lineCap = 'round';
      const top = Math.max(0, (-bounds.top - overscan) / scaleY);
      const bottom = Math.min(sceneHeight, (viewportHeight + overscan - bounds.top) / scaleY);
      if (bottom <= top) return;

      if (atmosphereTexture) {
        context.globalAlpha = 1;
        context.drawImage(atmosphereTexture, 0, 0, 492, sceneHeight);
      }

      strands.forEach(({ poses, index, blue }) => {
        const pose = (time / (8 + index % 5 * 1.5) % 1) * 16;
        const first = Math.floor(pose), fraction = pose - first;
        const current = interpolated[index];
        for (let sample = 0; sample < current.length; sample++) {
          for (let axis = 0; axis < 2; axis++) current[sample][axis] = poses[first][sample][axis]
            + (poses[first + 1][sample][axis] - poses[first][sample][axis]) * fraction;
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
          if (Math.max(point[1], next[1]) < top - 50 || Math.min(point[1], next[1]) > bottom + 50) {
            connected = false;
            return;
          }
          if (!connected) {
            path.moveTo(point[0], point[1]);
            skippedLength = cumulative[sample];
          }
          path.bezierCurveTo(point[0] + (next[0] - before[0]) / 6, point[1] + (next[1] - before[1]) / 6,
            next[0] - (after[0] - point[0]) / 6, next[1] - (after[1] - point[1]) / 6, next[0], next[1]);
          connected = true;
        });
        paths.push(path);
        context.strokeStyle = strandPaints[index];
        const strength = .8 + index % 6 * .16;
        const width = .17 + index % 5 * .075;
        context.setLineDash([]);
        [[13, .023 * strength], [2 + width * 5, .13 * strength], [width, .48 * strength]].forEach(([strokeWidth, opacity]) => {
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
      bends.filter(([, y]) => y + 38 >= top && y - 38 <= bottom).forEach(([x, y]) => {
        const rimWidth = Math.ceil(90 * scaleX * pixelRatio);
        const rimHeight = Math.ceil(76 * scaleY * pixelRatio);
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
        const glow = rim.createRadialGradient(0, 0, 0, 0, 0, 45);
        glow.addColorStop(0, '#fff');
        glow.addColorStop(.3, '#ffffffe6');
        glow.addColorStop(1, '#ffffff00');
        rim.fillStyle = glow;
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
        if (y < top - 15 || y > bottom + 15) return;
        context.globalAlpha = .4 + index % 4 * .14;
        const glow = context.createRadialGradient(x, y, 0, x, y, radius * 5);
        [[0, palette.glow], [.12, `${palette.glow}e6`], [.3, `${palette.cyan}61`], [.65, `${palette.blue}14`], [1, `${palette.blue}00`]].forEach(([stop, color]) => glow.addColorStop(Number(stop), String(color)));
        context.fillStyle = glow;
        context.beginPath(); context.arc(x, y, radius * 5, 0, Math.PI * 2); context.fill();
        context.strokeStyle = palette.glow; context.lineWidth = .22;
        context.globalAlpha *= .45;
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.stroke();
        context.globalAlpha = .4 + index % 4 * .14;
        context.fillStyle = palette.glow;
        context.beginPath(); context.arc(x, y, radius * .35, 0, Math.PI * 2); context.fill();
      });
      if (!media.matches && !document.hidden && visible) frame = requestAnimationFrame(draw);
    };
    const syncMotion = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrame = performance.now();
      previousScrollTime = previousFrame;
      previousScrollY = window.scrollY;
      if (media.matches || document.hidden || !visible) {
        scrollVelocity = 0;
        flowSpeed = SCROLL_FLOW.idleSpeed;
      }
      if (!document.hidden && visible) frame = requestAnimationFrame(draw);
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
    let previousWheelTime = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || media.matches || !visible) return;
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
  }, [scrollScene, minimumSceneScreens]);

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
      <div className={styles.sourceHaze} />
      <svg className={`${styles.flow} ${styles.atmosphere}`} viewBox={`0 0 492 ${scrollScene ? 2162 : 318}`} preserveAspectRatio="none" focusable="false">
        <defs>
          <path id={`${id}-glow-route`} d={centerlinePath} />
          <linearGradient id={`${id}-envelope`} x1="0" y1="0" x2="0" y2="2162" gradientUnits="userSpaceOnUse">
            {Array.from({ length: 81 }, (_, index) => {
              const y = index / 80 * 2162;
              const emission = Math.min(1, .24 + bends.reduce((sum, [, bendY]) => sum + .76 * Math.exp(-(((y - bendY) / 85) ** 2)), 0));
              return <stop key={index} offset={index / 80} stopColor={palette.glow} stopOpacity={emission.toFixed(4)} />;
            })}
          </linearGradient>
        </defs>
        <g data-flow-envelope="" fill={`url(#${id}-envelope)`} opacity=".45">
          {envelopePaths.map((path, index) => <path key={index} d={path} opacity=".025" />)}
        </g>
      </svg>
      <canvas ref={canvasRef} className={styles.motionCanvas} />
      <div className={styles.grain} />
    </div>
  );
}
