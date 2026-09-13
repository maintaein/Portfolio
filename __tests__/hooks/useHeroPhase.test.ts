import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeroPhase } from '@/hooks/useHeroPhase';
import { HERO_SETTLE_MS, HERO_SURGE_MS } from '@/lib/constants';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useHeroPhase', () => {
  it('pending에서 시작해 resolveHero(true)로 surge, 시간이 흐르면 settle과 done을 거친다', () => {
    const { result } = renderHook(() => useHeroPhase());
    expect(result.current.heroPhase).toBe('pending');

    act(() => {
      result.current.resolveHero(true);
    });
    expect(result.current.heroPhase).toBe('surge');

    act(() => {
      vi.advanceTimersByTime(HERO_SURGE_MS - 1);
    });
    expect(result.current.heroPhase).toBe('surge');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.heroPhase).toBe('settle');

    act(() => {
      vi.advanceTimersByTime(HERO_SETTLE_MS - 1);
    });
    expect(result.current.heroPhase).toBe('settle');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.heroPhase).toBe('done');
  });

  it('resolveHero(false)는 재생 없이 곧바로 done이다', () => {
    const { result } = renderHook(() => useHeroPhase());
    act(() => {
      result.current.resolveHero(false);
    });
    expect(result.current.heroPhase).toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  // 뮤테이션: pending 검사를 빼면 surge 중 딥링크 effect의 resolveHero(false)가
  // 안무를 끊고, done 뒤 overview를 다시 떠날 때 hero가 두 번 재생된다.
  it('pending이 아니면 resolveHero는 아무것도 하지 않는다', () => {
    const { result } = renderHook(() => useHeroPhase());
    act(() => {
      result.current.resolveHero(true);
    });
    act(() => {
      result.current.resolveHero(false);
    });
    expect(result.current.heroPhase).toBe('surge');

    // settle 타이머는 surge 타이머가 상태를 바꾼 뒤의 effect가 예약하므로
    // 한 act 안에서 두 구간을 한꺼번에 흘리면 두 번째 타이머가 아직 없다.
    act(() => {
      vi.advanceTimersByTime(HERO_SURGE_MS);
    });
    act(() => {
      vi.advanceTimersByTime(HERO_SETTLE_MS);
    });
    expect(result.current.heroPhase).toBe('done');
    act(() => {
      result.current.resolveHero(true);
    });
    expect(result.current.heroPhase).toBe('done');
  });

  // resolveHero는 한 배치에서 두 번 불릴 수 있다(setActive 안의 호출과 딥링크
  // effect). 아직 커밋되지 않은 state를 보면 둘 다 통과해 시작하자마자 끊긴다.
  it('한 배치에서 두 번 불려도 첫 호출만 반영된다', () => {
    const { result } = renderHook(() => useHeroPhase());
    act(() => {
      result.current.resolveHero(true);
      result.current.resolveHero(false);
    });
    expect(result.current.heroPhase).toBe('surge');
  });

  it('언마운트하면 예약한 타이머를 취소한다', () => {
    const { result, unmount } = renderHook(() => useHeroPhase());
    act(() => {
      result.current.resolveHero(true);
    });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
