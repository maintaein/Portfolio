import { test, expect } from '@playwright/test';
import { enter, SLOW } from './helpers';
import { projects } from '@/lib/data/projects';
for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768]]) {
  test(`이름이 헤더 아래 화면 안에 들어오고 모든 선택에서 프리뷰 폭이 같다 ${width}x${height}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height });
    await enter(page, 'projects');
    await expect(page.locator('#projects')).toHaveAttribute('data-locked', 'true', SLOW);
    const results = [];
    for (let index = 0; index < projects.length; index += 1) {
      await page.locator('#projects [aria-selected="true"]').focus();
      await page.keyboard.press(index === 0 ? 'Home' : 'ArrowDown');
      await expect(page.locator(`#projects [data-name="${index}"]`)).toHaveAttribute('aria-selected', 'true');
      await expect.poll(() => page.locator('#projects [aria-selected="true"]').evaluate(el => Math.abs(new DOMMatrixReadOnly((el as HTMLElement).style.transform).b)), { timeout: 30_000 }).toBeLessThan(1e-8);
      const result = await page.evaluate(() => {
        const rect = (el: Element) => el.getBoundingClientRect().toJSON();
        const names = Array.from(document.querySelectorAll<HTMLElement>('#projects [data-name]')).map(el => ({
          text: rect(el.firstElementChild!), opacity: getComputedStyle(el).opacity,
        }));
        const preview = rect(document.querySelector('#projects [data-part="preview"]')!);
        return { names, preview };
      });
      results.push(result);
      expect(result.preview.width).toBe(results[0].preview.width);
      for (const name of result.names) {
        expect(name.text.top).toBeGreaterThanOrEqual(76);
        expect(name.text.bottom).toBeLessThanOrEqual(height);
        expect(Number(name.opacity)).toBeGreaterThanOrEqual(.3);
      }
      expect(result.preview.width / result.preview.height).toBeCloseTo(16 / 9, 2);
    }
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 100);
    await expect(page.locator('#projects')).toHaveAttribute('data-locked', 'false', SLOW);
  });
}
