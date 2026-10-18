import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto('http://localhost:3004/prototypes/about-motion?v=1');
    assert.equal(response.status(), 200, await page.locator('body').innerText());
    await page.locator('[data-chapter-focus]').waitFor({ state: 'attached' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-motion-layout]').evaluate(element => scrollTo({ top: Math.round(scrollY + element.getBoundingClientRect().top), behavior: 'instant' }));
    const nav = page.locator('[data-chapter-focus]');
    await page.waitForFunction(() => document.querySelector('[data-chapter-focus]')?.dataset.entered === 'true');
    await page.waitForTimeout(1200);
    assert.equal(await nav.locator('canvas').count(), 0, 'Chapter labels need no animated renderer');
    const states = () => nav.locator('[data-chapter-word]').evaluateAll(words => words.map(word => {
      const rect = word.getBoundingClientRect();
      return { x: rect.x, y: rect.y, opacity: Number(getComputedStyle(word.querySelector('[data-chapter-glow]')).opacity) };
    }));
    const before = await states();
    assert.deepEqual(before.map(word => word.opacity), [1, 0, 0]);
    const { frames, panels } = await nav.evaluate(element => new Promise(resolve => {
      const words = [...element.querySelectorAll('[data-chapter-word]')];
      const frames = [];
      const panels = [];
      // Isolate the CSS transition from software WebGL stalls in headless Chromium.
      const gl = WebGL2RenderingContext.prototype;
      const draw = gl.drawArrays;
      gl.drawArrays = () => {};
      const start = performance.now();
      function sample() {
        panels.push([...document.querySelectorAll('[data-motion-panel]')].slice(0, 2).map(panel => {
          const style = getComputedStyle(panel);
          const matrix = new DOMMatrixReadOnly(style.transform);
          const rect = panel.getBoundingClientRect();
          const parent = panel.parentElement.getBoundingClientRect();
          return { y: rect.y + rect.height / 2 - parent.y - parent.height / 2, turn: matrix.m23, opacity: Number(style.opacity), blur: parseFloat(style.filter.slice(5)), duration: style.transitionDuration };
        }));
        frames.push(words.map(word => {
          const rect = word.getBoundingClientRect();
          return { x: rect.x, y: rect.y, opacity: Number(getComputedStyle(word.querySelector('[data-chapter-glow]')).opacity) };
        }));
        if (performance.now() - start < 1200) requestAnimationFrame(sample);
        else { gl.drawArrays = draw; resolve({ frames, panels }); }
      }
      words[1].click();
      requestAnimationFrame(sample);
    }));
    assert.ok(frames.some(frame => frame[0].opacity > 0 && frame[0].opacity < 1), `Previous glow must fade out: ${JSON.stringify(frames.map(frame => frame.map(word => word.opacity)))}`);
    assert.ok(frames.some(frame => frame[1].opacity > 0 && frame[1].opacity < 1), 'Current glow must fade in');
    assert.ok(frames.every(frame => frame[0].opacity === 0 || frame[1].opacity === 0), 'Old glow fades before the new glow brightens');
    assert.ok(panels.some(([old, next]) => old.y < -20 && old.turn > 0 && old.opacity > .1 && next.y > 20 && next.turn < 0 && next.opacity > .1), 'Both panels visibly follow a shorter spherical arc');
    assert.ok(panels.some(([old, next]) => old.blur > 2 && old.opacity > 0 && old.opacity < .8 && next.blur > 0 && next.opacity > 0), 'Outgoing and incoming copy fade through blur');
    assert.ok(panels.every(frame => frame.every(panel => Math.abs(panel.y) < 300)), 'Copy stays close to the reading area');
    assert.ok(panels.every(frame => frame.every(panel => panel.duration.endsWith('1s'))), 'Panel travel lasts the full one-second morph');
    for (const frame of frames) assert.deepEqual(frame.map(({ x, y }) => [x, y]), before.map(({ x, y }) => [x, y]), 'Words stay in place during the fade');
    assert.deepEqual((await states()).map(word => word.opacity), [0, 1, 0]);
    assert.equal(await page.locator('[data-motion-panel][data-position="active"]').getAttribute('data-chapter'), 'QUALITY');
    await nav.getByRole('button', { name: 'TEAMWORK', exact: true }).evaluate(element => element.focus({ preventScroll: true }));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-motion-panel][data-position="active"]')?.dataset.chapter === 'TEAMWORK');
    await page.waitForTimeout(1200);
    assert.deepEqual((await states()).map(word => word.opacity), [0, 0, 1]);
    const reverse = await nav.evaluate(element => new Promise(resolve => {
      const gl = WebGL2RenderingContext.prototype;
      const draw = gl.drawArrays;
      gl.drawArrays = () => {};
      element.querySelector('[data-chapter-word="QUALITY"]').click();
      setTimeout(() => {
        const result = [...document.querySelectorAll('[data-motion-panel]')].slice(1).map(panel => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(panel).transform);
          return { turn: matrix.m23 };
        });
        gl.drawArrays = draw;
        resolve(result);
      }, 300);
    }));
    assert.ok(reverse[0].turn > 0 && reverse[1].turn < 0, 'Reverse panels descend along the sphere');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `.motiscope/about-background-hold/electric-chapters-${width}.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-motion-layout]').hasAttribute('data-static'));
    assert.equal(await nav.locator('[data-chapter-glow]').first().evaluate(element => getComputedStyle(element).transitionDuration), '0s');
    assert.deepEqual(errors, []);
    console.log(`${width}: glow crossfade, stationary labels, click, keyboard, reduced motion: OK`);
    await page.close();
  }
} finally { await browser.close(); }
