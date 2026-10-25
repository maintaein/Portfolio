import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { enter, SLOW } from './helpers';
const folder = '.superpowers/sdd/2026-10-17-luminous-scroll-m4-projects';
for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768]]) {
  test(`이름이 헤더 아래 화면 안에 들어오고 모든 선택에서 프리뷰 폭이 같다 ${width}x${height}`, async ({ page }) => {
    test.setTimeout(180_000);
    mkdirSync(folder, { recursive: true });
    await page.setViewportSize({ width, height });
    await enter(page, 'projects');
    await expect(page.locator('#projects')).toHaveAttribute('data-locked', 'true', SLOW);
    const results = [];
    for (const index of [0, 1, 2, 3, 4, 5]) {
      await page.locator('#projects [aria-selected="true"]').focus();
      await page.keyboard.press(index === 0 ? 'Home' : 'ArrowDown');
      await expect(page.locator(`#projects [data-name="${index}"]`)).toHaveAttribute('aria-selected', 'true');
      await expect.poll(() => page.locator('#projects [aria-selected="true"]').evaluate(el => Math.abs(new DOMMatrixReadOnly((el as HTMLElement).style.transform).b)), { timeout: 30_000 }).toBeLessThan(1e-8);
      const result = await page.evaluate(() => {
        const rect = (el: Element) => el.getBoundingClientRect().toJSON();
        const names = Array.from(document.querySelectorAll<HTMLElement>('#projects [data-name]')).map(el => ({
          box: rect(el), text: rect(el.firstElementChild!), opacity: getComputedStyle(el).opacity,
          weight: getComputedStyle(el).fontWeight, blur: getComputedStyle(el).filter,
        }));
        const preview = rect(document.querySelector('#projects [data-part="preview"]')!);
        const host = rect(document.querySelector('[data-logo-host]')!);
        const landingOffset = { x: host.x + host.width / 2 - preview.x - preview.width / 2, y: host.y + host.height / 2 - preview.y - preview.height / 2 };
        const active = document.querySelector<HTMLElement>('#projects [aria-selected="true"]')!;
        return { names, preview, landingOffset, scrollY, section: rect(document.querySelector('#projects')!), fontSize: getComputedStyle(active).fontSize,
          rowH: active.offsetHeight, header: rect(document.querySelector('[data-scroll-header]')!), color: getComputedStyle(active).color };
      });
      results.push({ index, ...result });
      expect(result.preview.width).toBe(results[0].preview.width);
      for (const name of result.names) {
        expect(name.text.top).toBeGreaterThanOrEqual(76);
        expect(name.text.bottom).toBeLessThanOrEqual(height);
        expect(Number(name.opacity)).toBeGreaterThanOrEqual(.3);
      }
      expect(result.preview.width / result.preview.height).toBeCloseTo(16 / 9, 2);
      if (index === 0 || index === 5) await page.screenshot({ path: `${folder}/task-9-fix1-${width}x${height}-i${index}.png` });
    }
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 100);
    await expect(page.locator('#projects')).toHaveAttribute('data-locked', 'false', SLOW);
    writeFileSync(`${folder}/task-9-fix1-measure-${width}x${height}.json`, JSON.stringify(results, null, 2));
  });
}
