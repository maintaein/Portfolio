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
        target[key] = key === 'createRadialGradient' || key === 'createLinearGradient' ? vi.fn(() => ({ addColorStop: vi.fn() }))
          : key === 'measureText' ? vi.fn(() => ({ width: 10, fontBoundingBoxAscent: 40, fontBoundingBoxDescent: 10 })) : vi.fn();
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
    font: '700 56px sans-serif',
    letters: [...'PoseTive'].map((ch, i) => ({ ch, x: 1000 + 30 * i, y: 300, k: i })),
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

  // contexts: [화면, 액체]. 액체 캔버스는 처음 모일 때 만든다.
  it('글자는 액체 캔버스에 처음에는 제자리 그대로 그리고, 필터를 건다', () => {
    const parent = document.createElement('div');
    parent.append(canvas);
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setBoundary(boundary({ t: 0.01 }));
    tick();
    const texts = contexts[1].fillText.mock.calls;
    expect(texts.map(c => c[0]).join('')).toBe('PoseTive');
    const goo = parent.querySelector('canvas:not(:last-child)') as HTMLCanvasElement;
    expect(goo.style.filter).toContain('url(#experience-goo)');
    const filter = parent.querySelector('filter#experience-goo')!;
    // 액체 캔버스는 화면 전체가 아니라 글자 무리 상자(x 1000~1210, y 300)에 글자 높이(40)와 헤드 지름(32)을 더해,
    // DPR 1에서 8px 칸에 맞춘 크기(928~1288, 224~376)로 그 자리에 선다. 필터 영역도 한 칸 밖까지 px로 잡는다.
    expect([goo.style.width, goo.style.height, goo.style.transform]).toEqual(['360px', '152px', 'translate(928px, 224px)']);
    expect([goo.width, goo.height]).toEqual([360, 152]);
    expect(['x', 'y', 'width', 'height'].map(k => filter.getAttribute(k))).toEqual(['-8', '-8', '376', '168']);
    overlay.destroy();
    expect(parent.children).toHaveLength(1);
  });

  it('다 녹은 뒤에는 글자 대신 방울과 헤드를 그린다', () => {
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setBoundary(boundary({ t: 0.8 }));
    tick();
    expect(contexts[1].fillText).not.toHaveBeenCalled();
    expect(contexts[1].ellipse).toHaveBeenCalled();
    expect(drawCalls('arc')).toBeGreaterThan(0);
    overlay.destroy();
  });

  it('글자가 없는 경계는 아무것도 그리지 않고 오류도 없다', () => {
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setBoundary(boundary({ letters: [] }));
    expect(() => tick()).not.toThrow();
    expect(contexts).toHaveLength(1);
    overlay.destroy();
  });

  it('경계가 비면 액체 캔버스를 지우고 필터를 걷는다', () => {
    const parent = document.createElement('div');
    parent.append(canvas);
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setBoundary(boundary());
    tick();
    const goo = parent.querySelector('canvas:not(:last-child)') as HTMLCanvasElement;
    expect(goo.style.filter).not.toBe('');
    overlay.setBoundary(null);
    expect(goo.style.filter).toBe('');
    expect(contexts[1].clearRect.mock.calls.length).toBeGreaterThan(1);
    overlay.destroy();
  });

  it('도착(t 1)한 헤드는 타임라인의 첫 헤드가 살 때까지 그리고, 살면 경계를 비운다', () => {
    const none = { ...timeline, segments: [], heads: timeline.heads.map(h => ({ ...h, r: 0, current: false })) };
    let frame: TimelineFrame = none;
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setTimeline(() => frame);
    overlay.setBoundary(boundary({ t: 1 }));
    tick();
    expect(drawCalls('fill')).toBeGreaterThan(0);
    // 첫 헤드가 살면 경계를 비운다. 그 뒤 타임라인을 걷으면 그릴 것이 없어 멈춘다.
    frame = timeline;
    tick();
    overlay.setTimeline(null);
    expect(frames.size).toBe(0);
    overlay.destroy();
  });

  it('타임라인이 없으면 도착(t 1)한 경계를 그리지 않고 비운다', () => {
    const overlay = createExperienceOverlay(canvas)!;
    overlay.setBoundary(boundary({ t: 1 }));
    tick();
    expect(drawCalls('fill')).toBe(0);
    expect(frames.size).toBe(0);
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

  it('비트맵은 창(innerWidth)이 아니라 캔버스 상자(고전 스크롤바를 뺀 clientWidth)에 맞추고, 상자가 바뀌면 다시 잰다', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    let observe: ResizeObserverCallback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { observe = callback; } observe() {} unobserve() {} disconnect = disconnect; });
    // Windows 크롬의 고전 스크롤바(15px)가 100% 폭에서 빠진다
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: window.innerWidth - 15 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: window.innerHeight });
    const overlay = createExperienceOverlay(canvas)!;
    expect(canvas.width).toBe((window.innerWidth - 15) * 2);
    expect(canvas.height).toBe(window.innerHeight * 2);
    // 스크롤바가 사라지면 창 resize 없이 상자만 넓어진다
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: window.innerWidth });
    observe([], {} as ResizeObserver);
    expect(canvas.width).toBe(window.innerWidth * 2);
    overlay.destroy();
    expect(disconnect).toHaveBeenCalled();
  });
});
