import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePageVisibility } from '@/hooks/usePageVisibility';

function mockVisibilityState(initialState: DocumentVisibilityState) {
  let visibilityState = initialState;
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibilityState
  );

  return {
    set(nextState: DocumentVisibilityState) {
      visibilityState = nextState;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePageVisibility', () => {
  it('document가 visible이면 초기값은 true다', () => {
    mockVisibilityState('visible');
    const { result } = renderHook(() => usePageVisibility());

    expect(result.current).toBe(true);
  });

  it('document가 hidden이면 초기값은 false다', () => {
    mockVisibilityState('hidden');
    const { result } = renderHook(() => usePageVisibility());

    expect(result.current).toBe(false);
  });

  it('visibilitychange의 visible → hidden → visible 전이를 모두 반영한다', () => {
    const visibility = mockVisibilityState('visible');
    const { result } = renderHook(() => usePageVisibility());

    visibility.set('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current).toBe(false);

    visibility.set('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current).toBe(true);
  });

  it('BFCache pagehide에서 닫고 pageshow에서 현재 visibility를 다시 읽는다', () => {
    const visibility = mockVisibilityState('visible');
    const { result } = renderHook(() => usePageVisibility());

    act(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    expect(result.current).toBe(false);

    visibility.set('hidden');
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
    expect(result.current).toBe(false);

    visibility.set('visible');
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
    expect(result.current).toBe(true);
  });

  it('unmount에서 등록한 세 listener를 같은 콜백으로 모두 제거한다', () => {
    mockVisibilityState('visible');
    const addDocumentListener = vi.spyOn(document, 'addEventListener');
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener');
    const addWindowListener = vi.spyOn(window, 'addEventListener');
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => usePageVisibility());

    const visibilityListener = addDocumentListener.mock.calls.find(
      ([type]) => type === 'visibilitychange'
    )?.[1];
    const pageHideListener = addWindowListener.mock.calls.find(
      ([type]) => type === 'pagehide'
    )?.[1];
    const pageShowListener = addWindowListener.mock.calls.find(
      ([type]) => type === 'pageshow'
    )?.[1];

    expect(visibilityListener).toEqual(expect.any(Function));
    expect(pageHideListener).toEqual(expect.any(Function));
    expect(pageShowListener).toEqual(expect.any(Function));

    unmount();

    expect(removeDocumentListener).toHaveBeenCalledWith(
      'visibilitychange',
      visibilityListener
    );
    expect(removeWindowListener).toHaveBeenCalledWith(
      'pagehide',
      pageHideListener
    );
    expect(removeWindowListener).toHaveBeenCalledWith(
      'pageshow',
      pageShowListener
    );
  });
});
