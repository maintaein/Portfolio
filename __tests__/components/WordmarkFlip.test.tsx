import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('M1 owns a single static wordmark and defers intro/FLIP choreography', () => {
  const home = readFileSync('components/sections/HomeClient/index.tsx', 'utf8');
  const nav = readFileSync('components/blocks/Navigation/index.tsx', 'utf8');
  expect(nav.match(/data-testid="wordmark"/g)).toHaveLength(1);
  expect(home).not.toContain('BootSequence'); expect(home).not.toContain('Flip.from'); expect(home).not.toContain('onStart');
});
