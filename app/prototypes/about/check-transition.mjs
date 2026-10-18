import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [index, name] of ['Focus', 'Cinema'].entries()) {
    await page.goto(`http://localhost:3001/prototypes/about-motion?v=${index + 2}`);
    await page.locator('.proto-picker[data-ready]').waitFor();
    await page.locator('[data-motion-layout]').evaluate(element => {
      const rect = element.getBoundingClientRect();
      const fraction = element.dataset.motionLayout === 'cinema' ? .26 : .25;
      window.scrollTo({ top: scrollY + rect.top + fraction * (rect.height - innerHeight), behavior: 'instant' });
    });
    await page.waitForTimeout(200);
    const opacity = await page.locator('[data-motion-panel]').evaluateAll(panels => panels.slice(0, 2).map(element => +getComputedStyle(element).opacity));
    assert.ok(opacity.every(value => value >= 0 && value < .01), 'Outgoing clears before incoming text appears');
    await page.screenshot({ path: `.motiscope/about-motion/${name.toLowerCase()}-transition.png` });
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('main').getAttribute('data-prototype-variant'), name === 'Focus' ? 'Cinema' : 'Reading');
    console.log(name, 'transition and picker:', opacity, 'OK');
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
