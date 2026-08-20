import { StrictMode, createElement } from 'react';
import { act, renderHook } from '@testing-library/react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSectionNav } from '@/hooks/useSectionNav';
import { HOME_SECTION_CONFIG } from '@/lib/constants';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSectionNav', () => {
  it('초기 활성 섹션은 overview', () => {
    const { result } = renderHook(() => useSectionNav());
    expect(result.current.active).toBe('overview');
  });

  it('Strict Mode 루트 진입에서도 최초 진입 대상을 유지한다', () => {
    const { result } = renderHook(() => useSectionNav(), { wrapper: StrictMode });
    expect(result.current.entryAnimationTarget).toBe('overview');
  });

  it('Strict Mode 딥링크 진입에서도 최초 진입 대상을 유지한다', () => {
    window.history.replaceState(null, '', '/#projects');
    const { result } = renderHook(() => useSectionNav(), { wrapper: StrictMode });
    expect(result.current.entryAnimationTarget).toBe('projects');
  });

  it('첫 렌더에서는 route를 미해석 상태로 둔다', () => {
    const observed: boolean[] = [];
    const { result } = renderHook(() => {
      const nav = useSectionNav();
      observed.push(nav.routeResolved);
      return nav;
    });

    expect(observed[0]).toBe(false);
    expect(result.current.routeResolved).toBe(true);
  });

  it('동기 커밋이 끝나기 전에 최초 route를 해석한다', () => {
    window.history.replaceState(null, '', '/#projects');

    function RouteProbe() {
      const nav = useSectionNav();
      return createElement('output', {
        'data-active': nav.active,
        'data-route-resolved': nav.routeResolved,
      });
    }

    const reactTestEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT;
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;

    const container = document.createElement('div');
    const root = createRoot(container);
    flushSync(() => root.render(createElement(RouteProbe)));
    const probe = container.querySelector('output');
    flushSync(() => root.unmount());

    try {
      expect(probe).toHaveAttribute('data-active', 'projects');
      expect(probe).toHaveAttribute('data-route-resolved', 'true');
    } finally {
      reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  it('setActive가 활성 섹션을 바꾼다', () => {
    const { result } = renderHook(() => useSectionNav());
    act(() => result.current.setActive('about'));
    expect(result.current.active).toBe('about');
  });

  it('목적지의 실제 완료 알림까지 전환 상태를 유지한다', () => {
    const { result } = renderHook(() => useSectionNav());
    act(() => result.current.setActive('about'));
    expect(result.current.isTransitioning).toBe(true);

    act(() => result.current.completeTransition('about'));
    expect(result.current.isTransitioning).toBe(false);
  });

  it('연타 중 과거 목적지의 완료 알림을 무시한다', () => {
    const { result } = renderHook(() => useSectionNav());
    act(() => result.current.setActive('about'));
    act(() => result.current.setActive('projects'));

    act(() => result.current.completeTransition('about'));
    expect(result.current.isTransitioning).toBe(true);

    act(() => result.current.completeTransition('projects'));
    expect(result.current.isTransitioning).toBe(false);
  });

  it('최초 진입 신호를 seen 갱신 전에 캡처하고 재방문에는 다시 만들지 않는다', () => {
    const { result } = renderHook(() => useSectionNav());
    expect(result.current.isSeen('overview')).toBe(true);
    expect(result.current.entryAnimationTarget).toBe('overview');
    expect(result.current.isSeen('about')).toBe(false);

    act(() => result.current.setActive('about'));
    expect(result.current.isSeen('about')).toBe(true);
    expect(result.current.entryAnimationTarget).toBe('about');

    act(() => result.current.setActive('projects'));
    expect(result.current.isSeen('about')).toBe(true);
    expect(result.current.entryAnimationTarget).toBe('projects');

    act(() => result.current.setActive('about'));
    expect(result.current.entryAnimationTarget).toBeNull();
  });

  it('전환마다 history에 항목을 쌓는다', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useSectionNav());

    act(() => result.current.setActive('about'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][2]).toBe('#about');
  });

  it('같은 섹션을 다시 선택하면 history를 쌓지 않는다', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useSectionNav());

    act(() => result.current.setActive('about'));
    act(() => result.current.completeTransition('about'));
    const seenBefore = result.current.seen;
    const entryTargetBefore = result.current.entryAnimationTarget;

    act(() => result.current.setActive('about'));
    expect(result.current.active).toBe('about');
    expect(result.current.isTransitioning).toBe(false);
    expect(result.current.seen).toBe(seenBefore);
    expect(result.current.entryAnimationTarget).toBe(entryTargetBefore);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('뒤로가기(popstate)가 활성 섹션을 되돌린다', () => {
    const { result } = renderHook(() => useSectionNav());
    act(() => result.current.setActive('about'));
    expect(result.current.active).toBe('about');

    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.active).toBe('overview');
    expect(result.current.isTransitioning).toBe(true);
    expect(result.current.isSeen('overview')).toBe(true);
    expect(result.current.entryAnimationTarget).toBeNull();
  });

  it('현재 섹션과 같은 해시의 modal-only popstate는 전환을 열지 않는다', () => {
    const { result } = renderHook(() => useSectionNav());
    act(() => result.current.setActive('projects'));
    act(() => result.current.completeTransition('projects'));
    const seenBefore = result.current.seen;
    const entryTargetBefore = result.current.entryAnimationTarget;

    act(() => {
      window.history.replaceState({ projectModalId: 'alpha-mail' }, '', '#projects');
      window.dispatchEvent(new PopStateEvent('popstate', { state: { projectModalId: 'alpha-mail' } }));
    });

    expect(result.current.active).toBe('projects');
    expect(result.current.isTransitioning).toBe(false);
    expect(result.current.seen).toBe(seenBefore);
    expect(result.current.entryAnimationTarget).toBe(entryTargetBefore);
  });

  it('해시가 있는 URL로 들어오면 그 섹션에서 시작한다', () => {
    window.history.replaceState(null, '', '/#projects');
    const { result } = renderHook(() => useSectionNav());
    expect(result.current.active).toBe('projects');
    expect(result.current.routeResolved).toBe(true);
    expect(result.current.isSeen('projects')).toBe(true);
    expect(result.current.isSeen('overview')).toBe(false);
    expect(result.current.entryAnimationTarget).toBe('projects');
  });

  it('알 수 없는 해시는 overview로 떨어진다', () => {
    window.history.replaceState(null, '', '/#does-not-exist');
    const { result } = renderHook(() => useSectionNav());
    expect(result.current.active).toBe('overview');
  });

  it('연타해도 마지막 선택으로 수렴한다', () => {
    const { result } = renderHook(() => useSectionNav());
    act(() => {
      result.current.setActive('about');
      result.current.setActive('projects');
      result.current.setActive('skills');
    });
    expect(result.current.active).toBe('skills');
  });

  it('goNext가 확정된 순서의 다음 섹션으로 이동한다', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useSectionNav());

    act(() => result.current.goNext());
    expect(result.current.active).toBe('about');
    expect(spy).toHaveBeenLastCalledWith(null, '', '#about');

    act(() => result.current.goNext());
    expect(result.current.active).toBe('projects');
    expect(spy).toHaveBeenLastCalledWith(null, '', '#projects');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('goPrevious가 확정된 순서의 이전 섹션으로 이동한다', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useSectionNav());
    act(() => result.current.setActive('projects'));
    spy.mockClear();

    act(() => result.current.goPrevious());
    expect(result.current.active).toBe('about');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenLastCalledWith(null, '', '#about');
  });

  it('첫 화면의 goPrevious는 history를 추가하지 않는다', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useSectionNav());
    act(() => result.current.goPrevious());
    expect(result.current.active).toBe('overview');
    expect(spy).not.toHaveBeenCalled();
  });

  it('마지막 섹션의 goNext는 history를 추가하지 않는다', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useSectionNav());
    act(() => result.current.setActive('awards-certificates'));
    spy.mockClear();
    act(() => result.current.goNext());
    expect(result.current.active).toBe('awards-certificates');
    expect(spy).not.toHaveBeenCalled();
  });

  it('언마운트 시 등록한 동일 popstate 리스너를 뗀다', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useSectionNav());
    const registered = add.mock.calls.find(([type]) => type === 'popstate')?.[1];

    expect(registered).toEqual(expect.any(Function));
    unmount();
    expect(remove).toHaveBeenCalledWith('popstate', registered);
  });

  it('onBeforeActiveChange가 실제 active 변경 직전에 from·to와 함께 정확히 한 번 호출된다', () => {
    const onBeforeActiveChange = vi.fn();
    const { result } = renderHook(() => useSectionNav(onBeforeActiveChange));

    act(() => result.current.setActive('about'));

    expect(onBeforeActiveChange).toHaveBeenCalledTimes(1);
    expect(onBeforeActiveChange).toHaveBeenCalledWith('overview', 'about');
    // 호출 시점에 아직 active가 바뀌지 않은 옛 값이어야 "직전" 계약이 성립한다.
    expect(result.current.active).toBe('about');
  });

  it('동일 id로의 변경에는 onBeforeActiveChange를 호출하지 않는다', () => {
    const onBeforeActiveChange = vi.fn();
    const { result } = renderHook(() => useSectionNav(onBeforeActiveChange));

    act(() => result.current.setActive('overview'));

    expect(onBeforeActiveChange).not.toHaveBeenCalled();
  });

  it('modal-only popstate에는 onBeforeActiveChange를 호출하지 않는다', () => {
    const onBeforeActiveChange = vi.fn();
    const { result } = renderHook(() => useSectionNav(onBeforeActiveChange));
    act(() => result.current.setActive('projects'));
    onBeforeActiveChange.mockClear();

    act(() => {
      window.history.replaceState({ projectModalId: 'alpha-mail' }, '', '#projects');
      window.dispatchEvent(new PopStateEvent('popstate', { state: { projectModalId: 'alpha-mail' } }));
    });

    expect(onBeforeActiveChange).not.toHaveBeenCalled();
  });

  it('실제 섹션 변경 popstate에는 onBeforeActiveChange를 from·to와 함께 호출한다', () => {
    const onBeforeActiveChange = vi.fn();
    const { result } = renderHook(() => useSectionNav(onBeforeActiveChange));
    act(() => result.current.setActive('about'));
    onBeforeActiveChange.mockClear();

    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(onBeforeActiveChange).toHaveBeenCalledTimes(1);
    expect(onBeforeActiveChange).toHaveBeenCalledWith('about', 'overview');
  });

  it('최초 해시 hydration에는 onBeforeActiveChange를 호출하지 않는다', () => {
    window.history.replaceState(null, '', '/#projects');
    const onBeforeActiveChange = vi.fn();
    const { result } = renderHook(() => useSectionNav(onBeforeActiveChange));

    expect(result.current.active).toBe('projects');
    expect(onBeforeActiveChange).not.toHaveBeenCalled();
  });

  it('불안정한 onBeforeActiveChange identity가 popstate 리스너를 재등록하지 않고, 재등록 없이도 항상 최신 콜백이 불린다', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const firstObserver = vi.fn();
    const secondObserver = vi.fn();

    const { result, rerender } = renderHook(
      ({ onBeforeActiveChange }) => useSectionNav(onBeforeActiveChange),
      { initialProps: { onBeforeActiveChange: firstObserver } }
    );
    act(() => result.current.setActive('about'));
    expect(firstObserver).toHaveBeenCalledTimes(1);

    const popstateAddCallsBefore = add.mock.calls.filter(
      ([type]) => type === 'popstate'
    ).length;
    const popstateRemoveCallsBefore = remove.mock.calls.filter(
      ([type]) => type === 'popstate'
    ).length;

    // 매 렌더 새 함수 identity를 넘긴다 — 불안정한 함수 prop 시나리오.
    const throwawayObserver = vi.fn();
    rerender({ onBeforeActiveChange: secondObserver });
    rerender({ onBeforeActiveChange: throwawayObserver });
    rerender({ onBeforeActiveChange: secondObserver });

    expect(
      add.mock.calls.filter(([type]) => type === 'popstate').length
    ).toBe(popstateAddCallsBefore);
    expect(
      remove.mock.calls.filter(([type]) => type === 'popstate').length
    ).toBe(popstateRemoveCallsBefore);

    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(firstObserver).toHaveBeenCalledTimes(1); // 더 이상 불리지 않는다(옛 클로저)
    expect(secondObserver).toHaveBeenCalledTimes(1);
    expect(secondObserver).toHaveBeenCalledWith('about', 'overview');
  });

  it('NAV_SEQUENCE가 HOME_SECTION_CONFIG 순서에서 파생된다', async () => {
    const reversedConfig = [...HOME_SECTION_CONFIG].reverse();
    const expected = ['overview', ...reversedConfig.map(({ id }) => id)];
    const original = ['overview', ...HOME_SECTION_CONFIG.map(({ id }) => id)];

    vi.resetModules();
    vi.doMock('@/lib/constants', () => ({ HOME_SECTION_CONFIG: reversedConfig }));

    try {
      const { NAV_SEQUENCE } = await import('@/hooks/useSectionNav');
      expect(expected).not.toEqual(original);
      expect(NAV_SEQUENCE).toEqual(expected);
    } finally {
      vi.doUnmock('@/lib/constants');
      vi.resetModules();
    }
  });
});
