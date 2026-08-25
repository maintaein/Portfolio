// components/blocks/ClickSpark — react-bits ClickSpark를 START 클릭 반응으로
// 개조한 컴포넌트의 단위 테스트. 핵심 개조점: 스파크가 없으면 rAF를
// 멈춘다(원본은 idle에도 영원히 돈다), sparkColor는 CSS 커스텀 프로퍼티를
// getComputedStyle로 해석한 값을 쓴다(var() 문자열을 canvas가 못 읽으므로).
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import ClickSpark from '@/components/blocks/ClickSpark';

interface StubContext {
  clearRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  strokeStyle: string;
  lineWidth: number;
}

function createStubContext(): StubContext {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
  };
}

let rafCallbacks: FrameRequestCallback[] = [];
let rafId = 0;
let rafSpy: MockInstance<typeof window.requestAnimationFrame>;

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
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  // handleClick이 performance.now()로 스파크의 startTime을 잡고, draw가
  // 각 프레임 timestamp와의 차로 경과시간을 계산한다. 0으로 고정해
  // flushOneFrame(timestamp)의 인자 자체가 곧 경과시간이 되게 한다(위
  // ParticleText.test.tsx와 같은 이유).
  vi.spyOn(performance, 'now').mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClickSpark — sparkColor는 CSS 변수를 해석한 값을 쓴다', () => {
  it('--color-cyan-hi를 getComputedStyle로 읽어 strokeStyle에 쓴다', () => {
    const ctx = createStubContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) =>
        name === '--color-cyan-hi' ? ' #7fe3ee ' : '',
    } as unknown as CSSStyleDeclaration);

    render(
      <ClickSpark sparkColorVar="--color-cyan-hi" sparkColorFallback="#000000">
        <button data-testid="target">START</button>
      </ClickSpark>
    );

    const wrapper = screen.getByTestId('target').parentElement as HTMLElement;
    fireEvent.click(wrapper, { clientX: 5, clientY: 5 });
    flushOneFrame(0);

    // 뮤테이션 (p) — sparkColorFallback으로 하드코딩하면(getComputedStyle을
    // 안 읽으면) '#000000'이 나와 FAIL한다.
    expect(ctx.strokeStyle).toBe('#7fe3ee');
  });
});

describe('ClickSpark — idle이면 rAF를 돌지 않는다', () => {
  it('마운트 직후에는 rAF를 예약하지 않는다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      createStubContext() as unknown as CanvasRenderingContext2D
    );
    render(
      <ClickSpark>
        <button data-testid="target">START</button>
      </ClickSpark>
    );
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('클릭하면 rAF가 시작되고, 스파크가 모두 사라지면(duration 경과) 멈춘다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      createStubContext() as unknown as CanvasRenderingContext2D
    );
    render(
      <ClickSpark duration={100}>
        <button data-testid="target">START</button>
      </ClickSpark>
    );
    const wrapper = screen.getByTestId('target').parentElement as HTMLElement;

    fireEvent.click(wrapper, { clientX: 5, clientY: 5 });
    expect(rafSpy).toHaveBeenCalledTimes(1);

    flushOneFrame(0); // startTime 기준점
    expect(rafSpy).toHaveBeenCalledTimes(2); // 스파크가 아직 살아 있다

    flushOneFrame(150); // duration(100)을 넘겼다 — 모든 스파크 소멸
    // 스파크가 다 사라졌으므로 다음 프레임을 더 예약하지 않는다.
    expect(rafSpy).toHaveBeenCalledTimes(2);

    // 다시 클릭하면 idle에서 새로 루프가 시작된다.
    fireEvent.click(wrapper, { clientX: 5, clientY: 5 });
    expect(rafSpy).toHaveBeenCalledTimes(3);
  });
});

describe('ClickSpark — 자식을 그대로 렌더한다', () => {
  it('children이 DOM에 그대로 존재한다', () => {
    render(
      <ClickSpark>
        <button data-testid="target">START</button>
      </ClickSpark>
    );
    expect(screen.getByTestId('target')).toHaveTextContent('START');
  });
});
