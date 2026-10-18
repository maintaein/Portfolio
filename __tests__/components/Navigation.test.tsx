import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Navigation from '@/components/blocks/Navigation';
import { NAV_ITEMS, PERSONAL_INFO } from '@/lib/constants';
it('keeps a single wordmark and all navigation items with current state', () => {
  const ref = { current: null as HTMLElement | null }; const navigate = vi.fn();
  const { container } = render(<Navigation items={NAV_ITEMS} active="projects" onNavigate={navigate} headerRef={ref} />);
  expect(screen.getAllByText(PERSONAL_INFO.NAME_EN)).toHaveLength(1);
  expect(ref.current).toBe(container.querySelector('[data-scroll-header]'));
  expect(screen.getByRole('button', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
  expect(navigate).toHaveBeenCalledWith('projects', { focus: true, behavior: 'smooth' });
  fireEvent.click(screen.getByLabelText('개요로 이동')); expect(navigate).toHaveBeenLastCalledWith('overview', expect.any(Object));
});
it('closes its mobile menu on selection and Escape', () => {
  render(<Navigation items={NAV_ITEMS} active="about" onNavigate={vi.fn()} reducedMotion />);
  const menu = screen.getByRole('button', { name: '메뉴' }); fireEvent.click(menu);
  expect(menu).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Projects' })); expect(menu).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(menu); fireEvent.keyDown(menu, { key: 'Escape' }); expect(menu).toHaveFocus(); expect(menu).toHaveAttribute('aria-expanded', 'false');
});
