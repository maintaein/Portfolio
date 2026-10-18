import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 844 } });
  await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
  await page.locator('.proto-picker[data-ready]').waitFor();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.movingGradients = 0;
    const original = CanvasRenderingContext2D.prototype.createLinearGradient;
    CanvasRenderingContext2D.prototype.createLinearGradient = function (...args) { window.movingGradients++; return original.apply(this, args); };
  });
  const start = await page.locator('[data-motion-layout]').evaluate(element => scrollY + element.getBoundingClientRect().top);
  for (const top of [0, start / 4, start / 2, start * .75, start, start / 2, 0]) {
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), top);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  assert.equal(await page.evaluate(() => window.movingGradients), 0, 'Camera movement must not rebuild color resources');
  console.log('Entry/exit camera movement: zero linear gradient allocations');
} finally { await browser.close(); }
