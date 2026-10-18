import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

mkdirSync('.motiscope/about-pinned', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://localhost:3001/prototypes/about-motion?v=3');
    await page.locator('.proto-picker[data-ready]').waitFor();
    const sequence = page.locator('[data-motion-layout="cinema"]');
    const viewport = sequence.locator(':scope > div');
    const bounds = await sequence.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { start: scrollY + rect.top, travel: rect.height - innerHeight };
    });
    const scroll = async fraction => {
      await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), bounds.start + bounds.travel * fraction);
      await page.waitForTimeout(150);
    };
    for (const [chapter, fractions] of [[0, [.05, .15]], [1, [.38, .48]], [2, [.75, .95]]]) {
      for (const fraction of fractions) {
        await scroll(fraction);
        const panel = page.locator('[data-motion-panel]').nth(chapter);
        assert.equal(await panel.evaluate(element => +getComputedStyle(element).opacity), 1, 'Reading holds remain opaque');
        assert.equal(await panel.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m42), 0, 'Reading holds remain stationary');
        assert.ok(Math.abs((await viewport.boundingBox()).y) < 1, 'About viewport stays pinned');
        const next = page.locator('main > div').last();
        assert.ok((await next.boundingBox()).y >= 844, 'Next section stays below viewport until finished');
        await page.locator('nav[aria-label="About chapters"] a[aria-current="step"]').filter({ hasText: ['BASICS', 'QUALITY', 'TEAMWORK'][chapter] }).waitFor();
      }
      await page.screenshot({ path: `.motiscope/about-pinned/${width}-${chapter}.png` });
    }
    await scroll(1.18);
    assert.ok((await viewport.boundingBox()).y < -100, 'After completion About releases');
    assert.ok((await page.locator('main > div').last().boundingBox()).y < 844, 'Next section enters');
    await scroll(.43);
    await page.locator('nav[aria-label="About chapters"] a[aria-current="step"]').filter({ hasText: 'QUALITY' }).waitFor();
    await page.getByRole('link', { name: '03 TEAMWORK' }).click();
    await page.locator('nav[aria-label="About chapters"] a[aria-current="step"]').filter({ hasText: 'TEAMWORK' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log(`${width}: pinned reading holds, release, next section, reverse, chapter links OK`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('Console clean');
} finally { await browser.close(); }
