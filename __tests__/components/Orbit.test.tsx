import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Orbit from '@/components/blocks/Orbit';

// Cubes.test.tsx(계획 4 Task 2)와 같은 패턴이다. Orbit도 '@/lib/gsap'을
// 정적으로 참조하지 않고 effect 안의 동적 import뿐이므로, 매 테스트가
// vi.resetModules() + vi.doMock()으로 그 동적 import 하나만 바꿔치기한다.
// Cubes와 달리 Orbit은 idle 루프가 rAF가 아니라 GSAP tween(gsap.to +
// motionPath)이라 kill 가능한 여부로 "궤도가 돈다/멈춘다"를 본다.
const attempted = vi.fn();
const toFn = vi.fn();
const setFn = vi.fn();
const killFn = vi.fn();
const registerGsapFn = vi.fn();

function mockGsapSuccess() {
  vi.doMock('@/lib/gsap', () => {
    attempted();
    return {
      gsap: { to: toFn, set: setFn },
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

beforeEach(() => {
  vi.resetModules();
  attempted.mockClear();
  toFn.mockClear();
  setFn.mockClear();
  killFn.mockClear();
  registerGsapFn.mockClear();
  toFn.mockReturnValue({ kill: killFn });
  stubViewport(false);

  // jsdom에 ResizeObserver가 없다. responsive 스케일링(useLayoutEffect)이
  // 매 렌더 돌 수 있게 최소 구현만 스텁한다. Cubes에는 없는 부분이다.
  // Orbit은 원본의 :209-219 responsive 스케일링을 그대로 옮겨왔다.
  class StubResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
  }
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
});

afterEach(() => {
  vi.doUnmock('@/lib/gsap');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Orbit 접근성', () => {
  it('궤도 전체가 aria-hidden이다', () => {
    const { container } = render(<Orbit />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-hidden', 'true');
  });

  it('아이콘 3개만 렌더한다(Eye·CursorArrowRays·HandRaised)', () => {
    // EmpathyRadar의 8개(Heart·Star·Smile·LightBulb·CheckCircle 포함) 중
    // 셋만 남는다. 되돌리면(뮤테이션 h) 이 카운트가 깨진다.
    const { container } = render(<Orbit />);
    expect(container.querySelectorAll('[data-orbit-item]')).toHaveLength(3);
  });

  // 자체 고안 뮤테이션으로 발견한 구멍. 링(부모)이 rotation(-8deg)만큼
  // 기울어 있어, 자식(아이콘)을 반대 방향으로 되돌리지 않으면 아이콘이
  // 궤도를 도는 내내 함께 기울어 보인다("아이콘은 항상 똑바로"가 깨진다).
  // 이 값을 지우거나 0으로 바꿔도 앞선 어떤 테스트도 못 잡았다.
  it('링이 기운 만큼 아이콘을 반대로 되돌려 항상 똑바로 세운다', () => {
    const { container } = render(<Orbit />);
    const upright = container.querySelectorAll('[data-orbit-item] > div');
    expect(upright).toHaveLength(3);
    upright.forEach((el) => {
      expect((el as HTMLElement).style.transform).toBe('rotate(8deg)');
    });
  });
});

describe('Orbit 납작함 수정: 링 선', () => {
  it('링 선이 실제로 그려진다(원인 1 수정: showPath)', () => {
    // 원본은 showPath=false + 검정 배경에서 안 보이는 rgba(0,0,0,0.1)였다.
    // 링 선이 없으면 뮤테이션 (e)처럼 FAIL해야 한다.
    const { container } = render(<Orbit />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2); // 주 링 + 보조 링

    const primary = Array.from(paths).find(
      (p) => p.getAttribute('stroke') === 'var(--color-hairline)'
    );
    expect(primary, '시안 헤어라인 링 선이 없다').not.toBeUndefined();
    expect(primary?.getAttribute('stroke-width')).toBe('1');
  });

  it('보조 링은 primary와 다른 기울기의 흐린 동심원이다', () => {
    const { container } = render(<Orbit />);
    const paths = container.querySelectorAll('path');
    const secondary = Array.from(paths).find(
      (p) => p.getAttribute('stroke') === 'var(--color-elevation-far)'
    );
    expect(secondary, '보조 링이 없다').not.toBeUndefined();

    const secondarySvg = secondary?.closest('svg') as SVGElement;
    const primarySvg = Array.from(paths)
      .find((p) => p.getAttribute('stroke') === 'var(--color-hairline)')
      ?.closest('svg') as SVGElement;
    expect(secondarySvg.style.transform).not.toBe(primarySvg.style.transform);
  });

  it('링 선의 zIndex가 아이템 근경(20)과 원경(5) 사이에 있다(원인 2 수정)', () => {
    const { container } = render(<Orbit />);
    const primary = Array.from(container.querySelectorAll('path')).find(
      (p) => p.getAttribute('stroke') === 'var(--color-hairline)'
    );
    const ringSvg = primary?.closest('svg') as SVGElement;
    expect(Number(ringSvg.style.zIndex)).toBeGreaterThan(5);
    expect(Number(ringSvg.style.zIndex)).toBeLessThan(20);
  });
});

describe('Orbit GSAP 게이팅', () => {
  it('paused면 tween을 하나도 만들지 않고, paused로 바뀌면 기존 tween을 kill한다', async () => {
    mockGsapSuccess();
    const { rerender } = render(<Orbit shouldLoad paused={false} />);
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toFn).toHaveBeenCalledTimes(3)); // 아이콘 3개 = tween 3개

    toFn.mockClear();
    killFn.mockClear();
    rerender(<Orbit shouldLoad paused />);

    // paused로 바뀐 커밋의 effect 클린업이 만들어져 있던 tween 3개를 전부
    // kill한다. paused인 새 effect 실행은 새 tween을 만들지 않는다.
    expect(killFn).toHaveBeenCalledTimes(3);
    expect(toFn).not.toHaveBeenCalled();
  });

  it('선택 전에는 장식 청크를 load하지 않고, 선택 뒤 재방문에도 같은 인스턴스를 유지한다', async () => {
    mockGsapSuccess();
    const { rerender } = render(<Orbit shouldLoad={false} paused />);
    // 음성 결과라 setTimeout으로 실제 tick을 흘려보낸다(위 "reduced-motion"
    // 테스트와 같은 이유. flushMicrotasks의 마이크로태스크 2회로는 부족).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(attempted).not.toHaveBeenCalled();

    rerender(<Orbit shouldLoad paused={false} />);
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));

    // 재방문. About을 벗어났다(paused=true) 돌아온다(paused=false).
    // shouldLoad는 WhenVisible 안에서 한 번 켜지면 계속 true로 남으므로
    // 여기도 true로 유지한다. 다시 import를 시도하면 안 된다.
    rerender(<Orbit shouldLoad paused />);
    rerender(<Orbit shouldLoad paused={false} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(attempted).toHaveBeenCalledTimes(1);
  });

  it('motion preference 준비 전과 reduced-motion에서는(shouldLoad가 false로 남는다) dynamic import·tween 생성이 모두 0회다', async () => {
    mockGsapSuccess();
    render(<Orbit shouldLoad={false} paused={false} />);
    // 음성 결과라 "된다"를 기다리는 waitFor를 쓸 수 없다. 실제로 몇 tick을
    // 흘려보낸 뒤 여전히 호출되지 않았음을 확인한다(BootSequenceGsapLoad.
    // test.tsx와 같은 패턴). flushMicrotasks의 마이크로태스크 2회로는 부족
    // 하다는 것을 직접 확인했다 — 모의 동적 import()가 실제로 resolve되기
    // 까지 마이크로태스크 몇 틱보다 오래 걸려, 게이트를 제거하는 뮤테이션을
    // 주입해도 이 assert가 못 잡았다.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(attempted).not.toHaveBeenCalled();
    expect(toFn).not.toHaveBeenCalled();
  });
});

describe('Orbit 납작함 수정: 원근(scale/opacity/zIndex)', () => {
  it('경로 위치(sin θ)에 따라 근경은 확대·불투명·zIndex 20, 원경은 축소·반투명·zIndex 5다(원인 3 수정)', async () => {
    mockGsapSuccess();
    render(<Orbit shouldLoad paused={false} />);
    await waitFor(() => expect(attempted).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toFn).toHaveBeenCalledTimes(3));

    // 첫 아이콘(index 0, phase 0)의 tween에 전달된 vars를 그대로 꺼내
    // onUpdate를 원하는 progress로 직접 호출한다. GSAP은 onUpdate 안에서
    // this가 tween 자신이 되도록 바인딩한다.
    const [, firstItemVars] = toFn.mock.calls[0];
    setFn.mockClear();

    // phase(0) + progress(0.25) = 0.25 → theta = π/2 → sinθ = 1 → 타원
    // 하단(가까움) 최댓값.
    firstItemVars.onUpdate.call({ progress: () => 0.25 });
    const nearCall = setFn.mock.calls.at(-1)?.[1];
    expect(nearCall.scale).toBeCloseTo(1.2, 5);
    expect(nearCall.opacity).toBeCloseTo(1, 5);
    expect(nearCall.zIndex).toBe(20);

    // phase(0) + progress(0.75) = 0.75 → theta = 3π/2 → sinθ = -1 → 타원
    // 상단(멂) 최솟값.
    firstItemVars.onUpdate.call({ progress: () => 0.75 });
    const farCall = setFn.mock.calls.at(-1)?.[1];
    expect(farCall.scale).toBeCloseTo(0.55, 5);
    expect(farCall.opacity).toBeCloseTo(0.35, 5);
    expect(farCall.zIndex).toBe(5);
  });

  it('아이템 셋이 120도(1/3) 간격으로 위상이 어긋난다(fill=true와 동등)', async () => {
    mockGsapSuccess();
    render(<Orbit shouldLoad paused={false} />);
    await waitFor(() => expect(toFn).toHaveBeenCalledTimes(3));

    const starts = toFn.mock.calls.map(([, vars]) => vars.motionPath.start);
    expect(starts).toEqual([0, 1 / 3, 2 / 3]);
  });

  // 자체 고안 뮤테이션으로 발견한 구멍. 이 gsap.set 호출을 지워도 tween
  // 생성·paused 게이팅·원근 계산 테스트는 전부 그대로 통과했다(경로
  // 좌표는 여전히 움직이므로). 하지만 실제로는 아이콘의 좌상단 모서리가
  // 경로 위에 얹혀 아이콘 절반만큼 오른쪽 아래로 밀려 보인다. 그 결함을
  // 잡으려고 이 테스트를 추가했다.
  it('경로 좌표 위에 아이콘 중심을 맞춘다(xPercent/yPercent -50)', async () => {
    mockGsapSuccess();
    render(<Orbit shouldLoad paused={false} />);
    await waitFor(() => expect(toFn).toHaveBeenCalledTimes(3));

    const centeringCalls = setFn.mock.calls.filter(
      ([, vars]) => vars.xPercent === -50 && vars.yPercent === -50
    );
    expect(centeringCalls).toHaveLength(3);
  });
});

describe('Orbit 모바일', () => {
  it('모바일 뷰포트에서는 2.5:1 비율(300:120)과 56px 아이템 크기를 쓴다', () => {
    // 4.1:1(700:170)을 모바일에서도 쓰면(뮤테이션 i) 이 값이 깨진다.
    stubViewport(true);
    const { container } = render(<Orbit />);

    const item = container.querySelector('[data-orbit-item="0"]') as HTMLElement;
    expect(item.style.width).toBe('56px');
    expect(item.style.height).toBe('56px');

    const primary = Array.from(container.querySelectorAll('path')).find(
      (p) => p.getAttribute('stroke') === 'var(--color-hairline)'
    );
    expect(primary?.getAttribute('d')).toContain('A 300 120');
  });

  it('데스크톱 뷰포트에서는 4.1:1 비율(700:170)과 64px 아이템 크기를 쓴다', () => {
    stubViewport(false);
    const { container } = render(<Orbit />);

    const item = container.querySelector('[data-orbit-item="0"]') as HTMLElement;
    expect(item.style.width).toBe('64px');

    const primary = Array.from(container.querySelectorAll('path')).find(
      (p) => p.getAttribute('stroke') === 'var(--color-hairline)'
    );
    expect(primary?.getAttribute('d')).toContain('A 700 170');
  });
});
