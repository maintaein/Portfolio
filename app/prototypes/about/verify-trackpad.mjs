import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 844 } });
  await page.addInitScript(() => {
    // Input behavior is independent of software WebGL rendering.
    for (const type of [WebGLRenderingContext, WebGL2RenderingContext]) type.prototype.drawArrays = () => {};
  });
  await page.goto('http://localhost:3004/prototypes/about-motion?v=1');
  await page.locator('[data-electric-src] canvas').waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-motion-layout]').evaluate(element => scrollTo({ top: Math.round(scrollY + element.getBoundingClientRect().top), behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('[data-chapter-focus]')?.dataset.entered === 'true');
  const selected = () => page.locator('[data-motion-panel][data-position="active"]').getAttribute('data-chapter');
  const send = events => page.evaluate(events => {
    for (const [time, delta] of events) {
      const event = new WheelEvent('wheel', { deltaY: delta, cancelable: true });
      Object.defineProperty(event, 'timeStamp', { value: window.trackpadStart + time });
      window.dispatchEvent(event);
    }
  }, events);
  await page.evaluate(() => { window.trackpadStart = performance.now() + 1500; });
  await send([[0, 40], [20, 20], [40, 8], [60, 3]]);
  assert.equal(await selected(), 'QUALITY');
  // One decaying momentum tail must never advance twice, even after one second.
  await send(Array.from({ length: 60 }, (_, i) => [80 + i * 20, 2 * .96 ** i]));
  assert.equal(await selected(), 'QUALITY');
  await send([[1300, 35], [1320, 45]]);
  assert.equal(await selected(), 'TEAMWORK', 'A renewed trackpad stroke advances without a 220ms pause');
  await page.locator('[data-chapter-word="BASICS"]').evaluate(element => element.click());
  await page.evaluate(() => { window.trackpadStart = performance.now() + 1500; });
  await send([[0, 40], [20, 15], [40, 4], [100, 35], [120, 45]]);
  assert.equal(await selected(), 'QUALITY', 'A new stroke cannot interrupt the logo morph');
  await send(Array.from({ length: 50 }, (_, i) => [140 + i * 20, 30 * .99 ** i]));
  assert.equal(await selected(), 'TEAMWORK', 'A stroke begun during the morph remains eligible afterward');
  await send(Array.from({ length: 70 }, (_, i) => [1140 + i * 20, 2 * .97 ** i]));
  assert.equal(await page.locator('[data-motion-layout]').getAttribute('data-entered'), 'true', 'Momentum after the final chapter must not release the section');
  const y = await page.evaluate(() => scrollY);
  await send([[2600, -30], [2620, -40]]);
  assert.equal(await selected(), 'QUALITY', 'Direction reversal starts a new stroke');
  assert.equal(await page.evaluate(() => scrollY), y, 'Background stays pinned');
  console.log('Trackpad renewal, momentum, transition lock, pending stroke, reversal: OK');
} finally { await browser.close(); }
