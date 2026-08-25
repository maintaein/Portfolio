// components/blocks/ParticleText — react-bits ParticleText를 부팅 파티클
// 형성으로 개조한 컴포넌트의 단위 테스트. jsdom은 캔버스 2D를 실제로
// 계산하지 않으므로(기본 getContext → null) 여기서는 구조만 고정한다:
// 무엇이 몇 번 호출되는가(글리프 샘플링 1회·rAF 정지 시점), 어떤 상한이
// 걸리는가(파티클 수·DPR), 어떤 값이 하드코딩되지 않고 DOM에서 읽히는가
// (폰트·색). 시각적 결과(픽셀 정합)는 실기기 확인 사항이다(리포트 참고).
import { createRef } from 'react';
import { act, render } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import ParticleText, {
  type ParticleTextHandle,
} from '@/components/blocks/ParticleText';

// getImageData가 돌려줄 가짜 이미지 데이터 — 모든 픽셀을 완전 불투명(alpha
// 255)으로 채운다. "글자 형태"의 실제 모양은 jsdom에서 증명할 수 없으므로,
// 여기서는 "샘플링 격자 안의 모든 후보가 글자로 판정된 경우에도 최종
// 파티클 수는 tier 상한을 넘지 않는다"는 최악의 경우를 검증한다.
function buildOpaqueImageData(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { data };
}

interface StubContext {
  clearRect: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
  font: string;
  fillStyle: string;
  textBaseline: string;
}

function createStubContext(): StubContext {
  return {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4,
    })),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) =>
      buildOpaqueImageData(w, h)
    ),
    font: '',
    fillStyle: '',
    textBaseline: '',
  };
}

// 캔버스 하나(보이는 캔버스)와 오프스크린 캔버스 하나, 둘 다 같은 mock
// getContext를 거친다 — 이 저장소가 실제로 두 캔버스 모두 2d 컨텍스트를
// 요구하므로 하나의 스텁으로 충분하다(둘의 메서드 호출이 서로 섞여도
// 무해하다 — 상태를 공유하지 않는 순수 draw 호출들이다).
function mockWorkingCanvas() {
  const ctx = createStubContext();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  return ctx;
}

function mockWordmarkRect(width = 200, height = 80) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    left: 100,
    top: 50,
    right: 100 + width,
    bottom: 50 + height,
    x: 100,
    y: 50,
    toJSON: () => {},
  });
}

function renderWithSpan(text = 'KIM TAEIN') {
  const wordmarkRef = createRef<HTMLButtonElement>();
  function Harness() {
    return (
      <button ref={wordmarkRef}>
        <span>{text}</span>
      </button>
    );
  }
  render(<Harness />);
  return wordmarkRef;
}

let rafCallbacks: FrameRequestCallback[] = [];
let rafId = 0;
let rafSpy: MockInstance<typeof window.requestAnimationFrame>;
let cancelSpy: MockInstance<typeof window.cancelAnimationFrame>;

function flushOneFrame(timestamp: number) {
  const cb = rafCallbacks.shift();
  act(() => {
    cb?.(timestamp);
  });
}

beforeEach(() => {
  rafCallbacks = [];
  rafId = 0;
  rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallbacks.push(cb);
    rafId += 1;
    return rafId;
  });
  cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  // play()는 performance.now()로 시작 시각을 잡고 각 프레임의 timestamp와의
  // 차로 경과시간을 계산한다. 실제 performance.now()를 그대로 두면 매
  // 테스트마다 start 값이 달라 flushOneFrame(150) 같은 리터럴 timestamp가
  // "150ms 경과"를 뜻하지 않게 된다 — 0으로 고정해 timestamp 인자 자체가
  // 곧 경과시간이 되게 한다.
  vi.spyOn(performance, 'now').mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ParticleText — 접근성·순수 장식', () => {
  it('캔버스는 aria-hidden이고 pointer-events-none이다 — 뮤테이션 (c)', () => {
    const wordmarkRef = renderWithSpan();
    const { getByTestId } = render(
      <ParticleText wordmarkRef={wordmarkRef} tier="high" durationMs={550} />
    );
    const canvas = getByTestId('particle-name-canvas');
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas.className).toContain('pointer-events-none');
  });
});

describe('ParticleText — 캔버스 미지원(getContext null) 폴백', () => {
  it('play()를 불러도 rAF가 생기지 않는다 — 조용히 아무 일도 없다', () => {
    // beforeEach가 별도로 getContext를 손대지 않으므로 jsdom 기본값(null)이
    // 그대로 적용된다.
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();
    render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={550}
      />
    );

    act(() => {
      ref.current?.play();
    });
    expect(rafSpy).not.toHaveBeenCalled();
  });
});

describe('ParticleText — 글리프 샘플링은 1회만', () => {
  it('마운트 시 getImageData를 정확히 1번 부르고, play() 재생 중에는 다시 부르지 않는다 — 뮤테이션 (j)', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect();
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={200}
      />
    );
    expect(ctx.getImageData).toHaveBeenCalledTimes(1);

    act(() => {
      ref.current?.play();
    });
    // 여러 프레임을 진행시킨다 — 매 프레임 getImageData가 다시 불리면 안 된다.
    flushOneFrame(0);
    flushOneFrame(50);
    flushOneFrame(120);

    expect(ctx.getImageData).toHaveBeenCalledTimes(1);
  });
});

describe('ParticleText — 파티클 수 상한(tier별)', () => {
  it('high tier는 480개를 넘지 않는다', () => {
    const ctx = mockWorkingCanvas();
    // 넓게 잡아 후보(alpha>60 픽셀)가 상한보다 훨씬 많이 나오게 한다.
    mockWordmarkRect(400, 150);
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={550}
      />
    );

    act(() => {
      ref.current?.play();
    });
    ctx.arc.mockClear();
    flushOneFrame(0);

    // 뮤테이션 (g) — 상한을 제거하면 이 값이 수천 개로 치솟아 FAIL한다.
    expect(ctx.arc.mock.calls.length).toBeGreaterThan(0);
    expect(ctx.arc.mock.calls.length).toBeLessThanOrEqual(480);
  });

  it('medium tier는 220개를 넘지 않는다 — high보다 보수적이다', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect(400, 150);
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="medium"
        durationMs={550}
      />
    );

    act(() => {
      ref.current?.play();
    });
    ctx.arc.mockClear();
    flushOneFrame(0);

    expect(ctx.arc.mock.calls.length).toBeGreaterThan(0);
    expect(ctx.arc.mock.calls.length).toBeLessThanOrEqual(220);
  });
});

describe('ParticleText — 캔버스 DPR 제한', () => {
  it('기기 DPR을 그대로 쓰지 않고 tier 상한(high=1.5)으로 자른다 — 뮤테이션 (h)', () => {
    mockWorkingCanvas();
    mockWordmarkRect(200, 80);
    vi.stubGlobal('devicePixelRatio', 4);
    const wordmarkRef = renderWithSpan();

    const { getByTestId } = render(
      <ParticleText wordmarkRef={wordmarkRef} tier="high" durationMs={550} />
    );
    const canvas = getByTestId('particle-name-canvas') as HTMLCanvasElement;

    // margin = scatterPx(64) + 16 = 80 → box = 200+160 = 360 → *1.5 = 540.
    // 뮤테이션 (h) — dprCap 없이 그대로 4를 곱하면 1440이 되어 FAIL한다.
    expect(canvas.width).toBe(540);
    expect(canvas.width).toBeLessThan(200 * 4);
  });

  it('medium tier는 DPR을 1로 자른다', () => {
    mockWorkingCanvas();
    mockWordmarkRect(200, 80);
    vi.stubGlobal('devicePixelRatio', 3);
    const wordmarkRef = renderWithSpan();

    const { getByTestId } = render(
      <ParticleText wordmarkRef={wordmarkRef} tier="medium" durationMs={550} />
    );
    const canvas = getByTestId('particle-name-canvas') as HTMLCanvasElement;

    // margin = scatterPx(40) + 16 = 56 → box = 200+112 = 312 → *1 = 312.
    expect(canvas.width).toBe(312);
  });
});

describe('ParticleText — 형성은 1회성이다(rAF 정지)', () => {
  it('durationMs가 지나면 rAF를 더 이상 예약하지 않고 캔버스를 비운다 — 뮤테이션 (i)·(k)', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect();
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={100}
      />
    );

    act(() => {
      ref.current?.play();
    });
    expect(rafSpy).toHaveBeenCalledTimes(1);

    flushOneFrame(0); // start
    expect(rafSpy).toHaveBeenCalledTimes(2); // 진행 중이므로 다음 프레임을 예약한다

    ctx.clearRect.mockClear();
    flushOneFrame(150); // durationMs(100)를 넘겼다 — 이번이 마지막 프레임이어야 한다

    // 뮤테이션 (i) — 완료 후에도 계속 rAF를 예약하면 이 값이 3이 되어 FAIL한다.
    expect(rafSpy).toHaveBeenCalledTimes(2);
    // 뮤테이션 (k) — 완료 뒤 캔버스를 비우지 않으면(clearRect 미호출) FAIL한다.
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('재생 중에는 play()를 다시 불러도 두 번째 루프를 만들지 않는다', () => {
    mockWorkingCanvas();
    mockWordmarkRect();
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={550}
      />
    );

    act(() => {
      ref.current?.play();
      ref.current?.play();
      ref.current?.play();
    });

    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it('언마운트 시 진행 중이던 rAF를 취소한다', () => {
    mockWorkingCanvas();
    mockWordmarkRect();
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    const { unmount } = render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={550}
      />
    );

    act(() => {
      ref.current?.play();
    });
    expect(cancelSpy).not.toHaveBeenCalled();

    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });
});

describe('ParticleText — 폰트·색을 DOM에서 읽는다(하드코딩 금지)', () => {
  it('워드마크의 실제 색으로 파티클을 그린다', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect();
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    const getComputedStyleSpy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({
        color: 'rgb(9, 9, 9)',
        fontWeight: '700',
        fontSize: '80px',
        fontFamily: 'TestFont',
        letterSpacing: '4px',
      } as unknown as CSSStyleDeclaration);

    render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={550}
      />
    );

    act(() => {
      ref.current?.play();
    });
    flushOneFrame(0);

    // 뮤테이션(자가 발견) — 색을 팔레트 상수 등으로 하드코딩하면 이 값이
    // 'rgb(9, 9, 9)'와 달라져 FAIL한다.
    expect(ctx.fillStyle).toBe('rgb(9, 9, 9)');
    getComputedStyleSpy.mockRestore();
  });

  it('워드마크 버튼에 span이 없으면(테스트 하네스처럼) 버튼 자신으로 폴백한다', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect();
    const wordmarkRef = createRef<HTMLButtonElement>();
    function PlainHarness() {
      return <button ref={wordmarkRef}>PLAIN</button>;
    }
    render(<PlainHarness />);

    expect(() =>
      render(
        <ParticleText wordmarkRef={wordmarkRef} tier="high" durationMs={550} />
      )
    ).not.toThrow();
    expect(ctx.getImageData).toHaveBeenCalledTimes(1);
  });
});
