import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.addInitScript(() => window.addEventListener('wheel', event => { window.lastWheelStamp = event.timeStamp; }, { capture: true }));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3004/prototypes/about-motion?v=1');
    await page.locator('[data-electric-src] canvas').waitFor({ state: 'attached' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      window.wheels = [];
      window.addEventListener('wheel', event => window.wheels.push({ time: event.timeStamp, dy: event.deltaY, prevented: event.defaultPrevented, y: scrollY }));
    });
    await page.locator('[data-motion-layout="reading"]').evaluate(element => scrollTo({ top: scrollY + element.getBoundingClientRect().top, behavior: 'instant' }));
    await page.waitForTimeout(1200);
    const start = await page.evaluate(() => scrollY);
    const selected = async () => `#${await page.locator('[data-motion-panel][data-position="active"]').getAttribute('id')}`;
    await page.mouse.wheel(0, 1);
    await page.waitForTimeout(100);
    assert.equal(await selected(), '#motion-value-2', 'Even a tiny gesture must advance once');
    await page.evaluate(() => {
      const start = window.lastWheelStamp;
      for (let i = 0; i < 20; i++) {
        const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
        Object.defineProperty(event, 'timeStamp', { value: start + i * 5 }); window.dispatchEvent(event);
      }
    });
    await page.waitForTimeout(100);
    assert.equal(await selected(), '#motion-value-2', 'Continuous tail must not advance twice');
    assert.equal(await page.evaluate(() => scrollY), start, 'Document and background stay still');
    assert.equal(await page.locator('[data-chapter-step]').getAttribute('data-chapter-step'), '2');
    assert.equal(await page.locator('[data-progress-boundary]').count(), 0);
    await page.waitForTimeout(1200);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(100);
    assert.equal(await selected(), '#motion-value-3');
    await page.evaluate(() => {
      const start = window.lastWheelStamp;
      for (let i = 0; i < 20; i++) {
        const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
        Object.defineProperty(event, 'timeStamp', { value: start + i * 5 }); window.dispatchEvent(event);
      }
    });
    assert.equal(await page.evaluate(() => scrollY), start);
    await page.waitForTimeout(1200);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(1200);
    console.log(width, 'release', await page.evaluate(() => ({ y: scrollY, wheels: window.wheels.slice(-3) })));
    assert.ok(await page.evaluate(() => scrollY) > start, 'Next gesture after last chapter releases page');
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => scrollY), start);
    assert.equal(await selected(), '#motion-value-3', 'Re-entry shows last chapter');
    await page.mouse.wheel(0, -1);
    await page.waitForTimeout(100);
    assert.equal(await selected(), '#motion-value-2');
    assert.deepEqual(errors, []);
    console.log(width, 'tiny gesture, continuous burst, segmented progress, release, reverse: OK');
    await page.screenshot({ path: `.motiscope/about-background-hold/gesture-${width}.png` });
    await page.close();
  }
} finally { await browser.close(); }
