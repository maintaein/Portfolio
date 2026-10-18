import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
afterEach(() => vi.unstubAllGlobals());
it('tracks local visibility independently and remembers entry after leaving', () => {
  const observers: IntersectionObserverCallback[] = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) { observers.push(callback); expect(options.threshold).toBe(0); }
    observe() {} disconnect() {}
  });
  const a = renderHook(() => { const value = useSectionVisibility(); value.ref.current = document.createElement('section'); return value; });
  const b = renderHook(() => { const value = useSectionVisibility(); value.ref.current = document.createElement('section'); return value; });
  act(() => observers.forEach(callback => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)));
  expect(a.result.current.visible).toBe(true); expect(b.result.current.visible).toBe(true);
  act(() => observers[0]([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(a.result.current.visible).toBe(false); expect(a.result.current.hasEntered).toBe(true); expect(b.result.current.visible).toBe(true);
});
