import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NAV_SEQUENCE, useSectionNav } from '@/hooks/useSectionNav';

let y = 0;
let frames: FrameRequestCallback[];
let root: HTMLElement;
let header: HTMLElement;
const options = () => ({ rootRef: { current: root }, headerRef: { current: header }, blocked: false, reducedMotion: false });
const tick = () => act(() => { const pending = frames; frames = []; pending.forEach(callback => callback(performance.now())); });
beforeEach(() => {
  y = 0; frames = [];
  window.history.replaceState({ __NA: true, tree: ['next'], projectModalId: 'existing' }, '', '/');
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.push(callback); return frames.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 6000 });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  root = document.createElement('main'); header = document.createElement('nav');
  header.getBoundingClientRect = () => ({ height: 80 } as DOMRect);
  NAV_SEQUENCE.forEach((id, index) => {
    const section = document.createElement('section'); section.dataset.section = id; section.tabIndex = -1;
    section.getBoundingClientRect = () => ({ top: index * 900 - y } as DOMRect);
    root.append(section);
  });
  document.body.append(root);
});
afterEach(() => { root.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('manual reading replaces and explicit navigation pushes while preserving Next and modal fields', () => {
  const { result } = renderHook(() => useSectionNav(options()));
  const replace = vi.spyOn(history, 'replaceState'); const push = vi.spyOn(history, 'pushState');
  y = 700; act(() => window.dispatchEvent(new Event('scroll'))); tick();
  expect(result.current.active).toBe('about');
  expect(replace).toHaveBeenCalledWith(expect.objectContaining({ projectModalId: 'existing', __NA: true }), '', '#about');
  act(() => result.current.navigate('projects'));
  expect(push).toHaveBeenCalledTimes(1); expect(history.state.tree).toEqual(['next']);
  y = 1000; act(() => window.dispatchEvent(new Event('scroll'))); tick();
  expect(location.hash).toBe('#projects'); expect(result.current.navigationTarget).toBe('projects');
});
it('same-hash modal popstate leaves scroll and pending navigation alone', () => {
  const { result } = renderHook(() => useSectionNav(options()));
  act(() => result.current.navigate('projects')); vi.mocked(window.scrollTo).mockClear();
  act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: { projectModalId: 'other' } })));
  expect(window.scrollTo).not.toHaveBeenCalled(); expect(result.current.navigationTarget).toBe('projects');
});
it('only scrolling input cancels; Tab and editing keys do not cancel', () => {
  const { result } = renderHook(() => useSectionNav(options()));
  act(() => result.current.navigate('projects'));
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' })));
  const input = document.createElement('input'); document.body.append(input);
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  expect(result.current.navigationTarget).toBe('projects'); input.remove();
  act(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 20 })));
  expect(result.current.navigationTarget).toBeNull();
  act(() => window.dispatchEvent(new Event('scrollend'))); tick();
  expect(document.activeElement).not.toBe(root.querySelector('[data-section="projects"]'));
});
it('new navigation wins stale completion and focuses only its destination', () => {
  const { result } = renderHook(() => useSectionNav(options()));
  act(() => result.current.navigate('about')); act(() => result.current.navigate('projects'));
  y = 820; act(() => window.dispatchEvent(new Event('scrollend'))); tick();
  expect(result.current.navigationTarget).toBe('projects');
  y = 1720; act(() => window.dispatchEvent(new Event('scrollend'))); tick();
  expect(result.current.navigationTarget).toBeNull();
  expect(document.activeElement).toBe(root.querySelector('[data-section="projects"]'));
});
it('resolves deep links using the measured header without adding history', () => {
  history.replaceState(history.state, '', '#projects');
  const push = vi.spyOn(history, 'pushState');
  const { result } = renderHook(() => useSectionNav(options()));
  expect(result.current.routeResolved).toBe(true); expect(result.current.active).toBe('projects');
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 1720, behavior: 'auto' }); expect(push).not.toHaveBeenCalled();
});
it('uses an instant explicit destination under reduced motion and blocks modal-obscured navigation', () => {
  const initial = options(); initial.reducedMotion = true;
  const { result, rerender } = renderHook(({ blocked }) => useSectionNav({ ...initial, blocked }), { initialProps: { blocked: false } });
  act(() => result.current.navigate('about')); expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 820, behavior: 'auto' });
  rerender({ blocked: true }); const hash = location.hash;
  act(() => result.current.navigate('skills')); expect(location.hash).toBe(hash);
});
