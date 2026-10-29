import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createExperienceOverlay,
  type BoundaryFrame,
  type TimelineFrame,
} from '@/components/sections/ExperienceSection/overlay';

// jsdom에는 2d 캔버스가 없다(canvas npm 패키지 미설치). PreviewMorph.test.tsx처럼 getContext를 모의 컨텍스트로 바꾼다.
// 픽셀은 여기서 못 본다. 이 파일은 루프의 켜짐·꺼짐과 그리기 호출만 잠근다.
type FakeContext = Record<string, ReturnType<typeof vi.fn>>;
let contexts: FakeContext[];

function fakeContext(): FakeContext {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get(target, key) {
      if (!(key in target)) {
        target[key] = key === 'createRadialGradient' || key === 'createLinearGradient' ? vi.fn(() => ({ addColorStop: vi.fn() })) : vi.fn();
      }
      return target[key];
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }) as FakeContext;
}

let frames: Map<number, FrameRequestCallback>;
let nextId: number;
const raf = vi.fn((cb: FrameRequestCallback) => {
  frames.set(++nextId, cb);
  return nextId;
});
const caf = vi.fn((id: number) => {
  frames.delete(id);
});

// 대기 중인 rAF를 한 번 돌린다
function tick(now = 1000) {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(cb => cb(now));
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

const drawCalls = (name: string) => contexts.reduce((n, c) => n + (name in c ? c[name].mock.calls.length : 0), 0);

function boundary(over: Partial<BoundaryFrame> = {}): BoundaryFrame {
  return {
    t: 0.3,
    preview: { left: 100, top: 100, width: 640, height: 360, right: 740, bottom: 460, x: 100, y: 100 } as DOMRect,
    radius: 16,
    image: null,
    target: { x: 200, y: 600 },
    ...over,
  };
}

const timeline: TimelineFrame = {
  scrollY: 0,
  axisX: 120,
  segments: [
    { from: 100, tip: 500, swell: 0.4, done: false, last: false, rOrigin: 16 },
    { from: 500, tip: 700, swell: 0, done: false, last: true, rOrigin: 7.5 },
  ],
  heads: [
    { y: 100, r: 7.5, pulse: 0, current: false },
    { y: 500, r: 16, pulse: 0.5, current: true },
    { y: 900, r: 0, pulse: 0, current: false },
  ],
};

let canvas: HTMLCanvasElement;

beforeEach(() => {
  contexts = [];
  frames = new Map();
  nextId = 0;
  raf.mockClear();
  caf.mockClear();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
    if (kind !== '2d') return null;
    const c = fakeContext();
    contexts.push(c);
    return c;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext);
  canvas = document.createElement('canvas');
  setHidden(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createExperienceOverlay', () => {
  it('2D 컨텍스트가 없으면 null을 돌려준다(받는 쪽이 그리기 없이 진행만 돈다)', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    expect(createExperienceOverlay(document.createElement('canvas'))).toBeNull();
    expect(raf).not.toHaveBeenCalled();
  });

  it('경계도 타임라인도 없으면 rAF를 요청하지 않는다', () => {
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setReduced(true);
    expect(raf).not.toHaveBeenCalled();
    overlay.destroy();
  });

  it('setBoundary가 들어오면 그리고, null이 되면 지운 뒤 멈춘다', () => {
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setBoundary(boundary());
    expect(raf).toHaveBeenCalledTimes(1);
    tick();
    expect(drawCalls('fill')).toBeGreaterThan(0);
    expect(frames.size).toBe(1);

    const cleared = drawCalls('clearRect');
    overlay.setBoundary(null);
    expect(drawCalls('clearRect')).toBeGreaterThan(cleared);
    expect(frames.size).toBe(0);
    tick();
    expect(frames.size).toBe(0);
    overlay.destroy();
  });

  it('그림이 없는 경계도 오류 없이 그린다', () => {
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setBoundary(boundary({ image: null, t: 0.3 }));
    expect(() => tick()).not.toThrow();
    expect(drawCalls('drawImage')).toBe(0);
    expect(drawCalls('fill')).toBeGreaterThan(0);
    overlay.destroy();
  });

  it('그림이 있으면 가면 캔버스에 흔들어 얹는다', () => {
    const image = document.createElement('img');
    Object.defineProperty(image, 'complete', { value: true });
    Object.defineProperty(image, 'naturalWidth', { value: 1280 });
    Object.defineProperty(image, 'naturalHeight', { value: 720 });
    const overlay = createExperienceOverlay(canvas)!;
    // t .1이면 q가 1에 가까워 그림이 드러나 있다
    overlay.setBoundary(boundary({ image, t: 0.1 }));
    tick();
    expect(drawCalls('drawImage')).toBeGreaterThan(0);
    overlay.destroy();
  });

  it('이동 구간(t >= SPLIT)은 헤드를 목적지로 옮겨 그린다', () => {
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setBoundary(boundary({ t: 0.9 }));
    expect(() => tick()).not.toThrow();
    expect(drawCalls('fill')).toBeGreaterThan(0);
    overlay.destroy();
  });

  it('provider가 프레임을 주면 선과 헤드를 그린다', () => {
    const provider = vi.fn(() => timeline);
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setTimeline(provider);
    tick(1000);
    tick(1016);
    expect(provider).toHaveBeenCalledTimes(2);
    const [dt, now] = provider.mock.calls[1] as unknown as [number, number];
    expect(dt).toBeCloseTo(0.016, 3);
    expect(now).toBe(1016);
    expect(drawCalls('stroke')).toBeGreaterThan(0);
    expect(drawCalls('fill')).toBeGreaterThan(0);
    overlay.destroy();
  });

  it('provider가 null을 돌려주면 타임라인을 그리지 않는다', () => {
    const provider = vi.fn(() => null);
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setTimeline(provider);
    tick();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(drawCalls('clearRect')).toBeGreaterThan(0);
    expect(drawCalls('stroke')).toBe(0);
    expect(drawCalls('fill')).toBe(0);
    overlay.destroy();
  });

  it('숨은 문서에서는 루프를 멈추고 다시 보이면 잇는다', () => {
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setTimeline(() => null);
    expect(frames.size).toBe(1);
    setHidden(true);
    expect(frames.size).toBe(0);
    overlay.setBoundary(boundary());
    expect(frames.size).toBe(0);
    setHidden(false);
    expect(frames.size).toBe(1);
    overlay.destroy();
  });

  it('destroy는 루프와 리스너를 걷는다', () => {
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setTimeline(() => null);
    expect(frames.size).toBe(1);
    overlay.destroy();
    expect(frames.size).toBe(0);
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    setHidden(false);
    overlay.setBoundary(boundary());
    expect(frames.size).toBe(0);
  });

  it('DPR은 2를 넘지 않고 창 크기에 맞춘다', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const overlay = createExperienceOverlay(canvas)!;
    expect(canvas.width).toBe(window.innerWidth * 2);
    expect(canvas.height).toBe(window.innerHeight * 2);
    overlay.destroy();
  });
});
