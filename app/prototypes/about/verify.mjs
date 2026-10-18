import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const output = '.motiscope/about-prototypes';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const names = ['Index', 'Chapters', 'Proof'];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (let index = 0; index < names.length; index++) {
      await page.goto(`http://localhost:3001/prototypes/about?v=${index + 1}`);
      await page.locator(`[data-prototype-variant="${names[index]}"]`).waitFor();
      await page.locator('.proto-picker[data-ready]').waitFor();
      assert.equal(await page.locator('main h2').count(), 3);
      assert.equal(await page.locator('.proto-picker-item[aria-current="true"]').innerText(), names[index]);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${names[index]} overflow`);
      await page.screenshot({ path: `${output}/${names[index].toLowerCase()}-${viewport.width}.png`, fullPage: true });
      console.log(`${names[index]} ${viewport.width}: content, selection, overflow OK`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3001/prototypes/about?v=99');
  await page.locator('.proto-picker[data-ready]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('v'), '1');
  await page.getByRole('button', { name: 'Chapters', exact: true }).click();
  await page.locator('[data-prototype-variant="Chapters"]').waitFor();
  await page.reload();
  await page.locator('[data-prototype-variant="Chapters"]').waitFor();
  await page.keyboard.press('ArrowRight');
  await page.locator('[data-prototype-variant="Proof"]').waitFor();
  await page.keyboard.press('1');
  await page.locator('[data-prototype-variant="Index"]').waitFor();
  await page.locator('a[href="#value-2"]').click();
  assert.ok(await page.evaluate(() => scrollY > 0), 'Index anchor should scroll');
  await page.keyboard.press('3');
  await page.locator('[data-prototype-variant="Proof"]').waitFor();
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'keyboard-test'; document.body.append(input); input.focus();
  });
  await page.keyboard.press('1');
  assert.equal(await page.locator('main').getAttribute('data-prototype-variant'), 'Proof');
  await page.locator('#keyboard-test').evaluate(element => element.remove());
  assert.deepEqual(errors, []);
  console.log('Invalid query, click, reload persistence, keyboard, anchor, input guard, console: OK');
} catch (error) {
  console.log('Failure state:', page.url(), await page.locator('main').getAttribute('data-prototype-variant'), errors);
  throw error;
} finally {
  await browser.close();
}
