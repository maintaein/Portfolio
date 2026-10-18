import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3001/prototypes/about-motion?v=1');
    await page.locator('.proto-picker[data-ready]').waitFor();
    const progress = page.locator('[data-stage-progress]');
    const stage = page.locator('[data-motion-layout="reading"]');
    assert.equal(await progress.getAttribute('data-stage-progress'), '0');
    assert.equal(await page.locator('nav[aria-label="About chapters"]').count(), 0);
    assert.equal(await page.locator('[data-progress-boundary]').count(), 0);
    assert.equal(await stage.getAttribute('data-entered'), 'false');
    assert.doesNotMatch(await page.locator('main').innerText(), /0[123]\s*\/|BASICS|QUALITY|TEAMWORK|스크롤 한 번|다음 스크롤/);
    await stage.evaluate(element => scrollTo({ top: Math.round(scrollY + element.getBoundingClientRect().top), behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('[data-stage-progress]').dataset.stageProgress === '1');
    await page.waitForTimeout(1200);
    const layout = await stage.evaluate(element => {
      const logo = element.querySelector('[data-electric-src]').getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return { width: logo.width, logoY: logo.top + logo.height / 2, stageY: bounds.top + bounds.height / 2, logoX: logo.left + logo.width / 2 };
    });
    assert.ok(layout.width >= (width > 767 ? 400 : 200));
    if (width > 767) assert.ok(Math.abs(layout.logoY - layout.stageY) < 2);
    else assert.ok(Math.abs(layout.logoX - width / 2) < 2);
    assert.equal(await stage.getAttribute('data-entered'), 'true');
    const energyLayout = await page.locator('[data-progress-energy]').evaluate(element => {
      const energy = element.getBoundingClientRect(), track = element.parentElement.parentElement.getBoundingClientRect();
      return { center: energy.top + energy.height / 2 - track.top - track.height / 2, height: energy.height, trackHeight: track.height, animation: getComputedStyle(element, '::before').animationPlayState, railOpacity: getComputedStyle(document.querySelector('[data-electric-src]').parentElement).opacity };
    });
    assert.ok(Math.abs(energyLayout.center) < 1, 'Energy must fill the line itself');
    assert.ok(energyLayout.height > energyLayout.trackHeight);
    assert.equal(energyLayout.animation, 'running');
    assert.equal(energyLayout.railOpacity, '1');
    const firstFlow = await page.locator('[data-progress-energy]').evaluate(element => getComputedStyle(element, '::before').transform);
    await page.waitForTimeout(300);
    assert.notEqual(await page.locator('[data-progress-energy]').evaluate(element => getComputedStyle(element, '::before').transform), firstFlow, 'Energy must keep flowing after progress settles');
    await page.mouse.wheel(0, 1);
    await page.waitForFunction(() => document.querySelector('[data-stage-progress]').dataset.stageProgress === '2');
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, -1);
    await page.waitForTimeout(1200);
    const current = Number(await progress.getAttribute('data-stage-progress'));
    const fill = await progress.evaluate(element => 1 - parseFloat(getComputedStyle(element.firstElementChild).clipPath.split(' ')[1]) / 100);
    assert.ok(Math.abs(fill - current / 3) < .01, 'Interrupted animation must settle at the current chapter');
    await page.screenshot({ path: `.motiscope/about-background-hold/reading-design-${width}.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('[data-progress-energy]').evaluate(element => getComputedStyle(element, '::before').animationName), 'none');
    assert.deepEqual(errors, []);
    console.log(`${width}: no index dots, thick energy on track, persistent electric flow, entrance, interrupted fill, reduced motion: OK`);
    await page.close();
  }
} finally { await browser.close(); }
