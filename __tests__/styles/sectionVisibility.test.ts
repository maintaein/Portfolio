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

  it('keeps horizontal panning off the section stage so the browser cannot claim swipe gestures', () => {
    const stage = ruleBody('.section-stage');

    expect(stage).toMatch(/touch-action\s*:\s*pan-y\s*;/);
    expect(stage).not.toMatch(/touch-action\s*:\s*pan-x pan-y\s*;/);
  });

  it('restores horizontal touch panning for the Projects stage and track', () => {
    expect(ruleBody('.section-stage-horizontal')).toMatch(
      /touch-action\s*:\s*pan-x pan-y\s*;/
    );
    expect(ruleBody('.section-horizontal-scroll')).toMatch(
      /touch-action\s*:\s*pan-x pan-y\s*;/
    );
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

  // 이 파일에서 가장 중요한 계약이다. 브라우저는 touch-action 교집합을
  // 스크롤 컨테이너에서 멈추므로, 실제 제스처 소유권을 결정하는 것은
  // .section-stage가 아니라 .section-scroll이다. 실기기에서 여기가 auto였을 때
  // 제스처 30/30이 슬롭(약 8px) 직후 pointercancel로 끝나 판정 임계 64px에
  // 도달조차 못 했다. 값을 나열로 비교하지 않고 토큰 부류로 판정해, 모르는
  // 값이 들어와도 fail-closed가 되게 한다.
  it('takes horizontal panning back from the browser on the real scroll container', () => {
    const declaration = /touch-action\s*:\s*([^;]+);/.exec(
      ruleBody('.section-scroll') ?? ''
    )?.[1];
    if (!declaration) {
      throw new Error('.section-scroll에 touch-action 선언이 없다');
    }

    const allowed = declaration.trim().split(/\s+/);

    expect(allowed).toContain('pan-y'); // 세로 스크롤은 브라우저 몫
    expect(allowed).toContain('pinch-zoom'); // 확대를 죽이면 접근성 회귀
    expect(allowed).not.toContain('pan-x'); // 가로는 useSectionSwipe 몫
    expect(allowed).not.toContain('auto'); // auto면 브라우저가 전부 가져간다
  });
});
