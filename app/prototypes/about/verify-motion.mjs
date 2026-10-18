import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

mkdirSync('.motiscope/about-motion', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const width of [1440, 390]) {
    for (const [index, name] of ['Reading', 'Focus', 'Cinema'].entries()) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`http://localhost:3001/prototypes/about-motion?v=${index + 1}`);
      await page.locator('.proto-picker[data-ready]').waitFor();
      const sequence = page.locator('[data-motion-layout]');
      const panels = page.locator('[data-motion-panel]');
      const positions = await sequence.evaluate(element => {
        const rect = element.getBoundingClientRect();
        if (element.dataset.motionLayout === 'reading' && !element.hasAttribute('data-pinned-reading')) return [...element.querySelectorAll('[data-motion-panel]')].map(panel => {
          return scrollY + rect.top + panel.offsetTop + panel.offsetHeight / 2 - innerHeight * .56;
        });
        const stops = element.hasAttribute('data-pinned-reading') ? [.08, .43, .85] : [0, .5, 1];
        return stops.map(fraction => scrollY + rect.top + fraction * (rect.height - innerHeight));
      });
      const scroll = async value => {
        await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), value);
        await page.waitForTimeout(200);
      };
      for (let chapter = 0; chapter < 3; chapter++) {
        await scroll(positions[chapter]);
        assert.ok(Number(await panels.nth(chapter).evaluate(element => getComputedStyle(element).opacity)) > .9);
        const label = ['BASICS', 'QUALITY', 'TEAMWORK'][chapter];
        await page.locator('nav[aria-label="About chapters"] a[aria-current="step"]').filter({ hasText: label }).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width}: overflow`);
        await page.screenshot({ path: `.motiscope/about-motion/${name.toLowerCase()}-${width}-${chapter}.png` });
      }
      await scroll((positions[0] + positions[1]) / 2);
      const outgoing = await panels.nth(0).evaluate(element => ({ opacity: +getComputedStyle(element).opacity, y: new DOMMatrix(getComputedStyle(element).transform).m42 }));
      const incoming = await panels.nth(1).evaluate(element => ({ opacity: +getComputedStyle(element).opacity, y: new DOMMatrix(getComputedStyle(element).transform).m42 }));
      console.log(name, width, 'transition', outgoing, incoming);
      assert.ok(outgoing.opacity < 1 && outgoing.y < 0, 'Outgoing fades up');
      assert.ok(incoming.opacity < 1 && incoming.y > 0, 'Incoming fades in from below');
      await scroll(positions[0]);
      await page.locator('nav[aria-label="About chapters"] a[aria-current="step"]').filter({ hasText: 'BASICS' }).waitFor();
      assert.ok(Number(await panels.nth(0).evaluate(element => getComputedStyle(element).opacity)) > .9, 'Reverse restores text');
      await page.keyboard.press('r');
      assert.equal(await page.evaluate(() => scrollY), 0);
      await page.locator('[data-electric-src] canvas').waitFor({ state: 'attached' });
      assert.equal(await page.locator('[data-electric-src] canvas').count(), 1, 'One persistent electric canvas');
      console.log(`${name} ${width}: chapters, fade direction, reverse, logo canvas, replay, overflow OK`);
      await page.close();
    }
  }
  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await reduced.goto('http://localhost:3001/prototypes/about-motion?v=2');
  await reduced.locator('[data-motion-layout][data-static]').waitFor();
  assert.equal(await reduced.locator('[data-electric-src] canvas').count(), 0);
  for (const panel of await reduced.locator('[data-motion-panel]').all()) {
    assert.equal(await panel.evaluate(element => getComputedStyle(element).opacity), '1');
    assert.equal(await panel.evaluate(element => getComputedStyle(element).transform), 'none');
  }
  assert.deepEqual(errors, []);
  console.log('Reduced motion: all content readable, no WebGL logo; console clean');
} finally {
  await browser.close();
}
