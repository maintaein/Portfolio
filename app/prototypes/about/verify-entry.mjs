import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 844 } });
  await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
  await page.locator('.proto-picker[data-ready]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const start = await page.locator('[data-motion-layout]').evaluate(element => scrollY + element.getBoundingClientRect().top);
  await page.mouse.wheel(0, 10000);
  await page.waitForFunction(() => document.querySelector('[data-chapter-step]')?.dataset.chapterStep === '1');
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - start) < 1);
  assert.equal(await page.locator('[data-chapter-step]').getAttribute('data-chapter-step'), '1');
  // Simulate a noncancelable momentum packet: its native movement must not bypass About.
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 10000, cancelable: false }));
    scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  });
  await page.waitForTimeout(200);
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - start) < 1, 'Momentum must not bypass the section');
  await page.waitForFunction(() => document.querySelector('[data-electric-src]')?.firstElementChild.style.opacity === '0');
  await page.evaluate(() => {
    window.logoFrames = 0;
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      if (this.canvas.closest('[data-electric-src]')) window.logoFrames++;
      return draw.apply(this, args);
    };
  });
  await page.waitForFunction(() => window.logoFrames > 0);
  assert.ok(await page.evaluate(() => window.logoFrames > 0), 'Logo must keep animating when idle');
  console.log('Large initial gesture, noncancelable momentum clamp, continuous idle logo: OK');
} finally { await browser.close(); }
