import { act, render, waitFor } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import Cubes from '@/components/blocks/Cubes';

// BootSequenceGsapLoad.test.tsx와 같은 패턴이다. Cubes도 더 이상 '@/lib/gsap'을
// 정적으로 참조하지 않고 effect 안의 동적 import뿐이므로, 매 테스트가
// vi.resetModules() + vi.doMock()으로 그 동적 import 하나만 원하는 대로
// 바꿔치기한다.
const attempted = vi.fn();
const toFn = vi.fn();
const registerGsapFn = vi.fn();

function mockGsapSuccess() {
  vi.doMock('@/lib/gsap', () => {
    attempted();
    return {
      gsap: { to: toFn },
      registerGsap: registerGsapFn,
      Flip: {},
      SITE_EASE: 'site',
    };
  });
}

function stubViewport(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '',
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  );
}

// ParticleText.test.tsx와 같은 패턴이다. 장식 테스트는 실제 프레임을 돌리지
// 않는다. rAF를 큐로 흉내 내고 flushOneFrame으로 원하는 시점에만 콜백을
// 튀긴다.
let rafCallbacks: FrameRequestCallback[] = [];
let rafId = 0;
let rafSpy: MockInstance<typeof window.requestAnimationFrame>;
let cancelSpy: MockInstance<typeof window.cancelAnimationFrame>;

function flushOneFrame(timestamp = 0) {
  const cb = rafCallbacks.shift();
  act(() => {
    cb?.(timestamp);
  });
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.resetModules();
  attempted.mockClear();
  toFn.mockClear();
  registerGsapFn.mockClear();
  stubViewport(false);

  rafCallbacks = [];
  rafId = 0;
  rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallbacks.push(cb);
    rafId += 1;
    return rafId;
  });
  cancelSpy = vi
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(() => {});
});

afterEach(() => {
  vi.doUnmock('@/lib/gsap');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Cubes 접근성', () => {
  it('격자 자체는 aria-hidden이다', () => {
    const { container } = render(<Cubes gridSize={4} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveAttribute('aria-hidden', 'true');
  });

  it('보라 기운 색이 없다', () => {
    const { container } = render(<Cubes gridSize={4} />);
    expect(container.innerHTML.toLowerCase()).not.toContain('120f17');
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.getPropertyValue('--cube-face-bg')).toBe('#000000');
  });
});

describe('Cubes GSAP 게이팅', () => {
  it('paused면 idle 루프의 rAF를 걸지 않는다', async () => {
    mockGsapSuccess();
    const { rerender } = render(
      <Cubes gridSize={4} shouldLoad paused={false} />
    );
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(rafSpy).toHaveBeenCalled());

    rafSpy.mockClear();
    cancelSpy.mockClear();
    rerender(<Cubes gridSize={4} shouldLoad paused />);

    // paused로 바뀐 커밋의 effect 클린업이 예약돼 있던 프레임을 취소하고,
    // paused가 true인 새 effect 실행은 새 프레임을 걸지 않는다.
    expect(cancelSpy).toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('선택 전에는 장식 청크를 load하지 않고, 선택 뒤 재방문에도 같은 인스턴스를 유지한다', async () => {
    mockGsapSuccess();
    const { rerender } = render(
      <Cubes gridSize={4} shouldLoad={false} paused />
    );
    await flushMicrotasks();
    expect(attempted).not.toHaveBeenCalled();

    rerender(<Cubes gridSize={4} shouldLoad paused={false} />);
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));

    // 재방문. About을 벗어났다(paused=true) 돌아온다(paused=false).
    // shouldLoad는 WhenVisible 안에서 한 번 켜지면 계속 true로 남으므로 여기도
    // true로 유지한다. 다시 import를 시도하면 안 된다.
    rerender(<Cubes gridSize={4} shouldLoad paused />);
    rerender(<Cubes gridSize={4} shouldLoad paused={false} />);
    await flushMicrotasks();
    expect(attempted).toHaveBeenCalledTimes(1);
  });

  it('motion preference 준비 전과 reduced-motion에서는(shouldLoad가 false로 남는다) dynamic import·rAF가 모두 0회다', async () => {
    mockGsapSuccess();
    render(<Cubes gridSize={4} shouldLoad={false} paused={false} />);
    await flushMicrotasks();
    expect(attempted).not.toHaveBeenCalled();
    expect(rafSpy).not.toHaveBeenCalled();
  });
});

describe('Cubes 성능', () => {
  it('큐브 원소를 한 번만 캐시하고 프레임마다 querySelectorAll을 다시 돌리지 않는다', async () => {
    mockGsapSuccess();
    const querySpy = vi.spyOn(Element.prototype, 'querySelectorAll');
    render(<Cubes gridSize={4} shouldLoad paused={false} />);
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(rafSpy).toHaveBeenCalled());

    // 캐시를 채우는 마운트 effect는 이미 끝났다. 여기부터는 프레임당 호출만 센다.
    querySpy.mockClear();
    flushOneFrame(0);
    flushOneFrame(16);
    flushOneFrame(32);

    const cubeQueries = querySpy.mock.calls.filter(
      ([selector]) => selector === '.cube'
    );
    expect(cubeQueries).toHaveLength(0);
  });

  it('모바일 뷰포트(max-width: 1023px)에서는 idle 애니메이션 rAF를 걸지 않는다', async () => {
    mockGsapSuccess();
    stubViewport(true);
    render(<Cubes gridSize={4} shouldLoad paused={false} />);
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));
    await flushMicrotasks();
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
