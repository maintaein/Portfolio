import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { darkTokens } from '@/lib/theme/darkTokens';

const css = readFileSync(path.resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('darkTokens CSS sync', () => {
  const tokens = [
    ['background', '--color-ink', darkTokens.background],
    ['text.primary', '--color-text-primary', darkTokens.text.primary],
    ['text.secondary', '--color-text-secondary', darkTokens.text.secondary],
    ['text.accent', '--color-cyan-core', darkTokens.text.accent],
    ['text.highlight', '--color-cyan-hi', darkTokens.text.highlight],
    ['decoration.dim', '--color-cyan-dim', darkTokens.decoration.dim],
  ] as const;

  it.each(tokens)('%s matches %s', (_path, property, value) => {
    expect(css).toMatch(new RegExp(`${property}\\s*:\\s*${escapeRegExp(value)}\\s*;`));
  });
});
