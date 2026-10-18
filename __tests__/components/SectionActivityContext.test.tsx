import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SectionActivityProvider, useSectionActivity } from '@/components/common/SectionActivityContext';
function Probe() { return <output>{JSON.stringify(useSectionActivity())}</output>; }
it('exposes only shared page, modal and motion flags', () => {
  render(<SectionActivityProvider pageVisible routeResolved motionReady reducedMotion={false} obscured><Probe /></SectionActivityProvider>);
  expect(JSON.parse(screen.getByRole('status').textContent!)).toEqual({ pageVisible: true, routeResolved: true, motionReady: true, reducedMotion: false, obscured: true });
});
it('requires the provider', () => { expect(() => render(<Probe />)).toThrow('useSectionActivity must be used within SectionActivityProvider'); });
