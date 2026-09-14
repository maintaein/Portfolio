import { test, expect } from '@playwright/test';
import { enter } from './helpers';

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
