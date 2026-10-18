import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import WhenVisible from '@/components/common/WhenVisible';
import { SectionActivityProvider, type SectionActivityState } from '@/components/common/SectionActivityContext';
const base: SectionActivityState = { pageVisible: true, routeResolved: true, motionReady: true, reducedMotion: false, obscured: false };
const view = (visible: boolean, flags = base, index?: number, activeIndex?: number) => <SectionActivityProvider {...flags}><WhenVisible visible={visible} index={index} activeIndex={activeIndex}>{state => <output>{JSON.stringify(state)}</output>}</WhenVisible></SectionActivityProvider>;
const state = () => JSON.parse(screen.getByRole('status').textContent!);
it('loads locally, remembers loaded decoration and pauses offscreen', () => {
  const { rerender } = render(view(false)); expect(state()).toMatchObject({ shouldLoad: false, paused: true });
  rerender(view(true)); expect(state()).toMatchObject({ shouldLoad: true, shouldMount: true, paused: false });
  rerender(view(false)); expect(state()).toMatchObject({ shouldLoad: true, shouldMount: true, paused: true });
});
it.each(['pageVisible', 'routeResolved', 'motionReady', 'obscured', 'reducedMotion'] as const)('pauses for %s', flag => {
  const flags = { ...base, [flag]: flag === 'obscured' || flag === 'reducedMotion' };
  render(view(true, flags)); expect(state().paused).toBe(true);
});
it('preserves selection eligibility and static reduced-motion mounting', () => {
  const { rerender } = render(view(true, base, 1, 0)); expect(state().paused).toBe(true);
  rerender(view(true, { ...base, reducedMotion: true }, 1, 1)); expect(state()).toMatchObject({ paused: true, shouldLoad: false, shouldMount: true });
});
