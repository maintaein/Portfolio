import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode, createRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/components/blocks/LuminousFlowBackground/styles.module.css', () => ({ default: {} }));
// The real geometry runs; the spy only shows which shapes the renderer was given.
vi.mock('@/components/blocks/LuminousFlowBackground/geometry', async original => {
  const actual = await original<typeof import('@/components/blocks/LuminousFlowBackground/geometry')>();
  return { ...actual, buildFlowGeometry: vi.fn(actual.buildFlowGeometry) };
});
import LuminousFlowBackground, { type LuminousFlowBackgroundHandle } from '@/components/blocks/LuminousFlowBackground';
import { buildFlowGeometry, type FlowGeometry } from '@/components/blocks/LuminousFlowBackground/geometry';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 }); });

type DrawnFrame = { dashes: number[]; paths: number[][][]; arcs: number; clips: number; glow: number; rims: number[][] };
// RAF callback map, fake clock and Canvas/IO mocks. They see frame scheduling, canvas calls and the geometry passed in.
function harness({ reduced = false, rect = { left: 0, top: 0, width: 1200, height: 4000 } } = {}) {
  // A viewport as tall as the document keeps every segment inside the drawn crop.
  const viewport = (height: number) => Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height || 768 });
  viewport(rect.height);
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
  const main = new Proxy({}, {
    get: (_target, key) => helpers(key) ?? (
      key === 'clearRect' ? () => { current = { dashes: [], paths: [], arcs: 0, clips: 0, glow: 0, rims: [] }; drawn.push(current); }
        : key === 'arc' ? () => { current!.arcs++; }
          : key === 'clip' ? () => { current!.clips++; }
            // The glow texture spans the scene; bend rims are 76 units tall.
            : key === 'drawImage' ? (...args: number[]) => { if (args[4] > 1000) current!.glow++; else current!.rims.push([args[1] + 45, args[2] + 38]); }
              : () => {}),
    set: (_target, key, value) => { if (key === 'lineDashOffset') current?.dashes.push(value); return true; },
  });
  const other = new Proxy({}, { get: (_target, key) => helpers(key) ?? (() => {}) });
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { return (this.isConnected ? main : other) as CanvasRenderingContext2D; });
  let bounds = rect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => bounds as DOMRect);
  const builds = vi.mocked(buildFlowGeometry);
  const built = builds.mock.results.length;
  return {
    frames, drawn, getContext,
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

it('reveal은 공통 중심선의 누적 길이로 줄기·입자·광휘를 함께 자르고 0..1로 고정한다', () => {
  const { drawn, tick, loadImages, shapes } = harness();
  const ref = createRef<LuminousFlowBackgroundHandle>();
  const { container } = render(<LuminousFlowBackground ref={ref} scrollScene />);
  tick(); loadImages(); tick();
  const [shape] = shapes();
  const envelope = container.querySelector('[data-flow-envelope]')!;
  // The source haze is the root's first child; it is Luminous glow, so it follows the reveal too.
  const haze = container.firstElementChild!.firstElementChild as HTMLElement;
  const canvas = container.querySelector('canvas');
  expect(haze.style.opacity).toBe('');
  // The first 28 paths of a frame are the strands; the combined rim path follows them.
  const strands = (frame: DrawnFrame) => frame.paths.slice(0, 28).map(segments => segments.length);
  const full = drawn.at(-1)!;
  // Segments above the crop are skipped at the start, so each strand's full count is its own baseline.
  const counts = strands(full);
  counts.forEach(count => expect(count).toBeGreaterThan(shape.center.length / 2));
  expect(full.glow).toBe(1); expect(full.clips).toBe(0); expect(full.arcs).toBeGreaterThan(0);
  expect(envelope.hasAttribute('clip-path')).toBe(false);

  act(() => ref.current!.setRevealProgress(.5)); tick();
  const half = drawn.at(-1)!;
  // Every strand ends inside the same center segment: the first sample past half the path length.
  const end = shape.center.findIndex(point => point.s > shape.length / 2);
  expect(strands(half)).toEqual(counts.map(count => count - (shape.center.length - 1 - end)));
  expect(half.glow).toBe(1); expect(half.clips).toBe(1);
  expect(half.arcs).toBeGreaterThan(0); expect(half.arcs).toBeLessThan(full.arcs);
  const clipId = envelope.getAttribute('clip-path')!.match(/^url\(#(.+)\)$/)![1];
  expect(container.querySelector(`[id="${clipId}"] path`)!.getAttribute('d')).toMatch(/^M .+ Z$/);
  // The haze waits until the cut is past the first screen, then fades in up to reveal 1.
  expect(haze.style.opacity).toBe('0');
  act(() => ref.current!.setRevealProgress(.75)); tick();
  expect(haze.style.opacity).toBe('0.5');

  act(() => ref.current!.setRevealProgress(-1)); tick();
  const hidden = drawn.at(-1)!;
  expect(strands(hidden)).toEqual(counts.map(() => 0));
  expect(hidden.arcs).toBe(0); expect(hidden.glow).toBe(0);
  expect(envelope.hasAttribute('clip-path')).toBe(true);
  expect(haze.style.opacity).toBe('0');

  act(() => ref.current!.setRevealProgress(2)); tick();
  const again = drawn.at(-1)!;
  expect(strands(again)).toEqual(counts);
  expect(again.clips).toBe(0); expect(again.glow).toBe(1);
  expect(envelope.hasAttribute('clip-path')).toBe(false);
  expect(haze.style.opacity).toBe('');
  expect(container.firstElementChild!.firstElementChild).toBe(haze);
  expect(container.querySelector('canvas')).toBe(canvas);
  expect(shapes()).toHaveLength(1);
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
