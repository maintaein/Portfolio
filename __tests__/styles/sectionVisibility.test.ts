import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');

function ruleBody(selector: string): string | undefined {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`^  ${escapedSelector}\\s*\\{([\\s\\S]*?)^  \\}`, 'm'))?.[1];
}

// .site-footer 높이와 .section-stage 하단 여백은 320px 폭에서 같은 값으로
// 함께 늘어나야 한다(footer-jank-report H4). 두 규칙이 각각 자기만의
// @media (max-width: 479px) 블록 안에 있으므로, 그 블록 하나 안에서
// selector의 본문만 뽑아낸다.
function narrowViewportRuleBody(selector: string): string | undefined {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `@media \\(max-width: 479px\\) \\{\\n {4}${escapedSelector}\\s*\\{([\\s\\S]*?)^ {4}\\}`,
    'm'
  );
  return css.match(pattern)?.[1];
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

  // HomeClient가 "다음에 갈 섹션" 하나에만 .section-hidden과 함께 이
  // 클래스를 얹는다. content-visibility만 올리고 opacity·pointer-events는
  // .section-hidden 값(0·none)에 맡겨야 예열된 섹션도 여전히 안 보인다.
  it('defines .section-prewarm that only raises content-visibility, never opacity or pointer-events', () => {
    const prewarm = ruleBody('.section-prewarm');

    expect(prewarm, '.section-prewarm 규칙이 없다').toBeDefined();
    expect(prewarm).toMatch(/content-visibility\s*:\s*visible\s*;/);
    // 이 값들을 .section-prewarm 자신이 다시 선언하면 예열된 섹션이 실제로
    // 보이거나 클릭 가능해진다. .section-hidden의 은닉을 반드시 그대로
    // 물려받아야 한다.
    expect(prewarm).not.toMatch(/opacity\s*:/);
    expect(prewarm).not.toMatch(/pointer-events\s*:/);
  });

  // 두 규칙 다 한 클래스짜리 selector라 specificity가 같다. 같은 속성을
  // 다시 선언하는 쪽이 이기려면 소스에서 더 뒤에 있어야 한다.
  // .section-prewarm이 .section-hidden보다 앞으로 옮겨지면 예열이 실제로는
  // content-visibility를 올리지 못한다(원래 .section-hidden의 auto가
  // 이겨버린다).
  it('places .section-prewarm after .section-hidden so it wins the cascade', () => {
    const hiddenIndex = css.indexOf('.section-hidden {');
    const prewarmIndex = css.indexOf('.section-prewarm {');

    expect(hiddenIndex).toBeGreaterThan(-1);
    expect(prewarmIndex).toBeGreaterThan(-1);
    expect(prewarmIndex).toBeGreaterThan(hiddenIndex);
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

  // Footer가 320px 폭에서 세 줄로 접히면(이메일, 저작권, github 링크) 약
  // 57px이 되어 기본 45px 띠를 넘친다(jank-and-cleanup 브리프 H4). 내용을
  // 지우지 않고 좁은 화면에서만 .site-footer 높이와 .section-stage 하단
  // 여백을 함께 늘려 겹침 없이 세 줄이 다 들어가게 한다.
  it('defines .site-footer with a 45px baseline that matches .section-stage', () => {
    const footer = ruleBody('.site-footer');

    expect(footer, '.site-footer 규칙이 없다').toBeDefined();
    expect(footer).toMatch(
      /height\s*:\s*calc\(45px \+ env\(safe-area-inset-bottom, 0px\)\)\s*;/
    );
  });

  it('grows .site-footer and .section-stage together under 480px so three wrapped lines fit', () => {
    const footerNarrow = narrowViewportRuleBody('.site-footer');
    const stageNarrow = narrowViewportRuleBody('.section-stage');

    expect(footerNarrow, '.site-footer의 좁은 화면 오버라이드가 없다').toBeDefined();
    expect(stageNarrow, '.section-stage의 좁은 화면 오버라이드가 없다').toBeDefined();

    const footerHeight = footerNarrow!.match(/height\s*:\s*calc\((\d+)px/)?.[1];
    const stageBottom = stageNarrow!.match(
      /inset\s*:\s*72px 0 calc\((\d+)px/
    )?.[1];

    expect(footerHeight, '.site-footer 좁은 화면 height를 못 찾았다').toBeDefined();
    expect(stageBottom, '.section-stage 좁은 화면 inset을 못 찾았다').toBeDefined();
    // 이 값이 서로 다르면 Footer가 섹션 콘텐츠 위로 겹치거나 그 아래에
    // 빈 공간이 남는다.
    expect(footerHeight).toBe(stageBottom);
    // 기본 45px보다는 커야 한다. 안 커지면 320px 오버플로가 그대로 남는다.
    expect(Number(footerHeight)).toBeGreaterThan(45);
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
