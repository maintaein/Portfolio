import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.blockingInputs = new Set();
      const add = window.addEventListener;
      const remove = window.removeEventListener;
      window.addEventListener = function (type, listener, options) {
        if (['wheel', 'touchmove'].includes(type) && options?.passive === false) window.blockingInputs.add(listener);
        return add.call(this, type, listener, options);
      };
      window.removeEventListener = function (type, listener, options) {
        if (['wheel', 'touchmove'].includes(type)) window.blockingInputs.delete(listener);
        return remove.call(this, type, listener, options);
      };
      window.glowCache = { builds: 0, textures: new Set() };
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
        if (source instanceof HTMLImageElement && source.src.startsWith('blob:')) window.glowCache.builds++;
        if (source instanceof HTMLCanvasElement && source.height > innerHeight && this.canvas.parentElement?.querySelector('[data-flow-envelope]')) window.glowCache.textures.add(source);
        return original.call(this, source, ...args);
      };
    });
    await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
    await page.locator('.proto-picker[data-ready]').waitFor();
    await page.waitForFunction(() => document.querySelector('svg:has([data-flow-envelope])').style.visibility === 'hidden');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.blockingInputs.size), 0, 'Native scrolling must not wait on input cancellation handlers');
    const documentMotion = await page.evaluate(() => {
      const canvas = document.querySelector('svg:has([data-flow-envelope])').parentElement.querySelector('canvas');
      const before = canvas.getBoundingClientRect().top;
      scrollTo({ top: 40, behavior: 'instant' });
      return { distance: canvas.getBoundingClientRect().top - before, position: getComputedStyle(canvas).position };
    });
    assert.equal(documentMotion.position, 'absolute');
    assert.ok(Math.abs(documentMotion.distance + 40) < .5, 'Raster must follow native document motion before another JS animation frame');
    const builds = await page.evaluate(() => window.glowCache.builds);
    for (const top of [50, 160, 300, 180, 0]) {
      await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), top);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    const result = await page.evaluate(() => {
      const svg = document.querySelector('svg:has([data-flow-envelope])');
      const canvas = svg.parentElement.querySelector('canvas');
      const texture = [...window.glowCache.textures][0];
      const pixels = texture?.getContext('2d').getImageData(0, 0, texture.width, texture.height).data;
      return {
        builds: window.glowCache.builds, textures: window.glowCache.textures.size,
        glowVisible: pixels?.some((value, index) => index % 4 === 3 && value > 0),
        svgVisibility: svg.style.visibility, pixels: canvas.width * canvas.height,
      };
    });
    assert.equal(result.builds, builds, 'Scrolling must reuse the glow texture');
    assert.equal(result.textures, 1);
    assert.equal(result.glowVisible, true);
    assert.equal(result.svgVisibility, 'hidden');
    assert.ok(result.pixels <= 1810000);
    await page.locator('[data-motion-layout]').evaluate(element => scrollTo({ top: Math.round(scrollY + element.getBoundingClientRect().top), behavior: 'instant' }));
    await page.waitForFunction(() => window.blockingInputs.size === 2);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `.motiscope/about-background-hold/native-cache-${width}.png` });
    console.log(`${width}: passive native input, compositor document motion, cached glow, bounded raster, About input gate: OK`);
    await page.close();
  }
} finally { await browser.close(); }
