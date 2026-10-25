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
// M4 Task 7. Projects도 About처럼 잠긴다. Task 8부터 휠이 화면 높이로 크기를 잡아 기본 화면(1280x720)에서도 잠긴다.
const projectsLocked = (page: Page) => page.locator('#projects[data-locked="true"]');
const project = (page: Page) => page.locator('#projects [role="tab"][aria-selected="true"]').getAttribute('data-name');
// 한 걸음 간격(PROJECT_STEP_MS 800)이 지나야 다음 제스처가 넘긴다. 성공 조건이 아니라 간격을 비우는 기다림이다.
const STEP_GAP = 900;
for (const [width, height] of [[1440, 900], [1280, 720]]) test(`Projects reading lock wheels one project per gesture through every project, hands the page to Experience, and the same upward at ${width}x${height}`, async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width, height });
  await enter(page, 'projects');
  await expect(projectsLocked(page)).toHaveCount(1, SLOW);
  const count = await page.locator('#projects [role="tab"]').count();
  const start = await page.evaluate(() => window.scrollY);
  expect(await project(page)).toBe('0');
  await page.mouse.move(640, 450);
  for (let i = 1; i < count; i += 1) {
    await page.mouse.wheel(0, 100);
    await expect.poll(() => project(page), SLOW).toBe(String(i));
    expect(await page.evaluate(() => window.scrollY)).toBe(start);
    await page.waitForTimeout(STEP_GAP);
  }
  // 마지막 프로젝트의 새 제스처는 문서로 돌아가고, 이어서 굴리면 Experience에 닿는다. 순환하지 않는다.
  await page.mouse.wheel(0, 100);
  await expect(projectsLocked(page)).toHaveCount(0, SLOW);
  await expect.poll(() => page.evaluate(() => window.scrollY), SLOW).toBeGreaterThan(start);
  expect(await project(page)).toBe(String(count - 1));
  // 950은 900 높이에서 잰 거리다. 낮은 화면에서는 섹션도 낮아 그대로 굴리면 Experience를 지나친다
  await page.mouse.wheel(0, Math.round(950 * height / 900));
  await expectActive(page, 'experience');
  // 위로 돌아와 잠금 자리에 닿는 제스처는 마지막 프로젝트에 세운다. 진입 wheel의 넘침을 되돌리는 창(350ms)은 소프트웨어 GL의
  // 1초 넘는 프레임 안에서 닫히므로 진입은 키(잠그면 기본 스크롤을 막는다)로 하고, 걸음은 다시 wheel로 간다.
  for (let i = 0; i < 4 && !(await projectsLocked(page).count()); i += 1) {
    await page.keyboard.press('PageUp');
    let last = -1;
    await expect.poll(async () => { const y = await page.evaluate(() => window.scrollY); const still = y === last; last = y; return still; }, SLOW).toBe(true);
  }
  await expect(projectsLocked(page)).toHaveCount(1, SLOW);
  expect(await page.evaluate(() => window.scrollY)).toBe(start);
  expect(await project(page)).toBe(String(count - 1));
  for (let i = count - 2; i >= 0; i -= 1) {
    await page.waitForTimeout(STEP_GAP);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => project(page), SLOW).toBe(String(i));
    expect(await page.evaluate(() => window.scrollY)).toBe(start);
  }
  // 첫 프로젝트의 위 제스처는 위로 문서에 돌려주고, 이어서 굴리면 About에 닿는다.
  await page.waitForTimeout(STEP_GAP);
  await page.mouse.wheel(0, -100);
  await expect(projectsLocked(page)).toHaveCount(0, SLOW);
  await expect.poll(() => page.evaluate(() => window.scrollY), SLOW).toBeLessThan(start);
  expect(await project(page)).toBe('0');
  await page.mouse.wheel(0, -Math.round(950 * height / 900));
  await expectActive(page, 'about');
});
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
