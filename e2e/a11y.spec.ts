import { test, expect } from '@playwright/test';
import { enter, expectActive } from './helpers';
import { projects } from '@/lib/data/projects';
import { coreValues } from '@/lib/data/profile';

// 계획 6 Task 5b-2. 접근성 계약 3건. 포커스 순서, 리플로, 레이아웃 이동은
// 실제 레이아웃 엔진이 있어야 잴 수 있다.

// layout-shift는 브라우저가 넘겨주는 항목에만 있는 필드라 여기서 좁힌다.
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

declare global {
  interface Window {
    __clsTotal: number;
  }
}

test.describe('접근성', () => {
  test('첫 화면에 페이지 제목이 하나 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('About 대비 스크림은 배경 위·본문 아래에 깔리고 Projects가 읽기선을 가지면 투명하다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await enter(page, 'about');
    const scrim = page.locator('[data-about-scrim][data-about-scrim-index="0"]').first();
    await expect(scrim).toHaveCSS('opacity', '1');
    // pointer-events는 칠하는 순서를 바꾸지 않는다. 히트 테스트에 잡히게만 연다.
    const order = await page.evaluate(() => {
      const scrimEl = document.querySelector<HTMLElement>('[data-about-scrim][data-about-scrim-index="0"]')!;
      const background = document.querySelector<HTMLElement>('.portfolio-document > [aria-hidden="true"]')!;
      scrimEl.style.pointerEvents = 'auto'; background.style.pointerEvents = 'auto';
      const stack = document.elementsFromPoint(1400, 500);
      scrimEl.style.pointerEvents = ''; background.style.pointerEvents = '';
      return {
        section: stack.findIndex(el => el.closest('[data-section="about"]')),
        scrim: stack.indexOf(scrimEl),
        background: stack.findIndex(el => background.contains(el)),
      };
    });
    expect(order.scrim).toBeGreaterThanOrEqual(0);
    expect(order.scrim).toBeLessThan(order.background);
    expect(order.section).toBeLessThan(order.scrim);
    await page.locator('[data-section="projects"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 400));
    await expectActive(page, 'projects');
    for (const layer of await page.locator('[data-about-scrim]').all()) await expect(layer).toHaveCSS('opacity', '0');
  });

  test('About chapter 단어는 44px 표적이고 chapter 제목은 섹션 h2 아래 h3다', async ({ page }) => {
    await enter(page, 'about');
    const words = page.getByRole('navigation', { name: 'About 문항' }).getByRole('button');
    await expect(words).toHaveCount(3);
    for (const word of await words.all()) {
      const box = await word.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.locator('#about').locator('h1, h2, h3').evaluateAll(els => els.map(el => el.tagName))).toEqual(['H2', 'H3', 'H3', 'H3']);
  });

  test('모션 감소와 낮은 화면에서는 About의 세 chapter를 정적 원문으로 읽는다', async ({ page }) => {
    for (const { reducedMotion, height } of [{ reducedMotion: 'reduce', height: 720 }, { reducedMotion: 'no-preference', height: 600 }] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width: 1280, height });
      await enter(page, 'about');
      await expect(page.locator('[data-motion-layout="reading"][data-static]')).toHaveCount(1);
      await expect(page.locator('#about article[inert]')).toHaveCount(0);
      for (const { title } of coreValues) await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
      // 세 chapter가 한 칸에 겹치지 않고 차례로 쌓인다.
      const boxes = await page.locator('#about article').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
      for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom - 1);
    }
  });

  test('긴 프로젝트 제목이 모바일 화면 안에 보인다', async ({ page }) => {
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 812 });
      await enter(page, 'projects');
      const longestTitle = projects.reduce((longest, project) =>
        project.title.length > longest.length ? project.title : longest, ''
      );
      const tab = page.getByRole('tab', { name: longestTitle, exact: true });
      if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
      const title = page.locator('#projects [data-flip-id^="title-"]');
      await expect(title).toHaveText(longestTitle);
      const bounds = await title.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
  });

  test('모바일 Projects 진행 안내가 키보드 선택과 함께 갱신된다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await enter(page, 'projects');
    const status = page.locator('#projects [data-part="mobile-status"]');
    const tabs = page.locator('#projects [role="tab"]');
    const count = await tabs.count();
    const firstTitle = (await tabs.nth(0).innerText()).trim();
    const secondTitle = (await tabs.nth(1).innerText()).trim();
    await page.locator('#projects [role="tab"][aria-selected="true"]').focus();
    await page.keyboard.press('End');
    await expect(status).toContainText(
      `${String(count).padStart(2, '0')} / ${String(count).padStart(2, '0')}`
    );
    await expect(status).toContainText(`다음 프로젝트: ${firstTitle}`);
    await page.keyboard.press('ArrowDown');
    await expect(status).toContainText(
      `${String(1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`
    );
    await expect(status).toContainText(`다음 프로젝트: ${secondTitle}`);
  });

  test('모바일 Skills에서 선택 기술 설명과 적용 근거가 첫 화면에 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await enter(page, 'skills');
    const slot = page.getByTestId('skill-result');
    const map = page.locator('[data-skill-map]');
    await expect(slot).toBeInViewport();
    await expect(slot).toContainText('React');
    await expect(map).toHaveAttribute('data-active-skill', 'React');
    await expect(map).toBeInViewport();
    const links = map.getByRole('link');
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
      const title = (await link.innerText()).replace(/^\d+\s*/, '').trim();
      expect(projects.some((project) => project.title === title)).toBe(true);
    }
    await page.getByRole('button', { name: 'Python' }).click();
    await expect(map).toHaveAttribute('data-active-skill', 'Python');
    await expect(slot).toContainText('Python');
    await expect(slot).toBeInViewport();
  });

  test('Tab으로 문서의 다음 섹션에도 접근한다 @smoke', async ({ page }) => {
    await enter(page, 'about');

    // 셸(내비, Footer)은 어느 섹션에도 속하지 않으므로 shell로 센다.
    const visited = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return (
          el.closest('[data-section]')?.getAttribute('data-section') ?? 'shell'
        );
      });
      if (where) visited.add(where);
    }

    // All root sections remain keyboard reachable in document order.
    expect([...visited].some(id => id !== 'shell' && id !== 'about')).toBe(true);
    await expect(page.locator('[data-section][inert], [data-section][aria-hidden="true"]')).toHaveCount(0);
    // 활성 섹션에는 실제로 들어갔어야 한다. 안 그러면 위 단언이 공허하다.
    expect(visited.has('about')).toBe(true);
  });

  test('200% 확대와 320px 폭에서 문서 본문이 가로로 잘리지 않는다 @smoke', async ({
    page,
  }) => {
    // 브라우저 200% 확대는 CSS 픽셀 기준 뷰포트가 절반이 되는 것과 같다.
    // 1280x768의 200%가 640x384다. 320은 WCAG 1.4.10 리플로 기준 폭이다.
    const viewports = [
      { width: 640, height: 384 },
      { width: 320, height: 512 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await enter(page, 'about');

      const doc = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);

      const section = page.locator('[data-section="about"]');
      const width = await section.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(width.scrollWidth).toBeLessThanOrEqual(width.clientWidth);

      // 가로로 안 잘리는 것만으로는 부족하다. 세로로 끝까지 읽을 수 있어야
      // 리플로 기준을 만족한다.
      const reachedEnd = await section.evaluate(el => {
        window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight);
        return el.getBoundingClientRect().bottom <= window.innerHeight + 1;
      });
      expect(reachedEnd).toBe(true);
    }
  });

  test('최초 진입의 누적 레이아웃 이동이 0.1 미만이다', async ({ page }) => {
    // buffered를 켜야 관찰자를 붙이기 전에 일어난 이동까지 들어온다. 문서가
    // 만들어지기 전에 심어야 첫 프레임을 놓치지 않는다.
    await page.addInitScript(() => {
      window.__clsTotal = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as LayoutShiftEntry;
          if (!shift.hadRecentInput) window.__clsTotal += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto('/');
    // 부팅 안무가 끝나 START가 올라오는 시점까지가 최초 진입 장면이다.
    // 고정 sleep 대신 이 조건을 기다린다.
    await expect(page.locator('main')).toHaveAttribute('data-route-resolved', 'true');
    await page.evaluate(() => new Promise<void>(resolve => { let count = 0; const tick = () => ++count > 90 ? resolve() : requestAnimationFrame(tick); tick(); }));

    const cls = await page.evaluate(() => window.__clsTotal);
    expect(cls).toBeLessThan(0.1);
  });
});
