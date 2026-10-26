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

// M4 Task 13. About과 Projects 사이를 세게 오가는 휠. 두 잠금이 같은 휠로 함께 잠그면 넘친 거리를 서로 되돌리며 오갔고,
// 비차단으로 늦게 받은 휠은 이미 스크롤된 거리를 한 번 더 세어 입력이 닿지 않은 잠금 자리까지 당겼다(헤드 실측, task-13 probe).
// 무작위 열(seed 1)만으로는 헤드리스에서 늘 재현되지 않아 두 원인을 곧바로 일으키는 휠을 앞뒤에 둔다. 휠은 probe처럼 CDP로 바로 보낸다.
// 한 프레임에 반 화면 넘게 움직였는데 최근 입력으로 설명되지 않으면 순간이동이다. 원인으로 치는 입력은 막히지 않은 휠과,
// 막혔어도 그때 아무 잠금도 없던 휠(잠금 진입)이다. 이미 잠긴 쪽이 삼킨 휠은 페이지를 옮길 까닭이 아니다. 두 잠금이 한순간이라도 함께 서도 실패다.
test('About과 Projects 사이를 세게 오가도 두 잠금이 함께 서지 않고 입력이 만들지 않은 반 화면 넘는 순간이동이 없다 (seed 1, 1440x900)', async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter(page, 'about');
  await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'about', SLOW);
  await page.getByRole('navigation', { name: 'About 문항' }).getByRole('button').first().click();
  await expect(page.locator('#about [data-motion-layout="reading"]')).toHaveAttribute('data-locked', 'true', SLOW);
  const { about, projects, vh } = await page.evaluate(() => {
    const lockAt = (selector: string) => { const el = document.querySelector(selector)!; return Math.round(el.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(el).scrollMarginTop)); };
    return { about: lockAt('#about'), projects: lockAt('#projects'), vh: innerHeight };
  });
  await page.evaluate(() => {
    const reading = document.querySelector('#about [data-motion-layout="reading"]')!;
    const section = document.querySelector('#projects')!;
    const locked = () => reading.getAttribute('data-locked') === 'true' || section.getAttribute('data-locked') === 'true';
    const state = { frames: [] as { t: number; y: number }[], wheels: [] as { t: number; dy: number; cause: boolean; event?: WheelEvent }[], both: 0 };
    const read = () => { if (state.frames.at(-1)?.y !== scrollY) state.frames.push({ t: performance.now(), y: scrollY }); requestAnimationFrame(read); };
    requestAnimationFrame(read);
    const observer = new MutationObserver(() => { if (reading.getAttribute('data-locked') === 'true' && section.getAttribute('data-locked') === 'true') state.both += 1; });
    for (const target of [reading, section]) observer.observe(target, { attributes: true, attributeFilter: ['data-locked'] });
    addEventListener('wheel', event => state.wheels.push({ t: event.timeStamp, dy: event.deltaY, cause: !locked(), event }), { capture: true, passive: true });
    addEventListener('wheel', event => { const last = state.wheels.at(-1); if (last?.event === event) { last.cause ||= !event.defaultPrevented; delete last.event; } }, { passive: true });
    Object.assign(window, { __task13: state });
  });
  const cdp = await page.context().newCDPSession(page);
  const wheel = (deltaY: number) => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY });
  // 잠긴 About의 첫 문항에서 두 잠금 자리 사이보다 긴 휠 하나와 그 관성. 수정 전에는 Projects도 잠가 둘이 서로 되돌렸다.
  await page.waitForTimeout(1100);
  await wheel(projects - about + 100);
  for (let i = 0; i < 4; i += 1) { await wheel(100); await page.waitForTimeout(30); }
  await page.waitForTimeout(1500);
  let seed = 1;
  const random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let direction = 1;
  for (let burst = 0; burst < 30; burst += 1) {
    const y = await page.evaluate(() => scrollY);
    if (y < about - .3 * vh) direction = 1; else if (y > projects + vh) direction = -1; else if (random() < .7) direction = -direction;
    const kind = random();
    const [count, size, gap] = kind < .6 ? [3 + Math.floor(random() * 12), () => 100, () => 8 + random() * 27]
      : kind < .85 ? [2 + Math.floor(random() * 5), () => 300 + random() * 600, () => 8 + random() * 12] : [1, () => 100 + random() * 100, () => 0];
    for (let i = 0; i < count; i += 1) { await wheel(direction * Math.round(size())); const ms = gap(); if (ms) await page.waitForTimeout(ms); }
    const pause = random();
    await page.waitForTimeout(pause < .35 ? random() * 80 : pause < .75 ? 150 + random() * 300 : 600 + random() * 600);
  }
  // 프레임 기록을 비우며 그때까지의 순간이동을 거둔다. 아래 프로그램 이동은 입력이 아니므로 두 구간 사이에서 비운다.
  const collect = () => page.evaluate(half => {
    const state = (window as unknown as { __task13: { frames: { t: number; y: number }[]; wheels: { t: number; dy: number; cause: boolean }[]; both: number } }).__task13;
    const { frames, wheels } = state;
    const teleports: { from: number; to: number; caused: number }[] = [];
    for (let i = 1; i < frames.length; i += 1) {
      const dy = frames[i].y - frames[i - 1].y;
      const caused = wheels.filter(w => w.cause && w.t > frames[i - 1].t - 700 && w.t <= frames[i].t).reduce((sum, w) => sum + Math.abs(w.dy), 0);
      if (Math.abs(dy) > half && Math.abs(dy) > caused + 50) teleports.push({ from: frames[i - 1].y, to: frames[i].y, caused });
    }
    state.frames = [{ t: performance.now(), y: scrollY }];
    return teleports;
  }, vh / 2);
  await page.waitForTimeout(1500);
  const teleports = await collect();
  // Experience 쪽 한 화면 밖(수동 리스너뿐이라 비차단)에서 잠금 자리에 못 미치는 위 휠. 수정 전에는 y+delta를 한 번 더 세어 잠금 자리까지 당겼다.
  await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), projects + 1300);
  await page.waitForTimeout(1500);
  await collect();
  await wheel(-700);
  await page.waitForTimeout(2000);
  teleports.push(...await collect());
  const both = await page.evaluate(() => (window as unknown as { __task13: { both: number } }).__task13.both);
  expect({ both, teleports }).toEqual({ both: 0, teleports: [] });
});

// M4 Task 13 수정 1 B1. About을 푸는 wheel과 Projects로 들어가는 wheel이 같은 하나다(따로 100px로 먼저 풀지 않는다).
// About의 문항 클릭이 About의 잠금 wheel 리스너를 Projects 진입 리스너 뒤로 다시 단다. 예전에는 Projects가 아직 잠긴 About을 보고 먼저 거절해
// 아무도 기본 스크롤을 막지 않았고, 넘친 페이지를 넘침 창에서 한 화면 넘게 되돌리거나(350ms 안) 아예 지나쳤다(350ms 뒤).
for (const [width, height] of [[1440, 900], [1280, 720]]) test(`About 마지막 문항에서 큰 wheel 하나로 About을 풀며 Projects에 들어가면 같은 wheel로 고정하고 넘치지 않는다 (${width}x${height})`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height });
  await enter(page, 'about');
  await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'about', SLOW);
  await page.getByRole('navigation', { name: 'About 문항' }).getByRole('button').last().click();
  await expect(page.locator('#about [data-motion-layout="reading"]')).toHaveAttribute('data-locked', 'true', SLOW);
  const start = await page.locator('#projects').evaluate(el => Math.round(scrollY + el.getBoundingClientRect().top - parseFloat(getComputedStyle(el).scrollMarginTop)));
  // document의 scroll 리스너는 window에 단 잠금의 리스너보다 먼저 돌아, 잠금이 되돌리기 전의 위치를 본다. window 거품 단계의 wheel 리스너는 모든 캡처 리스너 뒤다.
  await page.evaluate(() => {
    const seen = { maxY: scrollY, prevented: null as boolean | null };
    document.addEventListener('scroll', () => { seen.maxY = Math.max(seen.maxY, scrollY); }, { passive: true });
    addEventListener('wheel', event => { seen.prevented = event.defaultPrevented; }, { passive: true });
    Object.assign(window, { __task13b1: seen });
  });
  // 걸음 간격(1초)이 지나야 마지막 문항의 새 제스처가 About을 푼다.
  await page.waitForTimeout(1100);
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, height * 2);
  await expect(projectsLocked(page)).toHaveCount(1, SLOW);
  await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'projects', SLOW);
  await page.waitForTimeout(500);
  const seen = await page.evaluate(() => (window as unknown as { __task13b1: { maxY: number; prevented: boolean } }).__task13b1);
  expect(seen.prevented).toBe(true);
  expect(seen.maxY).toBeLessThanOrEqual(start + 1);
  expect(await page.evaluate(() => scrollY)).toBe(start);
  await expect(projectsLocked(page)).toHaveCount(1);
  await expect(page.locator('#about [data-motion-layout="reading"]')).toHaveAttribute('data-locked', 'false');
  expect(await project(page)).toBe('0');
});
