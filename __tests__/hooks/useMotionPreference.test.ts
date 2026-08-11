import { createElement } from 'react';
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMotionPreference } from '@/hooks/useMotionPreference';

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.delete(listener);
    },
  };

  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQueryList));

  return {
    fire(next: boolean) {
      mediaQueryList.matches = next;
      listeners.forEach((listener) =>
        listener({ matches: next } as MediaQueryListEvent)
      );
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMotionPreference', () => {
  it('SSR과 effect 전 첫 상태는 fail-closed다', () => {
    const matchMedia = vi.fn();
    vi.stubGlobal('matchMedia', matchMedia);

    function PreferenceProbe() {
      const preference = useMotionPreference();
      return createElement('output', {
        'data-ready': preference.ready,
        'data-reduced': preference.reduced,
      });
    }

    const container = document.createElement('div');
    container.innerHTML = renderToString(createElement(PreferenceProbe));
    const probe = container.querySelector('output');

    expect(probe).toHaveAttribute('data-ready', 'false');
    expect(probe).toHaveAttribute('data-reduced', 'true');
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it('layout effect가 설정을 읽은 뒤 준비 완료 상태가 된다', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMotionPreference());

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(result.current).toEqual({ ready: true, reduced: false });
  });

  it('설정이 도중에 바뀌면 따라간다', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useMotionPreference());

    act(() => media.fire(true));

    expect(result.current).toEqual({ ready: true, reduced: true });
  });

  it('언마운트 시 리스너를 뗀다', () => {
    const media = mockMatchMedia(false);
    const { unmount } = renderHook(() => useMotionPreference());
    expect(media.listenerCount()).toBe(1);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });

  it('matchMedia가 없는 환경에서는 안전한 정적 상태로 확정한다', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMotionPreference());

    expect(result.current).toEqual({ ready: true, reduced: true });
  });
});
