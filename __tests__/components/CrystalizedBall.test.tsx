import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BALL_ICONS, FIELD_GLSL, driftPoint, fieldPoint, iconStyle, type Vec3 } from '@/components/blocks/CrystalizedBall/field';
import { STIR_GLSL, stiffness, stirStep } from '@/components/blocks/CrystalizedBall/stir';

// The GL mock records the uniforms of every draw and the shader sources; nothing is rasterised.
type Drawn = Record<string, number | number[]>;
const gpu = vi.hoisted(() => ({ drawn: [] as Record<string, number | number[]>[], vertex: [] as string[], fragment: [] as string[], targets: [] as { color: number; type: number }[], lost: 0, webgl2: true, fail: false, floatTargets: true, renderer: null as null | { dpr: number; width: number; height: number } }));
vi.mock('ogl', () => {
  class Renderer {
    dpr = 1; isWebgl2 = gpu.webgl2; width = 0; height = 0;
    gl: Record<string, unknown> & { canvas: HTMLCanvasElement };
    constructor() {
      if (gpu.fail) throw new TypeError('no webgl');
      gpu.renderer = this;
      this.gl = { canvas: document.createElement('canvas'), POINTS: 0, ONE: 1, FLOAT: 5126, HALF_FLOAT: 5131, RGBA: 6408, RGBA32F: 34836, RGBA16F: 34842, NEAREST: 9728, clearColor() {},
        getExtension: (name: string) => name === 'WEBGL_lose_context' ? { loseContext: () => { gpu.lost++; } } : name === 'EXT_color_buffer_float' && gpu.floatTargets ? {} : null };
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
      gpu.fragment.push(fragment);
      (this as unknown as { setShaders: (s: object) => void }).setShaders({ vertex, fragment });
    }
    setShaders() {}
    setBlendFunc() {}
  }
  class Mesh { program: unknown; constructor(_gl: unknown, { program }: { program: unknown }) { this.program = program; } }
  class Geometry { constructor(_gl: unknown, public attributes: unknown) {} }
  class Triangle {}
  class Texture { constructor(_gl: unknown, public options: unknown) {} }
  class RenderTarget {
    textures: Texture[];
    constructor(gl: unknown, { color = 1, type }: { color?: number; type: number }) { gpu.targets.push({ color, type }); this.textures = Array.from({ length: color }, () => new Texture(gl, {})); }
  }
  return { Renderer, Program, Mesh, Geometry, Triangle, Texture, RenderTarget };
});

import CrystalizedBall from '@/components/blocks/CrystalizedBall';

let clock = 1000;
let side = 400;
const frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  gpu.drawn.length = 0; gpu.vertex.length = 0; gpu.fragment.length = 0; gpu.targets.length = 0; gpu.lost = 0; gpu.webgl2 = true; gpu.fail = false; gpu.floatTargets = true; gpu.renderer = null;
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
type StirDraw = Drawn & { uTime: number; uTurn: number[]; uBrush: number[]; uBrushPower: number; uDt: number; uReset: number };
const dustDraw = () => gpu.drawn.filter(draw => 'uStirred' in draw).at(-1) as Drawn & { uTime: number; uTurn: number[]; uStirred: number };
const stirDraws = () => gpu.drawn.filter(draw => 'uBrushPower' in draw) as StirDraw[];
// Replays every recorded stir draw through the JS stir equations for each icon: the offsets the icons must show.
const replay = () => {
  const state = BALL_ICONS.map(() => ({ o: [0, 0, 0] as Vec3, v: [0, 0, 0] as Vec3 }));
  for (const draw of stirDraws()) state.forEach((s, index) => {
    if (draw.uReset > .5) { s.o = [0, 0, 0]; s.v = [0, 0, 0]; return; }
    const icon = BALL_ICONS[index];
    stirStep(s.o, s.v, driftPoint(icon.home, icon.seed, draw.uTime, draw.uTurn), stiffness(icon.seed), { t: draw.uTime, dt: draw.uDt, brush: draw.uBrush, power: draw.uBrushPower });
  });
  return state.map(s => s.o);
};

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

it('the dust shader places every particle with fieldPoint plus its stir offset, and the stir pass runs the shared stir equations', () => {
  mount();
  const dust = gpu.vertex.find(source => source.includes('gl_PointSize'))!;
  expect(dust).toContain(FIELD_GLSL);
  expect(dust).toMatch(/fieldPoint\(home\.xyz, seed\.yzw, uTime, uTurn, offset\)/);
  const stir = gpu.fragment.find(source => source.includes('outVelocity'))!;
  expect(stir).toContain(FIELD_GLSL);
  expect(stir).toContain(STIR_GLSL);
  expect(stir).toMatch(/stir\(o, v, driftPoint\(home\.xyz, seed\.yzw, uTime, uTurn\), stiffness\(seed\.yzw\), uTime, uDt, uBrush, uBrushPower\);/);
  // Offset and velocity state per particle, two ping-pong targets with two attachments each (full float when available).
  expect(gpu.targets).toEqual([{ color: 2, type: 5126 }, { color: 2, type: 5126 }]);
});

// Moves the pointer in screen px over `frames` frames of 33 ms, `at` in ball radii from the centre (y up).
const radius = () => .75 * side / 2;
const moveTo = (x: number, y: number) => act(() => { window.dispatchEvent(pointer('pointermove', side / 2 + x * radius(), side / 2 - y * radius())); });
const glide = (from: number[], to: number[], frames: number) => {
  for (let i = 1; i <= frames; i++) { moveTo(from[0] + (to[0] - from[0]) * i / frames, from[1] + (to[1] - from[1]) * i / frames); tick(33); }
};

it('icons move with the particles stir equations on the same per-frame inputs: dragged into a wake by a moving cursor, then springing back', () => {
  const { icons } = mount();
  const check = () => {
    const { uTime, uTurn } = dustDraw();
    const offsets = replay();
    [...icons.current!.children].forEach((element, index) => {
      const style = iconStyle(fieldPoint(BALL_ICONS[index].home, BALL_ICONS[index].seed, uTime, uTurn, offsets[index]));
      expect((element as HTMLElement).style.transform).toBe(style.transform);
      expect((element as HTMLElement).style.opacity).toBe(String(style.opacity));
    });
    return offsets;
  };
  for (let i = 0; i < 10; i++) tick(33);
  check();
  expect(stirDraws()).toHaveLength(0);
  // Sweep across the React icon.
  const start = dustDraw();
  const target = fieldPoint(BALL_ICONS[0].home, BALL_ICONS[0].seed, start.uTime, start.uTurn, [0, 0, 0]);
  glide([target[0] - .5, target[1]], [target[0] + .5, target[1]], 12);
  const swept = stirDraws().at(-1)!;
  expect(swept.uBrushPower).toBeCloseTo(.7, 5);
  expect(swept.uBrush[2]).toBeGreaterThan(1);
  const wake = check();
  expect(Math.hypot(...wake[0])).toBeGreaterThan(.02);
  // The cursor rests: icons spring back, then (stir energy decays, plus the 7 s settle) the stir resets to exactly zero.
  for (let i = 0; i < 600; i++) tick(33);
  expect(Math.hypot(...check()[0])).toBe(0);
  const settled = stirDraws().length;
  expect(stirDraws().at(-1)!.uReset).toBe(1);
  // A resting cursor moves nothing: no stir step runs and the icons sit on the bare field.
  for (let i = 0; i < 30; i++) tick(33);
  expect(stirDraws()).toHaveLength(settled);
  const { uTime, uTurn } = dustDraw();
  expect((icons.current!.children[0] as HTMLElement).style.transform).toBe(iconStyle(fieldPoint(BALL_ICONS[0].home, BALL_ICONS[0].seed, uTime, uTurn, [0, 0, 0])).transform);
  expect(dustDraw().uStirred).toBe(0);
});

it('touch never stirs the particles', () => {
  mount();
  for (let i = 0; i < 12; i++) { act(() => { window.dispatchEvent(pointer('pointermove', side / 2 + i * 10, side / 2, 'touch')); }); tick(33); }
  expect(stirDraws()).toHaveLength(0);
});

it('without float colour buffers the stir is off for particles and icons alike, like the reference', () => {
  gpu.floatTargets = false;
  const { icons } = mount();
  glide([-.6, .1], [.6, .1], 12);
  expect(gpu.targets).toHaveLength(0);
  expect(stirDraws()).toHaveLength(0);
  const { uTime, uTurn } = dustDraw();
  expect((icons.current!.children[0] as HTMLElement).style.transform).toBe(iconStyle(fieldPoint(BALL_ICONS[0].home, BALL_ICONS[0].seed, uTime, uTurn, [0, 0, 0])).transform);
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
