import { test, expect } from '@playwright/test';
import { enter } from './helpers';
import { projects } from '@/lib/data/projects';

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

  test('Tab이 비활성 섹션 안으로 들어가지 않는다 @smoke', async ({ page }) => {
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

    // 비활성 섹션은 inert라 포커스가 들어갈 수 없다
    // (components/sections/HomeClient/index.tsx).
    expect([...visited].filter((id) => id !== 'shell' && id !== 'about')).toEqual(
      []
    );
    // 활성 섹션에는 실제로 들어갔어야 한다. 안 그러면 위 단언이 공허하다.
    expect(visited.has('about')).toBe(true);
  });

  test('200% 확대와 320px 폭에서 활성 섹션이 가로로 잘리지 않는다 @smoke', async ({
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
      const reachedEnd = await section.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
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
    await expect(page.getByRole('button', { name: 'START' })).toBeVisible();

    const cls = await page.evaluate(() => window.__clsTotal);
    expect(cls).toBeLessThan(0.1);
  });
});
