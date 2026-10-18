import { test, expect } from '@playwright/test';
import { enter, expectActive, historyLength, navButton } from './helpers';

test('history returns to the previous reading destination @smoke', async ({ page }) => {
  await enter(page, 'about'); const before = await historyLength(page);
  await navButton(page, 'Projects').click(); await expectActive(page, 'projects');
  expect(await historyLength(page)).toBe(before + 1);
  await page.goBack(); await expectActive(page, 'about');
  await page.goForward(); await expectActive(page, 'projects');
});
test('native document scroll exposes the next original section without hiding siblings', async ({ page }) => {
  await enter(page, 'about');
  await expect(page.locator('[data-section][inert], [data-section][aria-hidden="true"]')).toHaveCount(0);
  const before = await page.evaluate(() => window.scrollY); const length = await historyLength(page);
  await page.mouse.move(20, 400); await page.mouse.wheel(0, 950);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  expect(await historyLength(page)).toBe(length);
});
test('manual reading replaces hash without stealing focus or losing history fields', async ({ page }) => {
  await enter(page, 'about');
  await page.evaluate(() => { history.replaceState({ ...history.state, projectModalId: 'preserved', custom: 'next' }, ''); document.querySelector<HTMLButtonElement>('nav button')!.focus(); });
  const length = await historyLength(page);
  await page.locator('[data-section="experience"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80));
  await expectActive(page, 'experience'); expect(page.url()).toContain('#experience');
  expect(await historyLength(page)).toBe(length);
  expect(await page.evaluate(() => history.state.custom)).toBe('next');
  expect(await page.evaluate(() => history.state.projectModalId)).toBe('preserved');
  await expect(page.getByTestId('wordmark')).toBeFocused();
});
test('explicit navigation focuses its destination and repeated selection does not push', async ({ page }) => {
  await enter(page, 'skills'); const length = await historyLength(page);
  await navButton(page, 'Skills').click(); await expectActive(page, 'skills');
  expect(await historyLength(page)).toBe(length);
  await navButton(page, 'Projects').focus(); await page.keyboard.press('Enter'); await expectActive(page, 'projects');
  await expect(page.locator('[data-section="projects"]')).toBeFocused();
});
test('rapid navigation resolves only the final target', async ({ page }) => {
  await enter(page, 'about'); await navButton(page, 'Projects').click(); await navButton(page, 'Experience').click();
  await expectActive(page, 'experience'); await expect(page.locator('[data-section="experience"]')).toBeFocused();
});
test('mobile menu closes on selection and Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await enter(page, 'about');
  const menu = page.getByRole('button', { name: '메뉴' }); await menu.click(); await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await navButton(page, 'Skills').click(); await expect(menu).toHaveAttribute('aria-expanded', 'false'); await expectActive(page, 'skills');
  await menu.click(); await page.keyboard.press('Escape'); await expect(menu).toHaveAttribute('aria-expanded', 'false'); await expect(menu).toBeFocused();
});
test('two adjacent sections can occupy the viewport together', async ({ page }) => {
  await enter(page, 'about');
  await page.locator('[data-section="projects"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight / 2));
  const visible = await page.locator('[data-section]').evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 80; }).length);
  expect(visible).toBeGreaterThanOrEqual(2);
});
