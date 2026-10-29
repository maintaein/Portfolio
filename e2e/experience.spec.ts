import { test, expect, type Page } from '@playwright/test';
import { enter, SLOW, waitFrames } from './helpers';
declare global { interface Window { __drawsFor: (selector: string) => number } }

const frame = (page: Page) => page.locator('[data-motion-anchor="projects-preview"] > div');
const chapters = (page: Page) => page.locator('#experience article');
const states = (page: Page) => chapters(page).evaluateAll(list => list.map(article => article.getAttribute('data-state')));

// motion.ts의 선 지점(계획 R1): 첫 노드가 화면 아래끝에서 140px 올라온 스크롤. 잠금 자리 + LOGO_BACK(24)보다 아래, 프리뷰가 nav 아래 12px에 닿는 스크롤보다 위에 묶고 위쪽이 이긴다.
const boundaryPoint = (page: Page) => page.evaluate(() => {
  const offsetY = (el: HTMLElement) => { let y = 0; for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) y += node.offsetTop; return y; };
  const projects = document.querySelector<HTMLElement>('[data-section="projects"]')!;
  const lock = projects.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(projects).scrollMarginTop);
  const node = document.querySelector<HTMLElement>('[data-part="experience-node"]')!;
  const previewTop = document.querySelector('[data-motion-anchor="projects-preview"]')!.getBoundingClientRect().top + scrollY;
  const header = document.querySelector('[data-scroll-header]')!.getBoundingClientRect().height;
  const lineAt = Math.min(previewTop - header - 12, Math.max(lock + 25, offsetY(node) + Math.min(node.offsetHeight, 60) / 2 - innerHeight + 140));
  return { lineAt, previewTop, header };
});

// 장마다 노드(제목 가운데)와 읽기 끝(기술 목록 아래 8px)의 문서 y. ExperienceSection의 measure와 같다.
const chapterGeometry = (page: Page) => chapters(page).evaluateAll(list => list.map(article => {
  const offsetY = (el: HTMLElement) => { let y = 0; for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) y += node.offsetTop; return y; };
  const node = article.querySelector<HTMLElement>('[data-part="experience-node"]')!;
  const chips = article.querySelector<HTMLElement>('ul[aria-label="기술"]')!;
  return { node: offsetY(node) + Math.min(node.offsetHeight, 60) / 2, readEnd: offsetY(chips) + chips.offsetHeight + 8 };
}));

// 문서 y를 읽기선(header 아래 화면의 40%)에 맞춘다.
const readAt = (page: Page, y: number) => page.evaluate(y => {
  const header = document.querySelector('[data-scroll-header]')!.getBoundingClientRect().height;
  window.scrollTo({ top: Math.ceil(y - (header + (innerHeight - header) * .4)), behavior: 'instant' });
}, y);

const scrollTo = (page: Page, y: number) => page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);

// 경계 재생을 프레임마다 지켜본다. 프리뷰 틀이 숨은 프레임에 오버레이가 프리뷰 가운데를 덮었는지(그림이 남았는지) 읽는다.
// 이동 구간(헤드가 가운데를 떠난 뒤)부터는 가운데가 비는 것이 맞으므로, 한 번 덮였다가 빈 뒤로는 세지 않는다.
// 넘김: 이동하던 헤드가 첫 노드 자리에 닿은 뒤로는 그 자리가 한 프레임도 비지 않는다(경계 헤드에서 실제 첫 헤드로). 첫 장이 current가 되고 5프레임 뒤 끝낸다.
const watchBoundary = (page: Page) => page.evaluate(() => new Promise<{ hidden: number; covered: number; gap: number; landed: number; dropped: number }>(resolve => {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-motion-overlay]')!;
  const ctx = canvas.getContext('2d')!;
  const frameEl = document.querySelector<HTMLElement>('[data-motion-anchor="projects-preview"] > div')!;
  const anchor = document.querySelector('[data-motion-anchor="projects-preview"]')!;
  const first = document.querySelector('#experience article')!;
  const node = first.querySelector<HTMLElement>('[data-part="experience-node"]')!;
  const axis = first.querySelector<HTMLElement>('[data-part="experience-axis"]')!;
  const offset = (el: HTMLElement, key: 'offsetTop' | 'offsetLeft') => { let v = 0; for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) v += n[key]; return v; };
  // 가로세로 2r 화소 안의 가장 큰 알파
  const alphaAt = (x: number, y: number, r: number) => {
    const s = canvas.width / innerWidth, size = Math.max(1, Math.round(2 * r * s));
    const data = ctx.getImageData(Math.round((x - r) * s), Math.round((y - r) * s), size, size).data;
    let max = 0;
    for (let i = 3; i < data.length; i += 4) max = Math.max(max, data[i]);
    return max;
  };
  const seen = { hidden: 0, covered: 0, gap: 0, landed: 0, dropped: 0 };
  let left = false, after = -1;
  const read = () => {
    const box = anchor.getBoundingClientRect();
    const alpha = alphaAt(box.left + box.width / 2, box.top + box.height / 2, .5);
    if (frameEl.style.visibility === 'hidden' && !left) {
      seen.hidden++;
      if (alpha > 0) seen.covered++;
      else if (seen.covered) left = true;
      else seen.gap++;
    }
    const head = alphaAt(offset(axis, 'offsetLeft') + axis.offsetWidth / 2, offset(node, 'offsetTop') + Math.min(node.offsetHeight, 60) / 2 - scrollY, 4);
    if (head > 0) seen.landed++;
    else if (seen.landed) seen.dropped++;
    if (after < 0 && first.getAttribute('data-state') === 'current') after = 0;
    if (after >= 0 && after++ >= 5) resolve(seen);
    else requestAnimationFrame(read);
  };
  requestAnimationFrame(read);
}));

test.describe('Experience', () => {
  test('Projects 뒤 선 지점을 넘으면 프리뷰가 제자리에서 헤드가 되고 FASOO가 공개된다', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'projects');
    // 경계는 로고가 프리뷰에 넘긴 Projects 쉬는 자리에서만 돈다
    await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'projects', SLOW);
    const { lineAt, previewTop, header } = await boundaryPoint(page);
    // 출발에서 프리뷰는 아직 nav 아래에 다 있다
    expect(previewTop - (Math.ceil(lineAt) + 10)).toBeGreaterThanOrEqual(header);
    await expect(chapters(page).first()).toHaveAttribute('data-state', 'future');
    const watch = watchBoundary(page);
    await scrollTo(page, Math.ceil(lineAt) + 10);
    const seen = await watch;
    // 틀이 숨은 동안 오버레이가 그 자리를 그린다. 틀도 그림도 없는 프레임이 없다.
    expect(seen.covered).toBeGreaterThan(0);
    expect(seen.gap).toBe(0);
    expect(seen.landed).toBeGreaterThan(0);
    expect(seen.dropped).toBe(0);
    await expect(frame(page)).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('#projects [data-part="index"]')).toHaveCSS('opacity', '0');
    const fasoo = chapters(page).first();
    await expect(fasoo).toContainText('FASOO');
    await expect(fasoo).toHaveAttribute('data-state', 'current');
    await expect(fasoo.locator('[data-part="experience-node"]')).toHaveCSS('opacity', '1', SLOW);
    expect(await states(page)).toEqual(['current', 'future', 'future']);
  });

  test('빠르게 끝까지 내리면 세 장이 모두 공개되고 data-complete가 true다', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'projects');
    await expect(page.locator('.portfolio-document')).toHaveAttribute('data-logo-owner', 'projects', SLOW);
    const geo = await chapterGeometry(page);
    const line = page.locator('[data-part="experience-line"]');
    await expect(line).toHaveAttribute('data-complete', 'false');
    // 한 번에 마지막 장 읽기 끝 너머로 간다. 경계, 첫 헤드, 질주 둘이 차례로 따라온다.
    await readAt(page, geo.at(-1)!.readEnd + 20);
    await expect.poll(() => states(page), SLOW).toEqual(['past', 'past', 'current']);
    await expect(line).toHaveAttribute('data-complete', 'true');
    for (const node of await page.locator('#experience [data-part="experience-node"]').all()) await expect(node).toHaveCSS('opacity', '1', SLOW);
  });

  test('선 끝은 들쭉날쭉한 스크롤에서 한 프레임에 90px 넘게 뛰지 않는다', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    // 직접 해시는 경계 재생 없이 첫 헤드가 산 채로 연다
    await enter(page, 'experience');
    await expect(chapters(page).first()).toHaveAttribute('data-state', 'current', SLOW);
    const geo = await chapterGeometry(page);
    await readAt(page, geo[0].readEnd - 300);
    await waitFrames(page, 20);
    // 시안 jumpcheck.mjs의 휠 같은 스크롤(초당 900px + 진폭 60px 떨림)을 60fps 프레임 단위로 옮겼다. 느린 헤드리스 프레임에서도 프레임당 스크롤은 같다.
    // 첫 장 읽기 끝을 지나 질주가 둘째 노드에 닿을 만큼 간다.
    const seen = await page.evaluate(() => new Promise<{ worst: number; first: number; last: number }>(resolve => {
      const line = document.querySelector<HTMLElement>('[data-part="experience-line"]')!;
      const start = scrollY;
      const first = Number(line.dataset.tip);
      let n = 0, worst = 0, prev = first;
      const step = () => {
        const tip = Number(line.dataset.tip);
        worst = Math.max(worst, tip - prev);
        prev = tip;
        if (++n > 120) return resolve({ worst, first, last: tip });
        window.scrollTo(0, start + 15 * n + 60 * Math.sin(9 * n / 60));
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }));
    expect(seen.last).toBeGreaterThan(geo[1].node);
    expect(seen.worst).toBeLessThanOrEqual(90);
  });

  test('모션 감소에서는 경계 재생 없이 모든 장과 카드가 보인다', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'projects');
    const { lineAt } = await boundaryPoint(page);
    // 선 지점을 넘는 동안과 그 뒤 프레임마다 프리뷰 틀을 읽는다. 재생이 없으니 한 번도 숨지 않는다.
    const hidden = page.evaluate(() => new Promise<number>(resolve => {
      const frameEl = document.querySelector<HTMLElement>('[data-motion-anchor="projects-preview"] > div')!;
      let n = 0, count = 0;
      const read = () => {
        if (getComputedStyle(frameEl).visibility === 'hidden') count++;
        if (++n >= 40) resolve(count); else requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    }));
    await scrollTo(page, Math.ceil(lineAt) + 10);
    expect(await hidden).toBe(0);
    await expect(frame(page)).toHaveCSS('opacity', '1');
    expect(await states(page)).toEqual(['past', 'past', 'current']);
    await expect(page.locator('#experience')).not.toHaveAttribute('data-progressive');
    await expect(page.locator('[data-part="experience-line"]')).toHaveAttribute('data-complete', 'true');
    const opacities = await page.locator('#experience :is(.experience-reveal, .evidence-card)').evaluateAll(list => list.map(el => getComputedStyle(el).opacity));
    expect(opacities.length).toBeGreaterThan(0);
    expect(new Set(opacities)).toEqual(new Set(['1']));
    // 수치는 세지 않고 끝값이다
    await expect(page.locator('#experience .experience-metric b')).toHaveText(['-30%', '3분', '1620h', '2회']);
  });

  test('JS 없이도 세 장의 본문과 수치가 보인다 @smoke', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    const section = page.locator('#experience');
    await expect(section).not.toHaveAttribute('data-progressive');
    for (const company of ['FASOO', '삼성청년SW아카데미', '지능정보SW아카데미']) await expect(section.getByRole('heading', { name: company })).toBeVisible();
    await expect(section.locator('.experience-metric b')).toHaveText(['-30%', '3분', '1620h', '2회']);
    const opacities = await section.locator('.experience-reveal, .evidence-card').evaluateAll(list => list.map(el => getComputedStyle(el).opacity));
    expect(new Set(opacities)).toEqual(new Set(['1']));
    // 카드 그림 대신 같은 내용의 문장이 있다
    await expect(section.locator('figure.evidence-card p.sr-only')).toHaveCount(5);
    await context.close();
  });

  test('390x844에서 첫 경계를 넘으면 FASOO가 공개되고 달력 카드는 560px이다', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page, 'projects');
    await waitFrames(page, 20);
    const { lineAt, previewTop, header } = await boundaryPoint(page);
    expect(previewTop - (Math.ceil(lineAt) + 10)).toBeGreaterThanOrEqual(header);
    const watch = watchBoundary(page);
    await scrollTo(page, Math.ceil(lineAt) + 10);
    const seen = await watch;
    expect(seen.covered).toBeGreaterThan(0);
    expect(seen.gap).toBe(0);
    expect(seen.landed).toBeGreaterThan(0);
    expect(seen.dropped).toBe(0);
    await expect(chapters(page).first().locator('[data-part="experience-node"]')).toHaveCSS('opacity', '1', SLOW);
    await expect(page.locator('#experience [data-demo="calendar"] canvas')).toHaveCSS('height', '560px');
  });

  // __tests__/hooks/useIntersection.test.tsx의 VISIBILITY_ONLY_IO가 이 검사를 가리킨다
  test('증거 카드는 화면 밖에서 그리기를 멈추고 돌아오면 다시 그린다', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      const counts = new WeakMap<HTMLCanvasElement, number>();
      const original = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        counts.set(this.canvas, (counts.get(this.canvas) ?? 0) + 1);
        return original.apply(this, args);
      };
      window.__drawsFor = (selector: string) => {
        const canvas = document.querySelector<HTMLCanvasElement>(selector);
        return canvas ? (counts.get(canvas) ?? 0) : -1;
      };
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page, 'experience');
    await expect(chapters(page).first()).toHaveAttribute('data-state', 'current', SLOW);
    const selector = '#experience [data-demo="inspect"] canvas';
    const draws = () => page.evaluate(selector => window.__drawsFor(selector), selector);
    const card = page.locator(selector);
    const cardBox = () => card.evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; });
    let box = await cardBox();
    await scrollTo(page, Math.round(box.top - 200));
    await expect.poll(draws, SLOW).toBeGreaterThan(0);
    // 카드가 화면 위로 다 빠진 자리(섹션은 아직 화면 안). 장은 공개된 채라 active는 그대로이고 IntersectionObserver만 멈춘다.
    box = await cardBox();
    await scrollTo(page, Math.round(box.bottom + 100));
    await waitFrames(page, 10);
    const settled = await draws();
    await waitFrames(page, 30);
    expect(await draws()).toBe(settled);
    await expect(chapters(page).first()).not.toHaveAttribute('data-state', 'future');
    await scrollTo(page, Math.round(box.top - 200));
    await expect.poll(draws, SLOW).toBeGreaterThan(settled);
  });
});
