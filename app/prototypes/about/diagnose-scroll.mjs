import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
await page.locator('.proto-picker[data-ready]').waitFor();
await page.locator('[data-motion-layout]').evaluate(element => scrollTo(0, scrollY + element.getBoundingClientRect().top));
await page.evaluate(() => {
  window.measure = { reads: 0, drawMs: [], gaps: [], live: true };
  const bounds = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) { window.measure.reads++; return bounds.apply(this, args); };
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (callback) { return raf.call(window, time => {
    const start = performance.now(); callback(time); if (window.measure.live) window.measure.drawMs.push(performance.now() - start);
  }); };
  let last = performance.now();
  const sample = time => { window.measure.gaps.push(time - last); last = time; if (window.measure.live) raf.call(window, sample); };
  raf.call(window, sample);
});
for (let index = 0; index < 12; index++) { await page.mouse.wheel(0, 12); await page.waitForTimeout(30); }
await page.waitForTimeout(800);
console.log(await page.evaluate(() => {
  window.measure.live = false;
  const sorted = window.measure.drawMs.sort((a, b) => a - b);
  return { reads: window.measure.reads, callbacks: sorted.length, p95CallbackMs: sorted[Math.floor(sorted.length * .95)], maxCallbackMs: sorted.at(-1), longFrames: window.measure.gaps.filter(value => value > 40).length, scrollY };
}));
await browser.close();
