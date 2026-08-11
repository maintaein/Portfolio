import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');

function ruleBody(selector: string): string | undefined {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`^  ${escapedSelector}\\s*\\{([\\s\\S]*?)^  \\}`, 'm'))?.[1];
}

describe('section visibility utilities', () => {
  it('defines .section-hidden with searchable content visibility', () => {
    const hidden = ruleBody('.section-hidden');

    expect(hidden).toBeDefined();
    expect(hidden).toMatch(/content-visibility\s*:\s*auto\s*;/);
    expect(hidden).not.toMatch(/content-visibility\s*:\s*hidden\s*;/);
  });

  it('gives skipped sections an intrinsic size', () => {
    expect(ruleBody('.section-hidden')).toMatch(/contain-intrinsic-size\s*:\s*auto 100svh\s*;/);
  });

  it('extracts the standalone rule instead of the reduced-motion override', () => {
    const hidden = ruleBody('.section-hidden');

    expect(hidden).toMatch(/opacity\s*:\s*0\s*;/);
    expect(hidden).not.toMatch(/transition\s*:\s*none\s*;/);
  });

  it('defines .section-visible with visible content', () => {
    const visible = ruleBody('.section-visible');

    expect(visible).toMatch(/content-visibility\s*:\s*visible\s*;/);
    expect(visible).toMatch(/opacity\s*:\s*1\s*;/);
  });

  it('uses the shared easing for both transitions', () => {
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

    expect(ruleBody('.section-hidden')).toContain(easing);
    expect(ruleBody('.section-visible')).toContain(easing);
  });

  it('gives the section stage a vertical-only touch action', () => {
    expect(ruleBody('.section-stage')).toMatch(/touch-action\s*:\s*pan-y\s*;/);
  });

  it('keeps the stage fixed between navigation and the contact rail', () => {
    const stage = ruleBody('.section-stage');

    expect(stage).toMatch(/position\s*:\s*fixed\s*;/);
    expect(stage).toMatch(
      /inset\s*:\s*72px 0 calc\(45px \+ env\(safe-area-inset-bottom, 0px\)\)\s*;/
    );
    expect(stage).toMatch(/overflow\s*:\s*hidden\s*;/);
  });

  it('defines each section as an independent vertical scroll container', () => {
    const scroll = ruleBody('.section-scroll');

    expect(scroll).toMatch(/position\s*:\s*absolute\s*;/);
    expect(scroll).toMatch(/inset\s*:\s*0\s*;/);
    expect(scroll).toMatch(/overflow-x\s*:\s*hidden\s*;/);
    expect(scroll).toMatch(/overflow-y\s*:\s*auto\s*;/);
    expect(scroll).toMatch(/overscroll-behavior\s*:\s*contain\s*;/);
    expect(scroll).toMatch(/scrollbar-gutter\s*:\s*stable\s*;/);
  });
});
