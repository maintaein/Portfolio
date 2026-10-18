import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
  await page.locator('.proto-picker[data-ready]').waitFor();
  await page.locator('[data-motion-layout]').evaluate(element => scrollTo({ top: scrollY + element.getBoundingClientRect().top, behavior: 'instant' }));
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('[data-chapter-step]').getAttribute('data-chapter-step'), '2');
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator('[data-chapter-step]').getAttribute('data-chapter-step'), '1');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const touch = y => new Touch({ identifier: 1, target: document.body, clientX: 100, clientY: y });
    const fire = (type, y) => window.dispatchEvent(new TouchEvent(type, { touches: [touch(y)], cancelable: true }));
    fire('touchstart', 500);
    for (const y of [499, 480, 420, 350, 200]) fire('touchmove', y);
  });
  assert.equal(await page.locator('[data-chapter-step]').getAttribute('data-chapter-step'), '2', 'A swipe advances once');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const touch = y => new Touch({ identifier: 1, target: document.body, clientX: 100, clientY: y });
    window.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(200)] }));
    window.dispatchEvent(new TouchEvent('touchmove', { touches: [touch(201)], cancelable: true }));
  });
  assert.equal(await page.locator('[data-chapter-step]').getAttribute('data-chapter-step'), '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-motion-layout][data-static]').waitFor();
  assert.equal(await page.locator('[data-electric-src] canvas').count(), 0);
  assert.equal(await page.locator('[data-motion-panel][aria-hidden="false"]').count(), 3);
  console.log('Keyboard forward/reverse, one stage per swipe, reduced motion: OK');
} finally { await browser.close(); }
