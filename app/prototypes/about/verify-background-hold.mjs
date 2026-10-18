import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
mkdirSync('.motiscope/about-background-hold', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
    await page.locator('.proto-picker[data-ready]').waitFor();
    const bounds = await page.locator('[data-motion-layout]').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { start: scrollY + rect.top, travel: rect.height - innerHeight };
    });
    const scroll = async fraction => {
      await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), bounds.start + bounds.travel * fraction);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return page.locator('svg:has([data-flow-envelope])').evaluate(svg => ({ y: svg.getBoundingClientRect().top, offset: new DOMMatrix(getComputedStyle(svg).transform).m42 }));
    };
    const first = await scroll(.05);
    for (const [chapter, fraction] of [[0, .15], [1, .43], [2, .85], [2, .98]]) {
      const background = await scroll(fraction);
      assert.ok(Math.abs(background.y - first.y) < 2, 'Background position must stay pinned');
      const panel = page.locator('[data-motion-panel]').nth(chapter);
      assert.equal(await panel.evaluate(element => +getComputedStyle(element).opacity), 1);
      assert.ok(Math.abs((await page.locator('[data-motion-layout] > div').boundingBox()).y) < 1);
      assert.ok((await page.locator('main > div').last().boundingBox()).y >= 844);
      if (fraction === .43) await page.screenshot({ path: `.motiscope/about-background-hold/${width}.png` });
    }
    const released = await scroll(1.15);
    assert.ok(released.y < first.y - 100, 'Background resumes movement after content completion');
    assert.ok((await page.locator('main > div').last().boundingBox()).y < 844, 'Next area enters');
    const reverse = await scroll(.43);
    console.log(width, { first, released, reverse, bounds });
    assert.ok(Math.abs(reverse.y - first.y) < 2, 'Reverse scrolling restores held background');
    await page.locator('nav[aria-label="About chapters"] a').nth(2).click();
    await page.locator('nav[aria-label="About chapters"] a[aria-current="step"]').filter({ hasText: 'TEAMWORK' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log(`${width}: Reading text and all background layers pinned; release, reverse, chapter links OK`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('Console clean');
} finally { await browser.close(); }
