import { test, expect, type Page } from '@playwright/test';
import { enter, expectActive, historyLength, navButton, SLOW, waitFrames } from './helpers';

const chapter = (page: Page) => page.locator('[data-section="about"] [data-position="active"]').getAttribute('data-chapter');
const locked = (page: Page) => page.locator('[data-motion-layout="reading"][data-locked="true"]');

test('history returns to the previous reading destination @smoke', async ({ page }) => {
  await enter(page, 'about'); const before = await historyLength(page);
  await navButton(page, 'Projects').click(); await expectActive(page, 'projects');
  expect(await historyLength(page)).toBe(before + 1);
  await page.goBack(); await expectActive(page, 'about');
  await page.goForward(); await expectActive(page, 'projects');
});
test('back and forward keep the reading position of each entry @smoke', async ({ page }) => {
  await enter(page, 'experience');
  await page.locator('[data-section="experience"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 76 + 150));
  await waitFrames(page, 5); await expectActive(page, 'experience');
  const before = await page.evaluate(() => window.scrollY);
  await navButton(page, 'Skills').click(); await expectActive(page, 'skills');
  await page.locator('[data-section="skills"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 76 + 120));
  // 읽기를 멈춘 뒤 저장된 위치가 이 항목이 떠날 때의 자리다.
  await expect.poll(() => page.evaluate(() => history.state?.sectionScrollY === window.scrollY), SLOW).toBe(true);
  const left = await page.evaluate(() => window.scrollY);
  await page.goBack(); await expectActive(page, 'experience'); await waitFrames(page, 10);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - before)).toBeLessThanOrEqual(2);
  await page.goForward(); await expectActive(page, 'skills'); await waitFrames(page, 10);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - left)).toBeLessThanOrEqual(2);
});
test('reload keeps the reading position @smoke', async ({ page }) => {
  await enter(page, 'experience');
  await page.locator('[data-section="experience"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 76 + 150));
  await waitFrames(page, 5); await expectActive(page, 'experience');
  const before = await page.evaluate(() => window.scrollY);
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('data-route-resolved', 'true', { timeout: 20_000 });
  await waitFrames(page, 10);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - before)).toBeLessThanOrEqual(2);
});
test('every section anchor clears the measured header by 16px for native fragment jumps', async ({ page }) => {
  await enter(page, 'overview');
  const header = await page.locator('[data-scroll-header]').evaluate(el => el.getBoundingClientRect().height);
  const margins = await page.locator('main [data-section]').evaluateAll(els => els.map(el => getComputedStyle(document.getElementById(el.getAttribute('data-section')!)!).scrollMarginTop));
  expect(margins).toEqual(margins.map(() => `${header + 16}px`));
});
// About은 제 자리에서만 읽기 잠금을 잡으므로 일반 문서 스크롤은 그 밖의 섹션에서 잰다.
test('native document scroll exposes the next original section without hiding siblings', async ({ page }) => {
  await enter(page, 'skills');
  await expect(page.locator('[data-section][inert], [data-section][aria-hidden="true"]')).toHaveCount(0);
  const before = await page.evaluate(() => window.scrollY); const length = await historyLength(page);
  await page.mouse.move(20, 400); await page.mouse.wheel(0, 950);
  await expect.poll(() => page.evaluate(() => window.scrollY), SLOW).toBeGreaterThan(before);
  expect(await historyLength(page)).toBe(length);
});
test('manual reading replaces hash without stealing focus or losing history fields', async ({ page }) => {
  await enter(page, 'about');
  // 이름 버튼은 Hero에 살고 nav 자리에는 fixed로 선다. 그 버튼에 둔 포커스를 읽기 스크롤이 빼앗지 않는지 본다.
  await page.evaluate(() => { history.replaceState({ ...history.state, projectModalId: 'preserved', custom: 'next' }, ''); document.querySelector<HTMLButtonElement>('[data-testid="wordmark"]')!.focus(); });
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
  // 이름 버튼은 nav 자리에 서지만 Hero에 산다. 눌러도 열린 메뉴가 닫혀야 한다.
  await menu.click(); await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByTestId('wordmark').click(); await expect(menu).toHaveAttribute('aria-expanded', 'false'); await expectActive(page, 'overview');
});
test('two adjacent sections can occupy the viewport together', async ({ page }) => {
  await enter(page, 'about');
  await page.locator('[data-section="projects"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight / 2));
  const visible = await page.locator('[data-section]').evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 80; }).length);
  expect(visible).toBeGreaterThanOrEqual(2);
});
test('About reading lock moves one chapter per wheel gesture and hands the last one back to the document', async ({ page }) => {
  await enter(page, 'about');
  await expect(locked(page)).toHaveCount(1);
  const start = await page.evaluate(() => window.scrollY);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => chapter(page), SLOW).toBe('QUALITY');
  // 로고 모프 1초가 끝나야 다음 제스처가 chapter를 넘긴다.
  await page.waitForTimeout(1100);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => chapter(page), SLOW).toBe('TEAMWORK');
  expect(await page.evaluate(() => window.scrollY)).toBe(start);
  await page.waitForTimeout(1100);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY), SLOW).toBeGreaterThan(start);
  await expect(locked(page)).toHaveCount(0);
});
// Projects 읽기 잠금의 wheel 걸음과 키 재진입 검사(M4 Task 7·8)는 e2e/navigation-end.spec.ts에 있다. 키 재진입이 키보드 smooth scroll을 끄는 파일 설정에 기대서다.
test('explicit navigation from inside About is not pulled back, and arriving at About locks it', async ({ page }) => {
  await enter(page, 'about');
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 100);
  await navButton(page, 'Projects').click(); await expectActive(page, 'projects');
  await waitFrames(page, 20);
  await expectActive(page, 'projects'); await expect(locked(page)).toHaveCount(0);
  await navButton(page, 'About').click(); await expectActive(page, 'about');
  await expect(locked(page)).toHaveCount(1);
  expect(await chapter(page)).toBe('QUALITY');
});
// 'keyboard steps About chapters while End ...'는 e2e/navigation-end.spec.ts로 옮겼다. 키보드 smooth scroll을 끄는 설정이 파일 단위라서다.
test('a nav click during the first-visit entrance ends it and still arrives at its destination', async ({ page }) => {
  await page.goto('/');
  await page.locator('html[data-intro="playing"]').waitFor({ state: 'attached', timeout: 20_000 });
  await navButton(page, 'Projects').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', SLOW);
  await expectActive(page, 'projects');
  await expect(page.locator('[data-section="projects"]')).toBeFocused(SLOW);
  expect(page.url()).toContain('#projects');
});
test('direct hash below About opens at its destination', async ({ page }) => {
  await enter(page, 'projects'); await waitFrames(page, 20);
  await expectActive(page, 'projects'); await expect(locked(page)).toHaveCount(0);
});
// M5 Task 1. 문서 y를 읽기선(header 아래 화면의 40%)에 맞춘다.
const readAt = (page: Page, y: number) => page.evaluate(y => {
  const header = document.querySelector('[data-scroll-header]')!.getBoundingClientRect().height;
  window.scrollTo({ top: Math.ceil(y - (header + (innerHeight - header) * .4)), behavior: 'instant' });
}, y);
// 장마다 위끝과 읽기 끝(기술 목록 아래 8px, ExperienceSection의 readEnd)의 문서 y.
const articleTops = (page: Page) => page.locator('#experience article').evaluateAll(list => list.map(article => {
  const offsetY = (el: HTMLElement) => { let y = 0; for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) y += node.offsetTop; return y; };
  const chips = article.querySelector<HTMLElement>('ul[aria-label="기술"]')!;
  return { top: offsetY(article as HTMLElement), readEnd: offsetY(chips) + chips.offsetHeight + 8 };
}));
test('Experience는 읽기선을 따라 노드와 본문을 하나씩 공개하고 거꾸로 가면 다시 숨긴다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page, 'experience');
  const nodes = page.locator('#experience [data-part="experience-node"]');
  const bodies = page.locator('#experience article');
  const line = page.locator('[data-part="experience-line"]');
  const tops = await articleTops(page);
  for (const [index, article] of tops.entries()) {
    await readAt(page, article.top + 2);
    await waitFrames(page, 3);
    for (let i = 0; i < tops.length; i++) await expect(bodies.nth(i)).toHaveAttribute('data-state', i < index ? 'past' : i === index ? 'current' : 'future', SLOW);
    // 아직 닿지 않은 장은 자리만 지키고 보이지 않는다. 지금 장은 다 드러난다.
    await expect(nodes.nth(index)).toHaveCSS('opacity', '1', SLOW);
    if (index + 1 < tops.length) await expect(nodes.nth(index + 1)).toHaveCSS('opacity', '0');
    await expect(line).toHaveAttribute('data-complete', 'false');
  }
  // 마지막 장 읽기 끝을 읽기선이 지나야 완료다.
  await readAt(page, tops.at(-1)!.readEnd - 4);
  await waitFrames(page, 3);
  await expect(line).toHaveAttribute('data-complete', 'false');
  await readAt(page, tops.at(-1)!.readEnd + 2);
  await expect(line).toHaveAttribute('data-complete', 'true', SLOW);
  // 거꾸로: 첫 장으로 돌아오면 뒤 장이 다시 숨는다.
  await readAt(page, tops[0].top + 2);
  await expect(bodies.nth(1)).toHaveAttribute('data-state', 'future', SLOW);
  await expect(nodes.nth(1)).toHaveCSS('opacity', '0', SLOW);
  await expect(line).toHaveAttribute('data-complete', 'false');
  // 본문 안에 따로 굴려야 하는 영역은 없다.
  expect(await page.locator('#experience .scroll-area, #experience [aria-roledescription="carousel"]').count()).toBe(0);
});
