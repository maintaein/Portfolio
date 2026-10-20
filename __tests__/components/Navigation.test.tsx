import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Navigation from '@/components/blocks/Navigation';
import { NAV_ITEMS, PERSONAL_INFO } from '@/lib/constants';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
// 이름 버튼은 Hero에 산다(HomeClient). nav에는 경계가 옮겨 올 빈 앵커만 둔다.
it('keeps an empty name anchor and all navigation items with current state', () => {
  const ref = { current: null as HTMLElement | null }; const navigate = vi.fn();
  const { container } = render(<Navigation items={NAV_ITEMS} active="projects" onNavigate={navigate} headerRef={ref} />);
  expect(screen.queryByText(PERSONAL_INFO.NAME_EN)).toBeNull();
  expect(container.querySelector('[data-motion-anchor="nav-name"]')!.childElementCount).toBe(0);
  expect(ref.current).toBe(container.querySelector('[data-scroll-header]'));
  expect(screen.getByRole('button', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Projects' }), { detail: 1 });
  expect(navigate).toHaveBeenCalledWith('projects', { focus: true, behavior: 'smooth' });
  fireEvent.click(screen.getByRole('button', { name: 'Skills' }), { detail: 0 });
  expect(navigate).toHaveBeenLastCalledWith('skills', { focus: true, behavior: 'auto' });
});
it('closes its mobile menu on selection and Escape', () => {
  render(<Navigation items={NAV_ITEMS} active="about" onNavigate={vi.fn()} reducedMotion />);
  const menu = screen.getByRole('button', { name: '메뉴' }); fireEvent.click(menu);
  expect(menu).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Projects' })); expect(menu).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(menu); menu.focus(); fireEvent.keyDown(menu, { key: 'Escape' }); expect(menu).toHaveFocus(); expect(menu).toHaveAttribute('aria-expanded', 'false');
});
it('Escape acts only while the menu is open, including when focus is outside the nav', () => {
  render(<Navigation items={NAV_ITEMS} active="about" onNavigate={vi.fn()} />);
  const menu = screen.getByRole('button', { name: '메뉴' }); const item = screen.getByRole('button', { name: 'Skills' });
  item.focus(); fireEvent.keyDown(item, { key: 'Escape' }); expect(item).toHaveFocus();
  fireEvent.click(menu); item.blur();
  fireEvent.keyDown(document.body, { key: 'Escape' }); expect(menu).toHaveAttribute('aria-expanded', 'false');
});
it('keeps every control a 44px target and renders no Tailwind palette colors', () => {
  const { container } = render(<Navigation items={NAV_ITEMS} active="about" onNavigate={vi.fn()} />);
  for (const button of screen.getAllByRole('button')) expect(button).toHaveClass('min-h-11');
  expect(screen.getByRole('button', { name: '메뉴' })).toHaveClass('min-w-11');
  expect(findTailwindPaletteColorUtilities(container.innerHTML)).toEqual([]);
});
