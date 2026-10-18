import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
  await page.locator('.proto-picker[data-ready]').waitFor();
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    for (const method of ['stroke', 'fill', 'drawImage']) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function (...args) {
        if (['no-canvas-render', 'no-background', 'no-rendering'].includes(window.profileMode) && !this.canvas.closest('[data-motion-layout]')) return;
        const start = performance.now();
        const result = original.apply(this, args);
        window.canvasCost = (window.canvasCost || 0) + performance.now() - start;
        return result;
      };
    }
    for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const draw = Context.prototype.drawArrays;
      Context.prototype.drawArrays = function (...args) {
        if (['no-logo', 'no-rendering'].includes(window.profileMode)) return;
        return draw.apply(this, args);
      };
    }
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      const original = this.strokeStyle;
      if (window.profileMode === 'solid-strands' && original instanceof CanvasPattern) this.strokeStyle = '#03b3c3';
      const result = stroke.apply(this, args);
      if (this.strokeStyle !== original) this.strokeStyle = original;
      return result;
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  for (const mode of ['baseline', 'no-logo', 'no-rendering']) {
    await page.evaluate(mode => {
      window.profileMode = mode;
      window.canvasCost = 0;
      const svg = document.querySelector('svg:has([data-flow-envelope])');
      const root = svg.parentElement;
      svg.dataset.profileVisibility ??= svg.style.visibility;
      svg.style.visibility = ['no-atmosphere', 'no-background', 'no-rendering'].includes(mode) ? 'hidden' : svg.dataset.profileVisibility;
      root.querySelector('canvas').style.visibility = mode === 'no-canvas' || mode === 'no-background' ? 'hidden' : '';
    }, mode);
    const before = (await cdp.send('Performance.getMetrics')).metrics;
    const result = await page.evaluate(async () => {
      const gaps = [];
      let previous = performance.now();
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const now = performance.now();
        gaps.push(now - previous);
        previous = now;
        scrollTo({ top: (1 + Math.sin(i * .065)) * 150, behavior: 'instant' });
      }
      gaps.sort((a, b) => a - b);
      const svg = document.querySelector('svg:has([data-flow-envelope])');
      return { median: gaps[15], p95: gaps[28], canvasCost: window.canvasCost, svgHeight: svg.getBoundingClientRect().height, canvas: [svg.parentElement.querySelector('canvas').width, svg.parentElement.querySelector('canvas').height] };
    });
    const after = (await cdp.send('Performance.getMetrics')).metrics;
    const costs = Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(name => [name, +(after.find(m => m.name === name).value - before.find(m => m.name === name).value).toFixed(3)]));
    console.log(mode, JSON.stringify({ ...result, ...costs }));
  }
} finally { await browser.close(); }
