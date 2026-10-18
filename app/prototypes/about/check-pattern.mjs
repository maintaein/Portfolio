import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(() => {
    const texture = document.createElement('canvas'); texture.width = 1; texture.height = 200;
    const source = texture.getContext('2d');
    const gradient = source.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, '#000'); gradient.addColorStop(1, '#fff');
    source.fillStyle = gradient; source.fillRect(0, 0, 1, 200);
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 300;
    const context = canvas.getContext('2d'); const pattern = context.createPattern(texture, 'repeat');
    context.fillStyle = pattern; context.fillRect(0, 100, 10, 10);
    const first = [...context.getImageData(5, 105, 1, 1).data];
    context.translate(0, 80); context.fillRect(20, 100, 10, 10);
    const shifted = [...context.getImageData(25, 185, 1, 1).data];
    return { first, shifted };
  });
  assert.deepEqual(result.first, result.shifted);
  console.log('Cached pattern stays in scene coordinates across camera translations:', result);
} finally { await browser.close(); }
