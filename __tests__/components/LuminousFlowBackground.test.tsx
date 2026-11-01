import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode, createRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/components/blocks/LuminousFlowBackground/styles.module.css', () => ({ default: {} }));
// The real geometry runs; the spy only shows which shapes the renderer was given.
vi.mock('@/components/blocks/LuminousFlowBackground/geometry', async original => {
  const actual = await original<typeof import('@/components/blocks/LuminousFlowBackground/geometry')>();
  return { ...actual, buildFlowGeometry: vi.fn(actual.buildFlowGeometry) };
});
// The real schedule runs; one test swaps it to grow a single strand.
vi.mock('@/components/blocks/LuminousFlowBackground/entrance', async original => {
  const actual = await original<typeof import('@/components/blocks/LuminousFlowBackground/entrance')>();
  return { ...actual, strandReach: vi.fn(actual.strandReach) };
});
import LuminousFlowBackground, { type LuminousFlowBackgroundHandle } from '@/components/blocks/LuminousFlowBackground';
import { HAZE_FROM, strandReach } from '@/components/blocks/LuminousFlowBackground/entrance';
import { buildFlowGeometry, type FlowGeometry } from '@/components/blocks/LuminousFlowBackground/geometry';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 }); });

type DrawnFrame = { dashes: number[]; paths: number[][][]; arcs: number; clips: number; glow: number; rims: number[][]; dots: number; erases: number[] };
// RAF callback map, fake clock and Canvas/IO mocks. They see frame scheduling, canvas calls and the geometry passed in.
function harness({ reduced = false, rect = { left: 0, top: 0, width: 1200, height: 4000 }, screen = 0 } = {}) {
  // A viewport as tall as the document keeps every segment inside the drawn crop.
  const viewport = (height: number) => Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height || 768 });
  viewport(screen || rect.height);
  const frames = new Map<number, FrameRequestCallback>(); let id = 0; let clock = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.set(++id, callback); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(frame => frames.delete(frame)));
  const observers = new Set<object>();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() { observers.add(this); } disconnect() { observers.delete(this); } });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })));
  const drawn: DrawnFrame[] = [];
  let current: DrawnFrame | undefined;
  vi.stubGlobal('Path2D', class {
    segments: number[][] = [];
    constructor(svg?: string) { if (svg === undefined) current?.paths.push(this.segments); }
    moveTo() {} lineTo() {} addPath() {}
    bezierCurveTo(...args: number[]) { this.segments.push(args); }
  });
  const images: { onload?: () => void }[] = [];
  vi.stubGlobal('Image', class { onload?: () => void; set src(_value: string) { images.push(this); } });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL() {} });
  const gradient = { addColorStop() {} };
  const helpers = (key: string | symbol) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : key === 'createPattern' ? () => ({ setTransform() {} }) : undefined;
  // Only the document canvas is connected; rim, texture and paint canvases are detached.
  // Fills while compositing destination-out record their alpha: they erase the glow front.
  let composite = 'source-over', alpha = 1;
  const main = new Proxy({}, {
    get: (_target, key) => helpers(key) ?? (
      key === 'clearRect' ? () => { current = { dashes: [], paths: [], arcs: 0, clips: 0, glow: 0, rims: [], dots: 0, erases: [] }; drawn.push(current); }
        : key === 'arc' ? () => { current!.arcs++; }
          : key === 'clip' ? () => { current!.clips++; }
            : key === 'fill' ? () => { if (composite === 'destination-out') current!.erases.push(alpha); }
              : key === 'restore' ? () => { composite = 'source-over'; }
                // The glow texture spans the scene; bend rims are 76 units tall; particle dots are stamped from a sprite about 2 units tall.
                : key === 'drawImage' ? (...args: number[]) => { if (args[4] > 1000) current!.glow++; else if (args[4] === 76) current!.rims.push([args[1] + 45, args[2] + 38]); else current!.dots++; }
                  : () => {}),
    set: (_target, key, value) => {
      if (key === 'lineDashOffset') current?.dashes.push(value);
      if (key === 'globalCompositeOperation') composite = value;
      if (key === 'globalAlpha') alpha = value;
      return true;
    },
  });
  // Only the glow texture draws an image on a detached canvas: each strip is a clip rect, then the whole image.
  const strips: number[][] = []; let stripRect: number[] = [];
  const other = new Proxy({}, { get: (_target, key) => helpers(key) ?? (
    key === 'rect' ? (...args: number[]) => { stripRect = args; }
      : key === 'drawImage' ? (...args: number[]) => { strips.push([...stripRect, ...args.slice(1)]); }
        : () => {}) });
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { return (this.isConnected ? main : other) as CanvasRenderingContext2D; });
  let bounds = rect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => bounds as DOMRect);
  const builds = vi.mocked(buildFlowGeometry);
  const built = builds.mock.results.length;
  return {
    frames, drawn, getContext, strips,
    tick: (step = 16) => act(() => { clock += step; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(clock)); }),
    advance: (step: number) => { clock += step; },
    loadImages: () => act(() => { images.splice(0).forEach(image => image.onload?.()); }),
    resizeTo: (next: typeof rect) => { bounds = next; viewport(next.height); act(() => { window.dispatchEvent(new Event('resize')); }); },
    observers,
    shapes: () => builds.mock.results.slice(built).map(result => result.value as FlowGeometry),
    // Strand 0's dash offset is -(flowTime * 280 / 2.2) while its path starts inside the crop.
    phase: () => (0 - drawn.at(-1)!.dashes[0]) * 2.2 / 280,
  };
}
it('preserves its renderer and frame phase across pause/resume and keeps the last frame while paused', () => {
  const frames = new Map<number, FrameRequestCallback>(); let id = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.set(++id, callback); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(frame => frames.delete(frame)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} bezierCurveTo() {} addPath() {} });
  vi.stubGlobal('Image', class { set src(_value: string) {} });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL() {} });
  const gradient = { addColorStop() {} };
  const draw = vi.fn();
  const context = new Proxy({}, { get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : key === 'createPattern' ? () => ({ setTransform() {} }) : key === 'clearRect' ? draw : () => {} });
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1200, height: 4000 } as DOMRect);
  const tick = (time: number) => act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); });
  const { rerender, unmount } = render(<LuminousFlowBackground scrollScene />);
  tick(performance.now() + 16); const contexts = getContext.mock.calls.length;
  expect(frames.size).toBe(1);
  rerender(<LuminousFlowBackground scrollScene paused />); tick(performance.now() + 32);
  expect(frames.size).toBe(0); expect(draw).toHaveBeenCalled(); expect(getContext).toHaveBeenCalledTimes(contexts);
  rerender(<LuminousFlowBackground scrollScene />); tick(performance.now() + 48);
  expect(frames.size).toBe(1); expect(getContext).toHaveBeenCalledTimes(contexts);
  unmount(); expect(frames.size).toBe(0);
});

it('외부 pause 뒤 새 프레임을 예약하지 않고 재개 시 누적 시간을 건너뛰지 않는다', () => {
  const { frames, drawn, tick, advance, phase } = harness();
  const { rerender } = render(<LuminousFlowBackground scrollScene />);
  tick(); tick(); tick();
  const step = .016 * .5; // one 16 ms frame at idleSpeed
  expect(phase()).toBeCloseTo(3 * step, 6);
  const beforePause = phase();
  rerender(<LuminousFlowBackground scrollScene paused />);
  const draws = drawn.length;
  tick();
  expect(frames.size).toBe(0);
  expect(drawn.length).toBe(draws);
  advance(60_000);
  rerender(<LuminousFlowBackground scrollScene />);
  expect(frames.size).toBe(1);
  tick();
  expect(phase()).toBeCloseTo(beforePause + step, 6);
});

it('입자 점은 점선 대신 점마다 스프라이트로 찍고, 점선은 빛줄기 한 겹에만 쓴다', () => {
  const { drawn, tick } = harness();
  render(<LuminousFlowBackground scrollScene />);
  tick();
  expect(drawn.at(-1)!.dots).toBeGreaterThan(28);
  // 가닥마다 빛줄기 점선의 오프셋 하나와, 입자 전에 0으로 되돌리는 한 번이다(점까지 점선이면 57)
  expect(drawn.at(-1)!.dashes).toHaveLength(28 + 1);
});

// The texture fills a strip per frame; 20 frames cover this scene's 17 strips.
function revealScene(options?: Parameters<typeof harness>[0]) {
  const scene = harness(options);
  const ref = createRef<LuminousFlowBackgroundHandle>();
  const view = render(<LuminousFlowBackground ref={ref} scrollScene />);
  scene.tick(); scene.loadImages();
  for (let frame = 0; frame < 20; frame++) scene.tick();
  return { ...scene, ...view, ref, reveal: (progress: number) => { act(() => ref.current!.setRevealProgress(progress)); scene.tick(); return scene.drawn.at(-1)!; } };
}
// The first 28 paths of a frame are the strands; the combined rim path follows them.
const strandSegments = (frame: DrawnFrame) => frame.paths.slice(0, 28).map(segments => segments.length);

it('reveal은 가닥마다 제 시간표의 길이까지 자르고, 광휘는 가장 늦은 가닥에서 alpha 계단으로 사라지며, 0..1로 고정한다', () => {
  const { drawn, shapes, container, reveal } = revealScene();
  const [shape] = shapes();
  const envelope = container.querySelector('[data-flow-envelope]')!;
  // The source haze is the root's first child; it is Luminous glow, so it follows the reveal too.
  const haze = container.firstElementChild!.firstElementChild as HTMLElement;
  const canvas = container.querySelector('canvas');
  expect(haze.style.opacity).toBe('');
  const full = drawn.at(-1)!;
  // Segments above the crop are skipped at the start, so each strand's full count is its own baseline.
  const counts = strandSegments(full);
  counts.forEach(count => expect(count).toBeGreaterThan(shape.center.length / 2));
  expect(full.glow).toBe(1); expect(full.clips).toBe(0); expect(full.erases).toEqual([]); expect(full.arcs).toBeGreaterThan(0);
  expect(envelope.hasAttribute('mask')).toBe(false);

  const half = reveal(.5);
  // The harness viewport is as tall as the scene, so the first screen holds the whole path below the scene top,
  // and heads start where the path enters it.
  const entry = shape.center.find(point => point.y >= 0)!.s;
  expect(entry).toBeGreaterThan(0);
  const reach = counts.map((_, strand) => entry + strandReach(strand, .5, shape.length - entry));
  const end = (cut: number) => shape.center.findIndex(point => point.s > cut);
  expect(strandSegments(half)).toEqual(counts.map((count, strand) => count - (shape.center.length - 1 - end(reach[strand]))));
  expect(new Set(strandSegments(half)).size).toBeGreaterThan(5);
  expect(half.glow).toBe(1); expect(half.clips).toBe(1);
  expect(half.arcs).toBeGreaterThan(0); expect(half.arcs).toBeLessThan(full.arcs);
  // Layer j of the front erases 1/j, so the glow falls to zero in equal steps, never a hard clip edge.
  const steps = half.erases.length;
  expect(steps).toBeGreaterThanOrEqual(6);
  expect([...half.erases].sort((a, b) => b - a)).toEqual(Array.from({ length: steps }, (_, layer) => 1 / (layer + 1)));
  // The live SVG takes the same front through a mask: the glow up to the slowest strand, then the same erase layers.
  const maskId = envelope.getAttribute('mask')!.match(/^url\(#(.+)\)$/)![1];
  const [glow, ...fades] = [...container.querySelectorAll(`[id="${maskId}"] path`)];
  const points = (path: Element) => path.getAttribute('d')!.match(/-?[\d.]+(e-?\d+)? -?[\d.]+(e-?\d+)?/g)!;
  const front = (path: Element) => points(path).slice(points(path).length / 2 - 1, points(path).length / 2 + 1);
  expect(points(glow)).toHaveLength(2 * (end(Math.min(...reach)) + 1));
  // The same outline also clips the group, so the browser rasterizes only the grown part under the mask.
  const clipId = envelope.getAttribute('clip-path')!.match(/^url\(#(.+)\)$/)![1];
  expect(container.querySelector(`[id="${clipId}"] path`)!.getAttribute('d')).toBe(glow.getAttribute('d'));
  expect(fades).toHaveLength(steps);
  fades.forEach((fade, layer) => {
    expect(Number(fade.getAttribute('fill-opacity'))).toBeCloseTo(1 / (layer + 1), 6);
    expect(front(fade)).toEqual(front(glow));
  });
  // The haze waits until the last strand has left the first screen, then fades in up to reveal 1.
  expect(haze.style.opacity).toBe('0');
  reveal(HAZE_FROM - .01);
  expect(haze.style.opacity).toBe('0');
  reveal((1 + HAZE_FROM) / 2);
  expect(Number(haze.style.opacity)).toBeCloseTo(.5, 6);

  const hidden = reveal(-1);
  expect(strandSegments(hidden)).toEqual(counts.map(() => 0));
  expect(hidden.arcs).toBe(0); expect(hidden.glow).toBe(0);
  expect(envelope.hasAttribute('mask')).toBe(true);
  expect(haze.style.opacity).toBe('0');

  const again = reveal(2);
  expect(strandSegments(again)).toEqual(counts);
  expect(again.clips).toBe(0); expect(again.glow).toBe(1); expect(again.erases).toEqual([]);
  expect(envelope.hasAttribute('mask')).toBe(false); expect(envelope.hasAttribute('clip-path')).toBe(false);
  expect(haze.style.opacity).toBe('');
  expect(container.firstElementChild!.firstElementChild).toBe(haze);
  expect(container.querySelector('canvas')).toBe(canvas);
  expect(shapes()).toHaveLength(1);
});

// Task 8 review gap 8, final review I-1: the real page is taller than the screen, so the schedule runs on the first
// screen's crossing (fold), not on the whole-path fallback, and an entrance finished quickly from mid-way only grows.
it('문서가 화면보다 길면 첫 화면 아래 끝(fold)으로 시간을 재고, 중간에서 빨리 마쳐도 가닥은 줄지 않으며 안개 전에 모든 머리가 첫 화면을 떠난다', () => {
  const schedule = vi.mocked(strandReach);
  const { shapes, reveal } = revealScene({ screen: 900 });
  const [shape] = shapes();
  const entry = shape.center.find(point => point.y >= 0)!.s;
  const fold = shape.center.find(point => point.y >= 900)!.s;
  expect(fold).toBeGreaterThan(entry);
  expect(fold).toBeLessThan(shape.length / 2);
  const spans = () => schedule.mock.calls.slice(-28).map(([, , span]) => span);
  let previous = strandSegments(reveal(1 / 2.9));
  expect(spans()).toEqual(Array(28).fill(fold - entry));
  for (const progress of [.45, .6, .75, .9, .99]) {
    const next = strandSegments(reveal(progress));
    next.forEach((count, strand) => expect(count, `strand ${strand} at ${progress}`).toBeGreaterThanOrEqual(previous[strand]));
    previous = next;
  }
  reveal(HAZE_FROM);
  schedule.mock.results.slice(-28).forEach(({ value }) => expect(value).toBeGreaterThanOrEqual((fold - entry) * .999));
  const done = strandSegments(reveal(1));
  done.forEach((count, strand) => expect(count).toBeGreaterThanOrEqual(previous[strand]));
});

it('입자와 광휘는 가닥이 자란 곳에만 있다: 한 가닥만 다 자라면 그 가닥의 입자만 보이고 광휘는 없다', () => {
  const schedule = vi.mocked(strandReach);
  const real = schedule.getMockImplementation()!;
  // Atoms 0 and 28 ride strand 3, the only strand that grows here.
  schedule.mockImplementation((strand, progress) => progress >= 1 || strand === 3 ? Infinity : 0);
  try {
    const { reveal } = revealScene();
    const frame = reveal(.5);
    expect(strandSegments(frame).map(count => count > 0)).toEqual(Array.from({ length: 28 }, (_, strand) => strand === 3));
    expect(frame.arcs).toBe(2 * 3);
    expect(frame.glow).toBe(0);
  } finally {
    schedule.mockImplementation(real);
  }
});

it('reveal 갱신은 형상·캔버스·흐름 시간을 다시 만들지 않고 정지 중에는 한 장만 그린다', () => {
  const { frames, drawn, tick, phase, shapes, getContext } = harness();
  const ref = createRef<LuminousFlowBackgroundHandle>();
  const { container, rerender } = render(<LuminousFlowBackground ref={ref} scrollScene />);
  tick(); tick();
  const canvas = container.querySelector('canvas'); const contexts = getContext.mock.calls.length;
  let previous = phase();
  [.2, .7, 0, 1].forEach(progress => {
    act(() => ref.current!.setRevealProgress(progress));
    expect(frames.size).toBe(1);
    tick();
    expect(phase()).toBeGreaterThan(previous);
    previous = phase();
  });
  expect(shapes()).toHaveLength(1);
  expect(container.querySelector('canvas')).toBe(canvas);
  expect(getContext).toHaveBeenCalledTimes(contexts);

  rerender(<LuminousFlowBackground ref={ref} scrollScene paused />); tick();
  const paused = phase(); const draws = drawn.length;
  act(() => ref.current!.setRevealProgress(.4));
  act(() => ref.current!.setRevealProgress(.6));
  expect(frames.size).toBe(1);
  tick(); tick();
  expect(drawn.length).toBe(draws + 1);
  expect(phase()).toBe(paused);
  expect(frames.size).toBe(0);
});

it('reduced motion은 정적 한 장과 레이아웃 갱신만 그리고 흐름 루프를 돌리지 않는다', () => {
  const { frames, drawn, tick, phase } = harness({ reduced: true });
  const ref = createRef<LuminousFlowBackgroundHandle>();
  render(<LuminousFlowBackground ref={ref} scrollScene />);
  tick();
  expect(drawn).toHaveLength(1); expect(phase()).toBe(0); expect(frames.size).toBe(0);
  act(() => { window.dispatchEvent(new Event('scroll')); }); tick();
  act(() => ref.current!.setRevealProgress(.5)); tick();
  tick(); tick();
  expect(drawn).toHaveLength(3); expect(phase()).toBe(0); expect(frames.size).toBe(0);
});

it('탭이 숨으면 예약을 지우고 돌아오면 위상을 이어 간다', () => {
  const { frames, drawn, tick, advance, phase } = harness();
  let hidden = false;
  vi.spyOn(Document.prototype, 'hidden', 'get').mockImplementation(() => hidden);
  render(<LuminousFlowBackground scrollScene />);
  tick(); tick();
  const before = phase(); const draws = drawn.length;
  hidden = true; act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(frames.size).toBe(0);
  advance(30_000); tick();
  expect(drawn.length).toBe(draws);
  hidden = false; act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(frames.size).toBe(1);
  tick();
  expect(phase()).toBeCloseTo(before + .016 * .5, 6);
});

it('resize는 루프를 겹치지 않고 새 크기의 형상을 만들며 정지 중에는 정적 한 장만 다시 그린다', () => {
  const { frames, drawn, tick, phase, shapes, resizeTo } = harness();
  const { container, rerender } = render(<LuminousFlowBackground scrollScene />);
  tick();
  const canvas = container.querySelector('canvas');
  resizeTo({ left: 0, top: 0, width: 1200, height: 5000 });
  expect(frames.size).toBe(1);
  tick();
  expect(shapes().map(({ width, height }) => [width, height])).toEqual([[1200, 4000], [1200, 5000]]);
  expect(container.querySelector('canvas')).toBe(canvas);

  rerender(<LuminousFlowBackground scrollScene paused />); tick();
  const paused = phase(); const draws = drawn.length;
  resizeTo({ left: 0, top: 0, width: 900, height: 5000 });
  expect(frames.size).toBe(1);
  tick(); tick();
  expect(drawn.length).toBe(draws + 1);
  expect(shapes().at(-1)!.width).toBe(900);
  expect(phase()).toBe(paused);
  expect(frames.size).toBe(0);
  // 형상을 세 번 새로 만든다. 기본 워커 수의 전체 실행 부하에서 기본 5초를 넘긴 적이 있다.
}, 20_000);

it('Contacts 표지의 위쪽 끝을 장면 좌표로 재어 형상에 넘기고 크기가 바뀌면 다시 잰다', () => {
  const { drawn, tick, resizeTo, shapes } = harness({ rect: { left: 0, top: -700, width: 1200, height: 4000 } });
  let finale = 3180;
  const rect = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
  const scene = rect.getMockImplementation()!;
  rect.mockImplementation(function (this: HTMLElement) { return this.hasAttribute('data-flow-finale') ? { top: finale } as DOMRect : scene.call(this); });
  render(<><LuminousFlowBackground scrollScene /><div data-flow-finale="" /></>);
  tick();
  expect(vi.mocked(buildFlowGeometry).mock.calls.at(-1)).toEqual([1200, 4000, 3880]);
  finale = 3780;
  resizeTo({ left: 0, top: -700, width: 1200, height: 4600 });
  tick();
  expect(vi.mocked(buildFlowGeometry).mock.calls.at(-1)).toEqual([1200, 4600, 4480]);
  // Bend rims sit on the narrow turns (the halfWidth minima), whatever the vertical mapping.
  const shape = shapes().at(-1)!, unit = shape.width / 492;
  const turns = shape.center.flatMap((point, index, all) => index > 0 && index < all.length - 1 && point.halfWidth < all[index - 1].halfWidth && point.halfWidth <= all[index + 1].halfWidth ? [index] : []);
  const rims = drawn.at(-1)!.rims.map(([x, y]) => shape.center.findIndex(point => Math.abs(point.x - x * unit) < 1e-6 && Math.abs(point.y - y * unit) < 1e-6));
  expect(turns).toHaveLength(5);
  expect(rims).toHaveLength(5);
  rims.forEach((sample, index) => expect(Math.abs(sample - turns[index])).toBeLessThanOrEqual(1));
  // 혼자 돌면 1.3초지만 형상을 두 번 새로 만들어, 기본 워커 수의 전체 실행 부하에서 기본 5초를 넘긴 적이 있다.
}, 20_000);

it('광휘 텍스처는 프레임마다 8줄 단위 띠 하나씩 채우고 다 채운 뒤에야 살아 있는 SVG를 숨긴다', () => {
  const { drawn, tick, loadImages, shapes, strips } = harness();
  const { container } = render(<LuminousFlowBackground scrollScene />);
  tick(); loadImages();
  const svg = container.querySelector('svg')!;
  const [{ width, height }] = shapes();
  const ratio = Math.min(1, Math.sqrt(4e6 / (width * height)));
  const [textureWidth, textureHeight] = [Math.ceil(width * ratio), Math.ceil(height * ratio)];
  // 불러온 그 자리에서는 그리지 않는다. 첫 띠는 다음 프레임이다.
  expect(strips).toHaveLength(0);
  let frames = 0;
  while (svg.style.visibility !== 'hidden' && frames < 100) {
    tick(); frames++;
    expect(strips).toHaveLength(frames);
    if (svg.style.visibility !== 'hidden') expect(drawn.at(-1)!.glow).toBe(0);
  }
  // 띠는 8줄의 배수이고 텍스처 픽셀 25만 개를 넘지 않는 가장 큰 높이다. 디더 위상이 한 번에 그린 것과 같다.
  const rows = strips[0][3];
  expect(rows % 8).toBe(0);
  expect(textureWidth * rows).toBeLessThanOrEqual(25e4);
  expect(textureWidth * (rows + 8)).toBeGreaterThan(25e4);
  strips.forEach(([x, y, w, h, ...image], index) => {
    expect([x, y, w, h]).toEqual([0, index * rows, textureWidth, rows]);
    expect(image).toEqual([0, 0, textureWidth, textureHeight]);
  });
  expect(strips.length).toBe(Math.ceil(textureHeight / rows));
  tick();
  expect(drawn.at(-1)!.glow).toBe(1);
  tick(); tick();
  expect(strips).toHaveLength(frames);
});

it('크기가 바뀌거나 unmount되면 그리던 띠 예약을 버린다', () => {
  const { frames, tick, loadImages, strips, resizeTo } = harness();
  const { unmount } = render(<LuminousFlowBackground scrollScene paused />);
  tick(); loadImages(); tick(); tick();
  expect(strips).toHaveLength(2);
  resizeTo({ left: 0, top: 0, width: 900, height: 4000 });
  tick();
  const drawnStrips = strips.length;
  tick(); tick();
  expect(strips).toHaveLength(drawnStrips);
  expect(frames.size).toBe(0);
  loadImages(); tick();
  expect(strips.at(-1)!.slice(2, 4)[0]).toBe(900);
  expect(frames.size).toBe(1);
  unmount();
  expect(frames.size).toBe(0);
});

it('StrictMode와 unmount에서 observer와 RAF가 겹치거나 남지 않는다', () => {
  const { frames, tick, observers } = harness();
  const { unmount } = render(<StrictMode><LuminousFlowBackground scrollScene /></StrictMode>);
  expect(observers.size).toBe(1); expect(frames.size).toBe(1);
  tick(); tick();
  expect(frames.size).toBe(1);
  unmount();
  expect(observers.size).toBe(0); expect(frames.size).toBe(0);
});

it('2D context가 없거나 크기가 0이어도 검정 바탕과 본문 접근을 유지한다', () => {
  const { frames, tick, observers, getContext, resizeTo } = harness({ rect: { left: 0, top: 0, width: 0, height: 0 } });
  const view = render(<><LuminousFlowBackground scrollScene /><button>본문</button></>);
  tick();
  const root = view.container.firstElementChild as HTMLElement;
  expect(root.getAttribute('aria-hidden')).toBe('true');
  expect(root.style.getPropertyValue('--flow-background')).toBe('#000000');
  expect(screen.getByRole('button', { name: '본문' })).toBeTruthy();
  // A zero-size frame stops the loop; the first real size restarts it.
  expect(frames.size).toBe(0);
  resizeTo({ left: 0, top: 0, width: 1200, height: 4000 });
  tick();
  expect(frames.size).toBe(1);
  view.unmount();

  getContext.mockReturnValue(null);
  render(<><LuminousFlowBackground scrollScene /><button>본문</button></>);
  expect(frames.size).toBe(0); expect(observers.size).toBe(0);
  expect(screen.getByRole('button', { name: '본문' })).toBeTruthy();
});
