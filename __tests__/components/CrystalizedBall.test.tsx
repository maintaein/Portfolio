import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BALL_ICONS, FIELD_GLSL, fieldPoint, iconStyle } from '@/components/blocks/CrystalizedBall/field';

// The GL mock records the uniforms of every draw and the shader sources; nothing is rasterised.
type Drawn = Record<string, number | number[]>;
const gpu = vi.hoisted(() => ({ drawn: [] as Record<string, number | number[]>[], vertex: [] as string[], lost: 0, webgl2: true, fail: false, renderer: null as null | { dpr: number; width: number; height: number } }));
vi.mock('ogl', () => {
  class Renderer {
    dpr = 1; isWebgl2 = gpu.webgl2; width = 0; height = 0;
    gl: Record<string, unknown> & { canvas: HTMLCanvasElement };
    constructor() {
      if (gpu.fail) throw new TypeError('no webgl');
      gpu.renderer = this;
      this.gl = { canvas: document.createElement('canvas'), POINTS: 0, ONE: 1, clearColor() {}, getExtension: (name: string) => name === 'WEBGL_lose_context' ? { loseContext: () => { gpu.lost++; } } : null };
    }
    setSize(width: number, height: number) {
      this.width = width; this.height = height;
      this.gl.canvas.width = Math.round(width * this.dpr); this.gl.canvas.height = Math.round(height * this.dpr);
    }
    render({ scene }: { scene: { program: { uniforms: Record<string, { value: unknown }> } } }) {
      gpu.drawn.push(Object.fromEntries(Object.entries(scene.program.uniforms)
        .filter(([, u]) => typeof u.value === 'number' || Array.isArray(u.value))
        .map(([key, u]) => [key, Array.isArray(u.value) ? [...u.value] : u.value as number])));
    }
  }
  class Program {
    uniforms: unknown;
    constructor(public gl: unknown, { vertex, fragment, uniforms }: { vertex: string; fragment: string; uniforms: unknown }) {
      this.uniforms = uniforms;
      gpu.vertex.push(vertex);
      (this as unknown as { setShaders: (s: object) => void }).setShaders({ vertex, fragment });
    }
    setShaders() {}
    setBlendFunc() {}
  }
  class Mesh { program: unknown; constructor(_gl: unknown, { program }: { program: unknown }) { this.program = program; } }
  class Geometry { constructor(_gl: unknown, public attributes: unknown) {} }
  class Triangle {}
  return { Renderer, Program, Mesh, Geometry, Triangle };
});

import CrystalizedBall from '@/components/blocks/CrystalizedBall';

let clock = 1000;
let side = 400;
const frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  gpu.drawn.length = 0; gpu.vertex.length = 0; gpu.lost = 0; gpu.webgl2 = true; gpu.fail = false; gpu.renderer = null;
  frames.clear(); clock = 1000; side = 400;
  let id = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++id, callback); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((frame: number) => frames.delete(frame)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('devicePixelRatio', 2);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => side);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => side);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, width: side, height: side, right: side, bottom: side, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const tick = (step = 16) => act(() => {
  clock += step;
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback(clock));
});
// jsdom has no PointerEvent; the component reads clientX/Y and pointerType only.
const pointer = (type: string, clientX = 0, clientY = 0, pointerType = 'mouse') => Object.assign(new MouseEvent(type, { clientX, clientY }), { pointerType });
const REST = 'scale(0.5)';
const dustDraw = () => gpu.drawn.filter(draw => 'uBrush' in draw).at(-1) as Drawn & { uTime: number; uTurn: number[]; uBrush: number[] };

function mount(props: { paused?: boolean; onReady?: () => void } = {}) {
  const icons = createRef<HTMLDivElement>();
  const markup = (paused = props.paused) => <div>
    <div ref={icons}>{BALL_ICONS.map(icon => <span key={icon.name} style={{ transform: REST, opacity: 0.5 }} />)}</div>
    <CrystalizedBall icons={icons} paused={paused} onReady={props.onReady} />
  </div>;
  const view = render(markup());
  return { ...view, icons, update: (paused: boolean) => view.rerender(markup(paused)) };
}

it('draws a frontal ball canvas about 1.34x the anchor, capped at DPR 1.25 and 0.45 MP, and reports ready once after its first frame', () => {
  const onReady = vi.fn();
  const { container } = mount({ onReady });
  const canvas = container.querySelector('canvas')!;
  expect(canvas).not.toBeNull();
  expect(canvas.closest('[aria-hidden="true"]')).not.toBeNull();
  // The ball fills the anchor; the canvas reaches 1/6 of it past every edge for the rim glow (1.333x).
  expect(canvas.parentElement!.style.inset).toBe('-16.667%');
  expect(gpu.renderer!.dpr).toBe(1.25);
  expect(onReady).not.toHaveBeenCalled();
  tick(); tick();
  expect(onReady).toHaveBeenCalledTimes(1);
  expect(gpu.drawn.some(draw => 'uRim' in draw)).toBe(true);
  expect(dustDraw()).toBeDefined();
  cleanup();
  side = 640;
  mount();
  expect(gpu.renderer!.dpr).toBeLessThan(1.25);
  expect(gpu.renderer!.width * gpu.renderer!.height * gpu.renderer!.dpr ** 2).toBeLessThanOrEqual(4.5e5 + 1);
});

it('the dust shader moves every particle with the shared fieldPoint formula', () => {
  mount();
  const dust = gpu.vertex.find(source => source.includes('gl_PointSize'))!;
  expect(dust).toContain(FIELD_GLSL);
  expect(dust).toMatch(/fieldPoint\(aHome\.xyz, aSeed\.yzw, uTime, uTurn, uBrush\)/);
});

it('icons sit where fieldPoint puts them with the same time, turn and pointer state as the particles, every frame', () => {
  const { icons } = mount();
  const check = () => {
    const { uTime, uTurn, uBrush } = dustDraw();
    [...icons.current!.children].forEach((element, index) => {
      const style = iconStyle(fieldPoint(BALL_ICONS[index].home, BALL_ICONS[index].seed, uTime, uTurn, uBrush));
      expect((element as HTMLElement).style.transform).toBe(style.transform);
      expect((element as HTMLElement).style.opacity).toBe(String(style.opacity));
    });
  };
  for (let i = 0; i < 10; i++) tick(50);
  check();
  expect(dustDraw().uTime).toBeGreaterThan(.3);
  // Hover right next to the first icon: the pointer pushes it and turns the field toward the pointer.
  const free = dustDraw();
  const radius = .75 * side / 2;
  const target = fieldPoint(BALL_ICONS[0].home, BALL_ICONS[0].seed, free.uTime, free.uTurn, [0, 0, 0]);
  act(() => { window.dispatchEvent(pointer('pointermove', side / 2 + (target[0] - .12) * radius, side / 2 - target[1] * radius)); });
  for (let i = 0; i < 20; i++) tick(50);
  const hover = dustDraw();
  expect(hover.uBrush[2]).toBeGreaterThan(.5);
  expect(Math.abs(hover.uTurn[0] - .21 * Math.sin(hover.uTime * .23))).toBeGreaterThan(.01);
  check();
  const pushed = fieldPoint(BALL_ICONS[0].home, BALL_ICONS[0].seed, hover.uTime, hover.uTurn, hover.uBrush);
  const unpushed = fieldPoint(BALL_ICONS[0].home, BALL_ICONS[0].seed, hover.uTime, hover.uTurn, [hover.uBrush[0], hover.uBrush[1], 0]);
  expect(pushed[0] - unpushed[0]).toBeGreaterThan(.02);
  // Leaving the page lets the push ease out.
  act(() => { document.documentElement.dispatchEvent(pointer('pointerleave')); });
  for (let i = 0; i < 30; i++) tick(50);
  expect(dustDraw().uBrush[2]).toBeLessThan(.02);
  check();
});

it('touch never pushes the particles', () => {
  mount();
  act(() => { window.dispatchEvent(pointer('pointermove', side / 2, side / 2, 'touch')); });
  for (let i = 0; i < 10; i++) tick(50);
  expect(dustDraw().uBrush[2]).toBe(0);
});

it('pauses without scheduling frames and resumes from where it stopped', () => {
  const view = mount();
  tick(); tick();
  view.update(true);
  tick();
  expect(frames.size).toBe(0);
  const time = dustDraw().uTime;
  view.update(false);
  expect(frames.size).toBe(1);
  tick(16);
  expect(dustDraw().uTime).toBeCloseTo(time + .016, 5);
});

it('unmount stops the loop, drops the context and the canvas, restores the icons and stops listening', () => {
  const view = mount();
  tick(); tick();
  const icons = view.icons.current!;
  expect((icons.firstElementChild as HTMLElement).style.transform).not.toBe(REST);
  const host = view.container.querySelector('canvas')!.parentElement!;
  view.rerender(<div><div ref={view.icons}>{BALL_ICONS.map(icon => <span key={icon.name} style={{ transform: REST, opacity: 0.5 }} />)}</div></div>);
  expect(frames.size).toBe(0);
  expect(gpu.lost).toBe(1);
  expect(host.querySelector('canvas')).toBeNull();
  expect((icons.firstElementChild as HTMLElement).style.transform).toBe(REST);
  expect((icons.firstElementChild as HTMLElement).style.opacity).toBe('0.5');
  act(() => { window.dispatchEvent(pointer('pointermove', 10, 10)); });
  expect(frames.size).toBe(0);
});

it.each([['without WebGL2', () => { gpu.webgl2 = false; }], ['when the context cannot be created', () => { gpu.fail = true; }]])('stays on the static fallback %s', (_, setup) => {
  setup();
  const onReady = vi.fn();
  const { container } = mount({ onReady });
  tick(); tick();
  expect(container.querySelector('canvas')).toBeNull();
  expect(onReady).not.toHaveBeenCalled();
});
