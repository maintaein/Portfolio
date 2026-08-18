import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');

function ruleBody(selector: string): string | undefined {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`^  ${escapedSelector}\\s*\\{([\\s\\S]*?)^  \\}`, 'm'))?.[1];
}

// touch-action은 값을 나열로 비교하지 않고 허용 토큰의 집합으로 판정한다.
// 순서가 바뀌거나 모르는 값이 추가돼도 fail-closed가 되게 하기 위함이다.
function allowedTouchActions(selector: string): string[] {
  const declaration = /touch-action\s*:\s*([^;]+);/.exec(
    ruleBody(selector) ?? ''
  )?.[1];
  if (!declaration) {
    throw new Error(`${selector}에 touch-action 선언이 없다`);
  }

  return declaration.trim().split(/\s+/);
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
    const allowed = allowedTouchActions('.section-stage');

    expect(allowed).toContain('pan-y');
    expect(allowed).not.toContain('pan-x');
  });

  it('restores horizontal touch panning for the Projects stage and track', () => {
    expect(allowedTouchActions('.section-stage-horizontal')).toEqual(
      expect.arrayContaining(['pan-x', 'pan-y'])
    );
    expect(allowedTouchActions('.section-horizontal-scroll')).toEqual(
      expect.arrayContaining(['pan-x', 'pan-y'])
    );
  });

  // 페이지 확대는 스크롤 컨테이너에서 멈추지 않고 문서 루트까지 올라가며
  // 판정된다. 그래서 체인 위의 어느 한 규칙이라도 pinch-zoom을 빼면 확대가
  // 통째로 죽는다 — .section-scroll에만 넣었을 때 실기기에서 실제로 그랬다.
  // WCAG 1.4.4를 지키려면 네 규칙 전부에 있어야 하므로 한자리에서 검사한다.
  it('lets the page zoom through every rule on the touch-action chain', () => {
    for (const selector of [
      '.section-stage',
      '.section-stage-horizontal',
      '.section-horizontal-scroll',
      '.section-scroll',
    ]) {
      expect(allowedTouchActions(selector)).toContain('pinch-zoom');
    }
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

  // 이 파일에서 가장 중요한 계약이다. 브라우저는 가로·세로 팬의 touch-action
  // 교집합을 스크롤 컨테이너에서 멈추므로, 실제 제스처 소유권을 결정하는 것은
  // .section-stage가 아니라 .section-scroll이다. 실기기에서 여기가 auto였을 때
  // 제스처 30/30이 슬롭(약 8px) 직후 pointercancel로 끝나 판정 임계 64px에
  // 도달조차 못 했다.
  it('takes horizontal panning back from the browser on the real scroll container', () => {
    const allowed = allowedTouchActions('.section-scroll');

    expect(allowed).toContain('pan-y'); // 세로 스크롤은 브라우저 몫
    expect(allowed).not.toContain('pan-x'); // 가로는 useSectionSwipe 몫
    expect(allowed).not.toContain('auto'); // auto면 브라우저가 전부 가져간다
  });
});
