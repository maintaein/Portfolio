// components/blocks/ParticleText — react-bits ParticleText를 부팅 파티클
// 형성으로 개조한 컴포넌트의 단위 테스트. jsdom은 캔버스 2D를 실제로
// 계산하지 않으므로(기본 getContext → null) 여기서는 구조만 고정한다:
// 무엇이 몇 번 호출되는가(글리프 샘플링 1회·rAF 정지 시점), 어떤 상한이
// 걸리는가(파티클 수·DPR), 어떤 값이 하드코딩되지 않고 DOM에서 읽히는가
// (폰트·색). 시각적 결과(픽셀 정합)는 실기기 확인 사항이다(리포트 참고).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
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

const particleTextPath = path.resolve(
  process.cwd(),
  'components/blocks/ParticleText/index.tsx'
);

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
  moveTo: ReturnType<typeof vi.fn>;
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
    moveTo: vi.fn(),
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

// 파티클 경합 브리프(particle-race-brief.md (다)). BootSequence가 tier
// 게이트를 열면 ParticleText는 부모와 같은 커밋에서 마운트된다. 이
// 샘플링 effect가 passive useEffect라면 React가 이를 부모의
// useLayoutEffect(타임라인 생성, t=0에 play() 호출)보다 나중에 돌려서
// particlesRef.current가 아직 null인 채로 play()가 조용히 아무 일도 하지
// 않을 수 있다. 두 번째 경합이다. jsdom의 act()는 layout·passive effect를
// 항상 함께 플러시해서 이 순서 자체를 행동으로 재현할 수 없으므로(리포트의
// jsdom 한계 절 참고), 여기서는 소스에서 effect 종류를 직접 고정한다.
describe('ParticleText 글리프 샘플링은 useLayoutEffect다(파티클 경합 브리프)', () => {
  it('샘플링 effect가 useEffect가 아니라 useLayoutEffect로 선언돼 있다(뮤테이션 (d))', () => {
    const source = readFileSync(particleTextPath, 'utf8');
    const match = source.match(
      /(useLayoutEffect|useEffect)\(\(\) => \{[\s\S]*?getImageData\(0, 0, off\.width, off\.height\)[\s\S]*?\}, \[wordmarkRef, tier, durationMs\]\);/
    );
    expect(match, '샘플링 effect를 찾지 못했다').not.toBeNull();
    // 뮤테이션 (d), useLayoutEffect를 useEffect로 되돌리면 이 캡처 그룹이
    // 'useEffect'가 되어 FAIL한다.
    expect(match![1]).toBe('useLayoutEffect');
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

  // 입자마다 beginPath와 fill을 따로 부르면 프레임당 수백 번의 독립 채우기가
  // 된다. 경로 하나에 모아 한 번만 채우는 것이 남아 있던 끊김의 마지막 원인
  // 이었다. 되돌리면 fill 횟수가 입자 수만큼 늘어 FAIL한다.
  it('한 프레임에 fill을 한 번만 부른다(입자 수에 비례하지 않는다)', () => {
    const ctx = mockWorkingCanvas();
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
    ctx.fill.mockClear();
    ctx.beginPath.mockClear();
    flushOneFrame(0);

    // 입자는 여럿 그렸는데
    expect(ctx.arc.mock.calls.length).toBeGreaterThan(1);
    // 경로를 여는 것도 채우는 것도 한 번씩이다.
    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    // moveTo가 빠지면 원들이 선으로 이어져 글자가 거미줄이 된다.
    expect(ctx.moveTo.mock.calls.length).toBe(ctx.arc.mock.calls.length);
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

    // 파티클 잔소음 브리프 2절. 여백이 scatterPx + 상수가 아니라 최대 산포
    // 거리 + 반지름에서 유도된다(아래 "여백은 최대 산포 거리를 덮는다"
    // describe 참고). high: scatterPx(90)*1.2 + radius(1.4) = 109.4 → box =
    // 200+218.8 = 418.8 → *1.5 = 628.2 → round = 628.
    // 뮤테이션 (h). dprCap 없이 그대로 4를 곱하면 훨씬 큰 값이 되어 FAIL한다.
    expect(canvas.width).toBe(628);
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

    // medium: scatterPx(56)*1.2 + radius(2.8) = 70 → box = 200+140 = 340 → *1.
    expect(canvas.width).toBe(340);
  });
});

// 파티클 잔소음 브리프 2절. "구현 가능하지만 숫자만 올리면 잘린다"는
// 진단에 대한 계약 테스트다. margin이 scatterPx + 상수라는 예전 형태로
// 되돌아가면(뮤테이션 (c)) 산포를 넓힐수록 다시 아슬아슬해진다. 여기서는
// 렌더된 canvas의 left 오프셋(= rect.left - margin)에서 실제 margin을
// 역산해, 그 값이 "최대 산포 거리 + 파티클 반지름"을 항상 덮는지 구조적으로
// 고정한다. jsdom 기본 뷰포트(1024×768)에서는 200×80 rect가 작아 뷰포트
// 상한에 걸리지 않으므로 이 테스트가 유도 공식 자체를 순수하게 검증한다.
describe('ParticleText 여백은 최대 산포 거리와 파티클 반지름을 덮는다', () => {
  it.each([
    ['high', 90, 2] as const,
    ['medium', 56, 4] as const,
  ])('%s tier margin은 scatterPx*1.2 + radius 이상이다, 뮤테이션 (c)·(d)', (tier, scatterPx, sampleStep) => {
    mockWorkingCanvas();
    mockWordmarkRect(200, 80); // rect.left = 100(mockWordmarkRect 기본값)
    const wordmarkRef = renderWithSpan();

    const { getByTestId } = render(
      <ParticleText wordmarkRef={wordmarkRef} tier={tier} durationMs={550} />
    );
    const canvas = getByTestId('particle-name-canvas') as HTMLCanvasElement;

    const margin = 100 - Number.parseFloat(canvas.style.left);
    const targetRadius = (sampleStep * 1.4) / 2;
    const maxScatterDistance = scatterPx * 1.2;

    // 뮤테이션 (c). 여백 유도를 scatterPx + 상수(예: 16)로 되돌리면
    // margin이 이 값보다 작아져 FAIL한다.
    expect(margin).toBeCloseTo(maxScatterDistance + targetRadius, 5);
    // 뮤테이션 (d). scatterPx만 올리고 margin 유도를 그대로 두면(상수
    // 여백) 이 부등식이 깨져 FAIL한다.
    expect(margin).toBeGreaterThanOrEqual(maxScatterDistance + targetRadius - 0.01);
  });

  it('캔버스 크기가 뷰포트를 넘지 않는다(좁은 화면, 뮤테이션 (e))', () => {
    mockWorkingCanvas();
    // rect 폭이 좁은 뷰포트에 육박하게 잡는다.
    mockWordmarkRect(250, 80);
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 300 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 });

    const wordmarkRef = renderWithSpan();
    const { getByTestId } = render(
      <ParticleText wordmarkRef={wordmarkRef} tier="high" durationMs={550} />
    );
    const canvas = getByTestId('particle-name-canvas') as HTMLCanvasElement;

    const boxWidth = Number.parseFloat(canvas.style.width);
    const boxHeight = Number.parseFloat(canvas.style.height);

    // 여백을 그대로 두면(90*1.2+1.4=109.4, 상한 없이) boxWidth가
    // 250+218.8=468.8이 되어 뷰포트(300)를 넘는다. 뮤테이션 (e). 상한을
    // 지우면 아래 두 어서션 중 하나가 FAIL한다.
    expect(boxWidth).toBeLessThanOrEqual(300 + 0.01);
    expect(boxHeight).toBeLessThanOrEqual(200 + 0.01);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
  });

  // 위 두 테스트는 margin 값 자체를 공식과 대조한다. 이 테스트는 한 겹
  // 더 파고들어 실제로 그려지는 파티클 좌표가 캔버스 안에 있는지를 본다.
  // margin 공식이 맞아도 distance 공식(산포 거리)만 따로 넓히면(뮤테이션
  // (d)를 이렇게 해석할 수도 있다) margin 값 대조 테스트는 못 잡는다.
  // 가장 멀리 있는 시점(elapsed=0, 아직 수렴 전)에 그려진 모든 파티클의
  // 원이 canvas.style.width/height 안에 완전히 들어가는지 좌표로 직접
  // 검증한다.
  it('가장 멀리 있는 시점(t=0)에도 파티클이 캔버스 경계 안에서 그려진다, 뮤테이션 (c)·(d)', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect(400, 150);
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    const { getByTestId } = render(
      <ParticleText ref={ref} wordmarkRef={wordmarkRef} tier="high" durationMs={550} />
    );
    const canvas = getByTestId('particle-name-canvas') as HTMLCanvasElement;
    const boxWidth = Number.parseFloat(canvas.style.width);
    const boxHeight = Number.parseFloat(canvas.style.height);

    act(() => {
      ref.current?.play();
    });
    ctx.arc.mockClear();
    flushOneFrame(0);

    expect(ctx.arc.mock.calls.length).toBeGreaterThan(0);
    for (const call of ctx.arc.mock.calls) {
      const [x, y, r] = call as unknown as [number, number, number];
      expect(x - r).toBeGreaterThanOrEqual(-0.01);
      expect(x + r).toBeLessThanOrEqual(boxWidth + 0.01);
      expect(y - r).toBeGreaterThanOrEqual(-0.01);
      expect(y + r).toBeLessThanOrEqual(boxHeight + 0.01);
    }
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

// 베이스라인 교체 후속 브리프 — 덩어리→글자 Y 점프의 진짜 원인은
// actualBoundingBoxDescent가 디센더 없는 대문자(KIM TAEIN)에서 합법적으로
// 정확히 0이 되어 `||` 폴백이 오작동한 것이었다. Range 기반 접근(잉크 박스
// 가정)도 걷어내고 fontBoundingBox*(폰트 메트릭) half-leading 공식으로
// 교체했다. jsdom은 레이아웃도 캔버스 2D도 실제로 계산하지 않으므로, 여기서는
// "어떤 값을 근거로 베이스라인을 잡는가"를 관측 채널로 삼는다 — measureText를
// 스텁해 fontBoundingBoxAscent/Descent를 직접 주고, offCtx.fillText에 넘어간
// y 인자(letterSpacing 미지원 스텁이라 글자마다 개별 호출되고, 세 번째 인자가
// baselineY 그 자체다)가 공식과 정확히 같은지 확인한다. 실제 픽셀이 사람
// 눈에 맞는지는 실기기 확인 사항이다(리포트 참고).
describe('ParticleText — 베이스라인은 폰트 메트릭 half-leading 공식으로 계산된다', () => {
  it('fillText에 넘어간 y가 (off.height-(fontAscent+fontDescent))/2+fontAscent와 정확히 같다 — 뮤테이션 (a)·(b)', () => {
    const ctx = mockWorkingCanvas();
    // line box(= off.height = source.getBoundingClientRect().height): 80.
    mockWordmarkRect(200, 80);
    // fontBoundingBox*(60/10)와 actualBoundingBox*(12/4)를 일부러 다르게
    // 준다 — 새 공식(폰트 메트릭)과 옛 공식(잉크 중앙 정렬)이 서로 다른
    // 값을 내야 뮤테이션 (a)·(b)를 구분해 잡는다.
    ctx.measureText.mockReturnValue({
      width: 100,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4,
      fontBoundingBoxAscent: 60,
      fontBoundingBoxDescent: 10,
    });

    const wordmarkRef = renderWithSpan();
    render(
      <ParticleText wordmarkRef={wordmarkRef} tier="high" durationMs={550} />
    );

    // 새 공식: (80-(60+10))/2+60 = 5+60 = 65.
    const yArgs = ctx.fillText.mock.calls.map((call) => call[2]);
    expect(yArgs.length).toBeGreaterThan(0);
    expect(yArgs.every((y) => y === 65)).toBe(true);

    // 뮤테이션 (a) — actualBoundingBox*로 되돌리면 (80-16)/2+12 = 44가 되어
    // 위 65와 달라 FAIL한다.
    // 뮤테이션 (b) — half-leading 항을 빼고 fontAscent(60)만 쓰면 60이 되어
    // 역시 65와 달라 FAIL한다.
  });
});

describe('ParticleText — actualBoundingBoxDescent가 0이어도(디센더 없는 대문자) 베이스라인이 흔들리지 않는다', () => {
  it('descent 0을 줘도 폰트 메트릭 공식대로 계산된다 — 이번 버그의 정확한 재현, 뮤테이션 (c)', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect(200, 80);
    // actualBoundingBoxDescent를 0으로 준다 — KIM TAEIN처럼 디센더 없는
    // 대문자만 있을 때 실제로 벌어지는 값이다(이번 버그 그 자체). 옛 코드는
    // 이 0을 "값 없음"으로 오인해 `||`가 발동, fontSizePx*0.25로 부풀렸다.
    // fontBoundingBoxDescent(18, 0이 아닌 값)는 그대로 둬 새 공식이 이
    // 합법적 0에 흔들리지 않는지를 확인한다.
    ctx.measureText.mockReturnValue({
      width: 100,
      actualBoundingBoxAscent: 60,
      actualBoundingBoxDescent: 0,
      fontBoundingBoxAscent: 70,
      fontBoundingBoxDescent: 18,
    });

    const wordmarkRef = renderWithSpan();
    render(
      <ParticleText wordmarkRef={wordmarkRef} tier="high" durationMs={550} />
    );

    // 새 공식: (80-(70+18))/2+70 = -4+70 = 66. actualBoundingBoxDescent(0)를
    // 전혀 참조하지 않으므로 이 값이 흔들리지 않는다.
    const yArgs = ctx.fillText.mock.calls.map((call) => call[2]);
    expect(yArgs.length).toBeGreaterThan(0);
    expect(yArgs.every((y) => y === 66)).toBe(true);

    // 뮤테이션 (c) — fontDescent 계산을 다시 actualBoundingBoxDescent(합법적
    // 0) 기준 `||`로 덮으면 0이 falsy라 fontSizePx*0.25로 부풀어 66과 달라
    // FAIL한다 — 이번 버그의 정확한 재현.
  });
});

describe('ParticleText — fontBoundingBox*가 없어도(jsdom 등) 이름이 사라지지 않는다', () => {
  it('폴백 공식으로 베이스라인을 계산하고 play()가 정상적으로 형성을 진행한다 — 뮤테이션 (d)', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect(200, 80);
    // fontSizePx 폴백 분기를 결정적으로 만들기 위해 fontSize를 명시한다
    // (jsdom 기본 computed.fontSize 값에 기대지 않는다).
    const getComputedStyleSpy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({
        color: 'rgb(1, 1, 1)',
        fontWeight: '700',
        fontSize: '80px',
        fontFamily: 'TestFont',
        letterSpacing: 'normal',
      } as unknown as CSSStyleDeclaration);
    // 기본 스텁 measureText는 fontBoundingBoxAscent/Descent를 아예 주지
    // 않는다(undefined) — 실제 jsdom이 이 프로퍼티를 구현하지 않는 상황을
    // 그대로 재현한다. typeof 가드 없이 `||`만으로 처리되므로 별도 가드가
    // 필요 없다.
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

    // 폴백 공식: fontAscent = 80*0.95 = 76, fontDescent = 80*0.25 = 20.
    // baselineY = (80-(76+20))/2+76 = -8+76 = 68. NaN이 아니고 폴백값
    // 그대로 계산됐다는 증거다.
    const yArgs = ctx.fillText.mock.calls.map((call) => call[2]);
    expect(yArgs.length).toBeGreaterThan(0);
    expect(yArgs.every((y) => y === 68)).toBe(true);

    // 뮤테이션 (d) — 폴백을 제거하면 fontBoundingBoxAscent/Descent가
    // undefined인 채로 산술에 쓰여 baselineY가 NaN이 된다. 위 68 비교가
    // FAIL하고, particlesRef의 좌표도 NaN이 되어 이름이 사라지는 것과
    // 같은 실패 모양이다.
    act(() => {
      ref.current?.play();
    });
    expect(rafSpy).toHaveBeenCalled();
    getComputedStyleSpy.mockRestore();
  });
});

// 파티클 이음매 브리프 — 두 그림(뭉친 파티클 vs 안티앨리어싱된 실제 글자)이
// 애초에 다르다는 진단에 대한 세 수단 중 (가): 반지름을 sampleStep에
// 비례시키고 수렴하며 커지게 한다. jsdom은 실제 픽셀을 계산하지 않으므로
// "이웃과 실제로 겹쳐 보이는가"는 증명할 수 없다 — 여기서는 ctx.arc에 넘어간
// 반지름 인자(세 번째 인자) 값 자체를 구조적으로 고정한다.
describe('ParticleText — 파티클 반지름은 sampleStep에 비례하고 수렴하며 커진다', () => {
  function maxRadiusAt(tier: 'high' | 'medium', elapsedMs: number) {
    // 이전 호출이 아직 완료되지 않은 rAF를 다시 예약해 뒀을 수 있다(elapsed가
    // durationMs 전이라 frame()이 스스로를 재예약한다) — 그 잔여 콜백이 이번
    // 호출의 큐 맨 앞에 남아 flushOneFrame이 엉뚱한(이전 tier의) 콜백을 집는
    // 것을 막는다. 마운트된 이전 컴포넌트도 함께 정리한다.
    cleanup();
    rafCallbacks = [];

    const ctx = mockWorkingCanvas();
    mockWordmarkRect(400, 150);
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    render(
      <ParticleText ref={ref} wordmarkRef={wordmarkRef} tier={tier} durationMs={200} />
    );

    act(() => {
      ref.current?.play();
    });
    ctx.arc.mockClear();
    flushOneFrame(elapsedMs);

    const radii = ctx.arc.mock.calls.map((call) => call[2] as number);
    expect(radii.length, `${tier} tier에서 arc 호출이 없다`).toBeGreaterThan(0);
    return Math.max(...radii);
  }

  it('medium(간격 4px)의 반지름이 high(간격 2px)보다 크고, 지름/간격 비율이 1.3~1.5 범위 안이다 — 뮤테이션 (a)·(b)', () => {
    const highMax = maxRadiusAt('high', 199); // durationMs(200) 직전 — 수렴 거의 완료
    const mediumMax = maxRadiusAt('medium', 199);

    // 뮤테이션 (a) — 다시 고정 반지름(예: 1.6px 그대로)으로 되돌리면 두
    // tier가 같은 값이 되어 FAIL한다.
    expect(mediumMax).toBeGreaterThan(highMax);

    // 뮤테이션 (b) — sampleStep과 무관한 공식으로 바꾸면(예: 항상 2px)
    // 아래 비율(지름/간격) 중 최소 하나가 1.3~1.5 범위를 벗어나 FAIL한다.
    const highRatio = (highMax * 2) / 2; // 지름 / high의 sampleStep(2)
    const mediumRatio = (mediumMax * 2) / 4; // 지름 / medium의 sampleStep(4)
    for (const ratio of [highRatio, mediumRatio]) {
      expect(ratio).toBeGreaterThanOrEqual(1.3);
      expect(ratio).toBeLessThanOrEqual(1.5);
    }
  });

  it('출발 시 작게, 수렴하며 최종 반지름까지 커진다 — 뮤테이션 (c)', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect(400, 150);
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    render(
      <ParticleText ref={ref} wordmarkRef={wordmarkRef} tier="medium" durationMs={200} />
    );

    act(() => {
      ref.current?.play();
    });

    // 같은 파티클(배열 순서가 고정이므로 매 프레임 첫 arc 호출은 항상
    // particles[0])의 반지름을 초반과 종료 직전 두 시점에서 비교한다.
    ctx.arc.mockClear();
    flushOneFrame(0);
    const earlyRadius = ctx.arc.mock.calls[0]?.[2] as number;

    ctx.arc.mockClear();
    flushOneFrame(199);
    const lateRadius = ctx.arc.mock.calls[0]?.[2] as number;

    // 뮤테이션 (c) — 처음부터 최종 크기로 고정하면(수렴 진행에 따른 증가를
    // 제거하면) 두 값이 같아져 FAIL한다.
    expect(lateRadius).toBeGreaterThan(earlyRadius);
    expect(earlyRadius).toBeGreaterThan(0);
    // 출발 크기는 최종 크기의 절반 아래여야 한다(START_RADIUS_RATIO=0.4).
    expect(earlyRadius).toBeLessThan(lateRadius * 0.6);
  });
});

// 파티클 잔소음 브리프 1절. 예전엔 이음매 구간(seamMs) 매 프레임 opacity·
// filter를 다시 계산하고 수백 개 arc()도 계속 그렸다. 이제는 그 구간에
// 들어가는 첫 프레임에서 캔버스를 한 번만 최종 상태로 그리고 rAF를 멈춘 뒤,
// 사라지는 연출은 CSS transition 선언 하나에 맡긴다. jsdom은 실제 합성·
// transition 진행을 계산하지 않으므로 여기서는 "그 프레임에서 인라인 값이
// 즉시 최종값으로 굳는가"와 "그 뒤로 더 이상 rAF가 돌지 않는가"를 구조적으로
// 고정한다. transition이 실제로 부드럽게 보이는지는 실기기 확인 사항이다.
describe('ParticleText 이음매 완화(seamMs)는 마지막 프레임에서 굳히고 CSS transition에 맡긴다', () => {
  it('겹침 구간 진입 프레임에서 최종 상태로 굳히고 rAF를 멈춘다, 뮤테이션 (a)·(b)', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect();
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    const { getByTestId } = render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={200}
        seamMs={40}
      />
    );
    const canvas = getByTestId('particle-name-canvas') as HTMLCanvasElement;

    act(() => {
      ref.current?.play();
    });

    // 겹침 구간(seamStart = 200 - 40 = 160) 전이다. 아직 손대지 않았고
    // 다음 프레임이 정상적으로 재예약된다(진행 중).
    flushOneFrame(100);
    expect(canvas.style.opacity).toBe('');
    expect(canvas.style.filter).toBe('');
    expect(canvas.style.transition).toBe('');
    expect(rafSpy).toHaveBeenCalledTimes(2); // 최초 예약 + 이번 프레임의 재예약

    // 겹침 구간 진입(180), 이 프레임이 마지막이다. 뮤테이션 (a). 다시
    // 매 프레임 블러 반경을 쓰게 되돌리면(seamProgress 기반 중간값 갱신을
    // 되살리면) 아래 opacity·filter가 이미 최종값이라는 어서션과
    // transition 선언 자체가 없다는 구 코드의 모양이 어긋나 FAIL한다.
    const rafCallsBeforeSeam = rafSpy.mock.calls.length;
    flushOneFrame(180);
    expect(canvas.style.opacity).toBe('0');
    expect(canvas.style.filter).toBe('blur(3px)');
    expect(canvas.style.transition).toMatch(/opacity 40ms/);
    expect(canvas.style.transition).toMatch(/filter 40ms/);

    // 뮤테이션 (b). 이음매에서 rAF를 계속 돌게 하면 이 프레임에서도 새
    // rAF가 예약돼 아래 개수가 늘어나 FAIL한다.
    expect(rafSpy.mock.calls.length).toBe(rafCallsBeforeSeam);
    expect(ctx.arc).toHaveBeenCalled(); // 마지막 한 번은 여전히 그린다.
  });

  it('겹침 구간 진입 프레임은 목표 위치·최종 반지름으로 그린다(더 이상 eased 보간을 계산하지 않는다), 뮤테이션 (a)', () => {
    const ctx = mockWorkingCanvas();
    mockWordmarkRect(400, 150);
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    render(
      <ParticleText
        ref={ref}
        wordmarkRef={wordmarkRef}
        tier="high"
        durationMs={200}
        seamMs={40}
      />
    );

    act(() => {
      ref.current?.play();
    });
    ctx.arc.mockClear();
    flushOneFrame(180); // 겹침 구간 진입

    // targetRadius = sampleStep(2)*1.4/2 = 1.4. 모든 arc 호출의 반지름이
    // 이 값 하나로 고정된다. 파티클마다 다른 eased 값을 계산해 반지름을
    // 보간하던 구 코드였다면 이 값들이 서로 달랐을 것이다.
    const radii = ctx.arc.mock.calls.map((call) => call[2] as number);
    expect(radii.length).toBeGreaterThan(0);
    expect(radii.every((r) => r === 1.4)).toBe(true);
  });

  it('seamMs를 넘기지 않으면(기본값 0) 형성 완료까지 opacity·filter·transition을 건드리지 않는다(회귀 안전망)', () => {
    mockWorkingCanvas();
    mockWordmarkRect();
    const wordmarkRef = renderWithSpan();
    const ref = createRef<ParticleTextHandle>();

    const { getByTestId } = render(
      <ParticleText ref={ref} wordmarkRef={wordmarkRef} tier="high" durationMs={100} />
    );
    const canvas = getByTestId('particle-name-canvas') as HTMLCanvasElement;

    act(() => {
      ref.current?.play();
    });
    flushOneFrame(50);
    expect(canvas.style.opacity).toBe('');

    flushOneFrame(150); // durationMs(100) 이후 — 완료 분기
    expect(canvas.style.opacity).toBe('');
    expect(canvas.style.filter).toBe('');
    expect(canvas.style.transition).toBe('');
  });
});
