import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import HomeClient from '@/components/sections/HomeClient';
import { HOME_SECTION_CONFIG } from '@/lib/constants';
const flags = vi.hoisted(() => ({ obscured: false, pageVisible: true, reduced: false }));
vi.mock('@/hooks/useProjectModalObscured', () => ({ useProjectModalObscured: () => flags.obscured }));
vi.mock('@/hooks/usePageVisibility', () => ({ usePageVisibility: () => flags.pageVisible }));
vi.mock('@/hooks/useMotionPreference', () => ({ useMotionPreference: () => ({ ready: true, reduced: flags.reduced }) }));
vi.mock('@/components/blocks/LuminousFlowBackground', () => ({ default: ({ paused }: { paused: boolean }) => <aside data-testid="flow" data-paused={paused} /> }));
vi.mock('@/components/sections', () => ({ AboutSection: () => <p>About original body</p>, ProjectsSection: () => <p>Projects original body</p>, ExperienceSection: () => <p>Experience original body</p>, SkillsSection: () => <p>Skills original body</p>, AwardAndCertificateSection: () => <p>Awards original body</p>, Footer: () => <footer>Contacts</footer> }));
beforeEach(() => {
  flags.obscured = false; flags.pageVisible = true; flags.reduced = false;
  window.history.replaceState(null, '', '/'); vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
it('renders all section bodies in document order without single-active hiding or swipe capture', () => {
  const { container } = render(<HomeClient />);
  expect([...container.querySelectorAll('[data-section]')].map(el => el.getAttribute('data-section'))).toEqual(['overview', ...HOME_SECTION_CONFIG.map(section => section.id)]);
  expect(container.querySelector('[data-section][inert], [data-section][aria-hidden="true"]')).toBeNull();
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'START' })).toBeNull();
  fireEvent.pointerDown(screen.getByRole('main'), { clientX: 300, pointerId: 1 }); fireEvent.pointerUp(screen.getByRole('main'), { clientX: 20, pointerId: 1 });
  expect(location.hash).toBe('');
});
it.each(['obscured', 'pageVisible', 'reduced'] as const)('pauses the flow for %s', flag => {
  flags[flag] = flag !== 'pageVisible'; render(<HomeClient />); expect(screen.getByTestId('flow')).toHaveAttribute('data-paused', 'true');
});
it('only the modal obscures the readable main and navigation', () => {
  flags.obscured = true; const { container } = render(<HomeClient />);
  expect(screen.getByRole('main')).toHaveAttribute('inert'); expect(container.querySelector('nav')!.parentElement).toHaveAttribute('inert');
  expect(container.querySelectorAll('[data-section][inert]')).toHaveLength(0);
});
