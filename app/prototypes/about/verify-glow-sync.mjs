import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.setTransform;
    CanvasRenderingContext2D.prototype.setTransform = function (...args) {
      if (typeof args[0] === 'number' && this.canvas.parentElement?.querySelector('[data-flow-envelope]')) {
        window.energyY = this.canvas.getBoundingClientRect().top + args[5] / (this.canvas.width / innerWidth);
      }
      return original.apply(this, args);
    };
  });
  await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
  await page.locator('.proto-picker[data-ready]').waitFor();
  const start = await page.locator('[data-motion-layout]').evaluate(element => scrollY + element.getBoundingClientRect().top);
  for (const top of [0, start - 120, start, start + 100, start + 250, start]) {
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), top);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const data = await page.evaluate(() => {
      const svg = document.querySelector('svg:has([data-flow-envelope])');
      return { glowY: svg.getBoundingClientRect().top, energyY: window.energyY, position: getComputedStyle(svg).position };
    });
    assert.equal(data.position, 'fixed');
    assert.ok(Math.abs(data.glowY - data.energyY) < 1, `Glow/energy mismatch: ${JSON.stringify(data)}`);
  }
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const root = document.querySelector('svg:has([data-flow-envelope])').parentElement;
    const original = Element.prototype.getBoundingClientRect;
    window.backgroundReads = 0;
    Element.prototype.getBoundingClientRect = function (...args) {
      if (this === root) window.backgroundReads++;
      return original.apply(this, args);
    };
  });
  await page.waitForTimeout(700);
  const reads = await page.evaluate(() => window.backgroundReads);
  assert.equal(reads, 0, 'Idle renderer must not read layout per frame');
  console.log('Glow and energy share viewport coordinates across entry, scroll, return; idle DOM reads:', reads);
} finally { await browser.close(); }
