import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// The GL mock records uniforms per draw and counts renderer/texture lifetimes. Visual continuity is checked in M4.
type Drawn = Record<string, number | number[]>;
const gpu = vi.hoisted(() => ({ renderers: 0, textures: 0, drawn: [] as Record<string, number | number[]>[] }));
vi.mock('ogl', () => {
  class Renderer {
    dpr: number; isWebgl2 = true; width = 0; height = 0;
    gl: Record<string, unknown> & { canvas: HTMLCanvasElement };
    constructor({ dpr }: { dpr: number }) {
      gpu.renderers++;
      this.dpr = dpr;
      this.gl = { canvas: document.createElement('canvas'), getExtension: () => null, clearColor() {}, renderer: this };
    }
    setSize(width: number, height: number) {
      this.width = width; this.height = height;
      this.gl.canvas.width = width * this.dpr; this.gl.canvas.height = height * this.dpr;
      Object.assign(this.gl.canvas.style, { width: `${width}px`, height: `${height}px` });
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
      (this as unknown as { setShaders: (s: object) => void }).setShaders({ vertex, fragment });
    }
    setShaders() {}
  }
  class Mesh { program: unknown; constructor(_gl: unknown, { program }: { program: unknown }) { this.program = program; } }
  class Triangle {}
  class Texture { constructor() { gpu.textures++; } }
  return { Renderer, Program, Mesh, Triangle, Texture };
});

import ElectricLogo, { type ElectricLogoHandle } from '@/components/blocks/ElectricLogo';

let clock = 1000;
let side = 200;
const frames = new Map<number, FrameRequestCallback>();
const images: { onload?: () => void }[] = [];
beforeEach(() => {
  gpu.renderers = 0; gpu.textures = 0; gpu.drawn.length = 0;
  frames.clear(); images.length = 0; clock = 1000; side = 200;
  let id = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++id, callback); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((frame: number) => frames.delete(frame)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  vi.stubGlobal('Image', class { onload?: () => void; naturalWidth = 64; naturalHeight = 64; set src(_value: string) { images.push(this); } });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  // A centred opaque square of `side` raster pixels; changing `side` gives a different logo.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    drawImage() {},
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (Math.abs(x + 0.5 - w / 2) < side / 2 && Math.abs(y + 0.5 - h / 2) < side / 2) data[(y * w + x) * 4 + 3] = 255;
      }
      return { data };
    },
  }) as unknown as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const tick = (step = 16) => act(() => {
  clock += step;
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(clock));
});
const loadImages = (nextSide: number) => act(() => { side = nextSide; images.splice(0).forEach((image) => image.onload?.()); });
const last = () => gpu.drawn.at(-1) as Drawn;
const canvas = (container: HTMLElement) => container.querySelector('canvas')!;
const box = { width: 640, height: 360, radius: 24 };

// A logo showing `src` after its trace, then optionally mid-way through a 1 s morph to `next`.
function mount(src: string, next?: string, ref = createRef<ElectricLogoHandle>()) {
  const view = render(<ElectricLogo ref={ref} src={src} />);
  loadImages(200);
  tick();
  if (next) {
    view.rerender(<ElectricLogo ref={ref} src={next} />);
    loadImages(120);
    tick();
    tick(384);
  }
  return { ...view, ref };
}

it('keeps the 1 s time morph for a logo without a ref', () => {
  const view = render(<ElectricLogo src="plain-a.svg" />);
  loadImages(200);
  tick();
  view.rerender(<ElectricLogo src="plain-b.svg" />);
  loadImages(120);
  tick();
  expect(last().uMorph).toBeCloseTo(0.016, 3);
  tick(484);
  expect(last().uMorph).toBeCloseTo(0.5, 3);
  tick(500);
  expect(last().uMorph).toBe(1);
});

it('refuses to begin before a shape is visible and begins once it is', () => {
  const ref = createRef<ElectricLogoHandle>();
  render(<ElectricLogo ref={ref} src="ready-a.svg" />);
  tick();
  expect(ref.current!.beginBoundary(box)).toBe(false);
  loadImages(200);
  tick();
  expect(ref.current!.beginBoundary(box)).toBe(true);
});

it('starts from the visible mid-morph shape and follows seeks in order without time advancing it', () => {
  const { ref } = mount('seek-a.svg', 'seek-b.svg');
  const start = last();
  expect(start.uMorph).toBeCloseTo(0.4, 3);
  expect(ref.current!.beginBoundary(box)).toBe(true);
  for (const p of [0, 0.5, 0.2, 1]) {
    ref.current!.seekBoundary(p);
    tick(250);
    expect(last().uBoundary).toBe(p);
    expect(last().uMorph).toBe(start.uMorph);
    expect(last().uMapFrom).toEqual(start.uMapFrom);
    expect(last().uMapTo).toEqual(start.uMapTo);
  }
  ref.current!.seekBoundary(-1);
  tick();
  expect(last().uBoundary).toBe(0);
  ref.current!.seekBoundary(2);
  tick();
  expect(last().uBoundary).toBe(1);
});

it('allocates the boundary footprint at begin and target change, not per seek', () => {
  const { ref, container } = mount('size-a.svg');
  const textures = gpu.textures;
  ref.current!.beginBoundary(box);
  tick();
  const [fw, fh] = last().uResolution as number[];
  expect(fw).toBeGreaterThan(640);
  expect(fh).toBeGreaterThanOrEqual(400);
  expect(last().uOrigin).toEqual([(fw - 400) / 2, (fh - 400) / 2]);
  expect(last().uBox).toEqual([200, 200, 320, 180]);
  // Out of flow, so the larger canvas cannot raise the min-content size of a flex parent.
  expect(canvas(container).style).toMatchObject({ position: 'absolute', left: `${(400 - fw) / 2}px`, top: `${(400 - fh) / 2}px` });
  const size = [canvas(container).width, canvas(container).height, canvas(container).style.cssText];
  for (const p of [0.1, 0.6, 0.3, 0.9]) {
    ref.current!.seekBoundary(p);
    tick();
    expect([canvas(container).width, canvas(container).height, canvas(container).style.cssText]).toEqual(size);
  }
  expect(gpu.renderers).toBe(1);
  expect(gpu.textures).toBe(textures);
});

it('changes the destination on a target update without re-capturing the start', () => {
  const { ref } = mount('target-a.svg', 'target-b.svg');
  ref.current!.beginBoundary(box);
  ref.current!.seekBoundary(0.5);
  tick();
  const before = last();
  ref.current!.setBoundaryTarget({ width: 300, height: 200, radius: 500 });
  tick();
  expect(last().uBox).toEqual([200, 200, 150, 100]);
  expect(last().uBoxRadius).toBe(100);
  expect(last().uBoundary).toBe(0.5);
  for (const key of ['uMorph', 'uMapFrom', 'uMapTo', 'uSizeFrom', 'uSizeTo']) expect(last()[key]).toEqual(before[key]);
});

it('keeps a src change during the boundary out until end, then restores the 1 s morph', () => {
  const { ref, rerender, container } = mount('end-a.svg');
  const shown = last();
  ref.current!.beginBoundary(box);
  rerender(<ElectricLogo ref={ref} src="end-b.svg" />);
  loadImages(120);
  ref.current!.seekBoundary(0.7);
  tick(500);
  expect(last().uSizeTo).toEqual(shown.uSizeTo);
  expect(last().uMorph).toBe(1);
  ref.current!.endBoundary();
  tick();
  expect(last().uBoundary).toBe(0);
  expect(last().uResolution).toEqual([400, 400]);
  expect(last().uOrigin).toEqual([0, 0]);
  expect(canvas(container).style).toMatchObject({ position: '', left: '', top: '', width: '400px', height: '400px' });
  expect((container.firstChild as HTMLElement).style.overflow).toBe('');
  expect(last().uSizeTo).not.toEqual(shown.uSizeTo);
  expect(last().uMorph).toBeCloseTo(0.016, 3);
  tick(484);
  expect(last().uMorph).toBeCloseTo(0.5, 3);
  tick(500);
  expect(last().uMorph).toBe(1);
});

it('resumes an interrupted morph where begin froze it', () => {
  const { ref } = mount('resume-a.svg', 'resume-b.svg');
  ref.current!.beginBoundary(box);
  tick(3000);
  ref.current!.endBoundary();
  tick(100);
  expect(last().uMorph).toBeCloseTo(0.5, 3);
});

// Task 1 review carryovers for the shared logo host (M3 2b).
function observeVisibility() {
  const observers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { observers.push(callback); }
    observe() {} disconnect() {}
  });
  return (isIntersecting: boolean) => act(() => observers.forEach((callback) => callback([{ isIntersecting }])));
}

it('keeps drawing boundary seeks after the container leaves the viewport, because the footprint is larger', () => {
  const setVisible = observeVisibility();
  const { ref } = mount('gate-a.svg');
  ref.current!.beginBoundary(box);
  tick();
  setVisible(false);
  // The frame already queued runs once and the loop stops.
  tick();
  ref.current!.seekBoundary(0.6);
  tick();
  expect(last().uBoundary).toBe(0.6);
});

it('draws a boundary end made off screen and inactive once the container returns', () => {
  const setVisible = observeVisibility();
  const ref = createRef<ElectricLogoHandle>();
  const view = render(<ElectricLogo ref={ref} src="dirty-a.svg" />);
  loadImages(200);
  tick();
  ref.current!.beginBoundary(box);
  tick();
  view.rerender(<ElectricLogo ref={ref} src="dirty-a.svg" active={false} />);
  setVisible(false);
  ref.current!.endBoundary();
  tick();
  const draws = gpu.drawn.length;
  expect(last().uBoundary).toBe(0);
  expect(last().uResolution).not.toEqual([400, 400]);
  setVisible(true);
  tick();
  expect(gpu.drawn.length).toBe(draws + 1);
  expect(last().uResolution).toEqual([400, 400]);
  tick();
  expect(gpu.drawn.length).toBe(draws + 1);
});
