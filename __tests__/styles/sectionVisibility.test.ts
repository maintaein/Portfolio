import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const css = readFileSync('styles/design-tokens.css', 'utf8');
it('keeps root sections in native document flow without whole-page snap or hidden panels', () => {
  expect(css).toMatch(/\.section-stage\s*\{[^}]*position: relative/);
  expect(css).toMatch(/\.document-section\s*\{[^}]*min-height:/);
  expect(css).not.toMatch(/\.section-(?:hidden|visible|prewarm)\s*\{/);
  expect(css).not.toMatch(/scroll-snap-type/);
});
