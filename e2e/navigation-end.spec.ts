import { test, expect, type Page } from '@playwright/test';
import { enter, expectActive, SLOW, waitFrames } from './helpers';

const chapter = (page: Page) => page.locator('[data-section="about"] [data-position="active"]').getAttribute('data-chapter');

// Chrome의 키보드 smooth scroll은 컴포지터 애니메이션이다. 소프트웨어 GL로 프레임이 1초 넘게 걸리면 End가 애니메이션 도중
// 아무 스크롤 없이 scrollend로 끝나(앱의 scrollTo 호출도, 속성 변화도 없다. 스킬 섹션에서도 같다) 20초를 기다려도 바닥에 닿지 않는다.
// 이 검사는 End 뒤에 앱이 끌어당기지 않는지 보는 것이라 애니메이션 자체는 끈다. test.use의 launchOptions는 파일 단위라 키보드 smooth scroll에 기대는 검사만 이 파일에 둔다.
test.use({ launchOptions: { args: ['--disable-smooth-scrolling'] } });

test('keyboard steps About chapters while End and programmatic scroll leave without a pull back', async ({ page }) => {
  await enter(page, 'about');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => chapter(page), SLOW).toBe('QUALITY');
  await page.keyboard.press('End');
  const atEnd = () => page.evaluate(() => window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
  await expect.poll(atEnd, SLOW).toBe(true);
  await waitFrames(page, 20); expect(await atEnd()).toBe(true);
  const top = await page.locator('#about').evaluate(el => el.getBoundingClientRect().top + scrollY - 92 + 300);
  await page.evaluate(y => window.scrollTo(0, y), top);
  await waitFrames(page, 20);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - top)).toBeLessThanOrEqual(1);
});
// M4 Task 7. Projects도 About처럼 잠긴다. Task 8부터 휠이 화면 높이로 크기를 잡아 기본 화면(1280x720)에서도 잠긴다.
// 이 파일에 둔 까닭: Experience에서 위로 들어오는 PageUp은 키보드 smooth scroll인데, 소프트웨어 GL의 헤드리스 Chromium에서는 그 애니메이션이
// 스크롤 없이 scrollend로 끝나는 일이 잦았다(Task 8 수정 1에서 재현: 같은 자리에서 PageUp 세 번이 한 px도 안 움직였다). 위 End 검사와 같은 까닭이다.
// 진짜 PageUp 한 걸음(.875 화면)이 잠금의 .8 추정보다 긴 경우도 여기서 실제 키로 지난다.
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
    // 키보드 smooth scroll이 다 끝날 때까지 페이지 안에서 기다린다. 렌더 프레임마다 위치를 읽어 5프레임 연속(그리고 300ms 이상) 그대로일
    // 때다. 1초 넘는 소프트웨어 GL 프레임에서는 프로토콜로 두 번 읽어 같은 값이 애니메이션 도중에도 나왔다(Task 8 리뷰).
    await page.evaluate(() => new Promise<void>(resolve => {
      let last = NaN; let calm = 0; let since = 0;
      const read = () => {
        if (scrollY === last) { if (!calm++) since = performance.now(); if (calm >= 5 && performance.now() - since >= 300) return resolve(); } else calm = 0;
        last = scrollY;
        requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    }));
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

for (const [width, height] of [[1440, 900], [1280, 720]]) test(`About에서 빠르게 여러 화면을 굴려도 Projects를 고정하고 모든 인덱스를 거쳐야 Experience에 닿는다 (${width}x${height})`, async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width, height });
  await enter(page, 'about');
  await page.getByRole('navigation', { name: 'About 문항' }).getByRole('button').last().click();
  await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'about', SLOW);
  await page.waitForTimeout(STEP_GAP);
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, 100);
  await expect(page.locator('#about [data-motion-layout="reading"]')).toHaveAttribute('data-locked', 'false', SLOW);
  const start = await page.locator('#projects').evaluate(el => Math.round(scrollY + el.getBoundingClientRect().top - parseFloat(getComputedStyle(el).scrollMarginTop)));
  // 착지 순간의 문서 위치와 중심을 페이지 안에서 잰다. 프로토콜 지연 뒤의 정착한 장면만 검사하지 않는다.
  await page.evaluate(() => {
    const root = document.querySelector('.portfolio-document')!;
    const samples: { owner: string | null; locked: string | null; y: number; dx: number; dy: number }[] = [];
    const observer = new MutationObserver(() => {
      const logo = document.querySelector('[data-logo-host]')!.getBoundingClientRect();
      const preview = document.querySelector('[data-motion-anchor="projects-preview"]')!.getBoundingClientRect();
      samples.push({ owner: root.getAttribute('data-logo-owner'), locked: document.querySelector('#projects')!.getAttribute('data-locked'), y: scrollY,
        dx: logo.x + logo.width / 2 - preview.x - preview.width / 2, dy: logo.y + logo.height / 2 - preview.y - preview.height / 2 });
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-logo-owner'] });
    Object.assign(window, { __task12Landing: samples });
  });
  await Promise.all(Array.from({ length: 12 }, () => page.mouse.wheel(0, height * 2)));
  await expect(projectsLocked(page)).toHaveCount(1, SLOW);
  await expect.poll(() => page.evaluate(() => scrollY), SLOW).toBe(start);
  await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'projects', SLOW);
  const samples = await page.evaluate(() => (window as unknown as { __task12Landing: { owner: string; locked: string; y: number; dx: number; dy: number }[] }).__task12Landing);
  expect(samples.some(sample => sample.owner === 'preview' && sample.locked === 'true' && sample.y === start)).toBe(true);
  const landing = samples.find(sample => sample.owner === 'projects')!;
  expect(landing).toBeDefined();
  expect(landing.y).toBe(start);
  expect(landing.locked).toBe('true');
  expect(Math.abs(landing.dx)).toBeLessThanOrEqual(1);
  expect(Math.abs(landing.dy)).toBeLessThanOrEqual(1);
  expect(await project(page)).toBe('0');
  const count = await page.locator('#projects [role="tab"]').count();
  for (let i = 1; i < count; i += 1) {
    await page.waitForTimeout(STEP_GAP);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => project(page), SLOW).toBe(String(i));
    expect(await page.evaluate(() => scrollY)).toBe(start);
    await expect(projectsLocked(page)).toHaveCount(1);
  }
  await page.waitForTimeout(STEP_GAP);
  await page.mouse.wheel(0, 100);
  await expect(projectsLocked(page)).toHaveCount(0, SLOW);
  await page.mouse.wheel(0, Math.round(950 * height / 900));
  await expectActive(page, 'experience');
});
