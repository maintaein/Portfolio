import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
await page.locator('.proto-picker[data-ready]').waitFor();
await page.locator('[data-motion-layout]').evaluate(element => scrollTo({ top: scrollY + element.getBoundingClientRect().top, behavior: 'instant' }));
await page.waitForTimeout(2600);
await page.evaluate(() => {
  window.idle = { reads: 0, gradients: 0, backgroundRenders: 0, logoRenders: 0 };
  const bounds = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) { window.idle.reads++; return bounds.apply(this, args); };
  const gradient = CanvasRenderingContext2D.prototype.createLinearGradient;
  CanvasRenderingContext2D.prototype.createLinearGradient = function (...args) { window.idle.gradients++; return gradient.apply(this, args); };
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (this.canvas.parentElement?.querySelector('[data-flow-envelope]')) window.idle.backgroundRenders++;
    return clear.apply(this, args);
  };
  const draw = WebGL2RenderingContext.prototype.drawArrays;
  WebGL2RenderingContext.prototype.drawArrays = function (...args) { window.idle.logoRenders++; return draw.apply(this, args); };
});
await page.waitForTimeout(1500);
console.log(await page.evaluate(() => window.idle));
await browser.close();
