import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');

function ruleBody(selector: string): string | undefined {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`^  ${escapedSelector}\\s*\\{([\\s\\S]*?)^  \\}`, 'm'))?.[1];
}

// ruleBody는 selector 바로 뒤에 '{'가 오는 단일 selector 규칙만 찾는다.
// fill-mode 공유 규칙(위 섹션 전환 주석 참고)은 selector 넷을 쉼표로 묶은
// 규칙 하나라 각 selector 줄이 '{'가 아니라 ','로 끝난다. selector가 그
// 목록의 멤버로만 등장하는 경우를 잡는다.
function memberRuleBody(selector: string): string | undefined {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(
    new RegExp(`^  ${escapedSelector},[\\s\\S]*?\\{([\\s\\S]*?)^  \\}`, 'm')
  )?.[1];
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

  // 전환의 확대 원점이다. 터널의 수렴 지점은 도로가 휘면서 프레임마다
  // 움직이므로(컨트롤러 측정: y가 42%에서 65% 사이) 정확한 한 점이 없다.
  // 평균값을 토큰으로 두고 실기기에서 조정한다.
  it('소실점 좌표가 토큰으로 있다', () => {
    const theme = css.match(/@theme \{([\s\S]*?)\n\}/)?.[1];
    expect(theme, '@theme 블록을 찾지 못했다').toBeDefined();
    expect(theme).toMatch(/--tunnel-vanishing-x:\s*[\d.]+%/);
    expect(theme).toMatch(/--tunnel-vanishing-y:\s*[\d.]+%/);
  });

  // 나가는 것과 들어오는 것이 같은 500ms를 쓰고 크기도 같아 중간 지점에서
  // 구분할 단서가 없었다. 그래서 두 화면이 포개진 것으로 보였다.
  // 나가는 쪽을 base(300ms)로, 들어오는 쪽을 slow(500ms)로 벌린다.
  it('나가는 쪽이 들어오는 쪽보다 빨리 끝난다', () => {
    const theme = css.match(/@theme \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const base = Number(
      theme.match(/--animate-duration-base:\s*(\d+)ms/)?.[1]
    );
    const slow = Number(
      theme.match(/--animate-duration-slow:\s*(\d+)ms/)?.[1]
    );
    expect(base).toBeLessThan(slow);

    expect(
      ruleBody(".section-visible[data-section-direction='forward']")
    ).toMatch(/animation-duration:\s*var\(--animate-duration-slow\)/);
    expect(
      ruleBody(
        ".section-hidden[data-section-leaving][data-section-direction='forward']"
      )
    ).toMatch(/animation-duration:\s*var\(--animate-duration-base\)/);
  });

  // fill-mode가 forwards나 both면 애니메이션이 끝난 뒤에도 transform이
  // 남는다. transform이 있는 조상은 position: fixed의 기준이 되므로
  // About 스크림(최종 리뷰 C1)이 다시 무대 안에 갇힌다.
  //
  // 최종 리뷰 I3: 예전 버전은 css.indexOf(...)가 -1이면 slice(-1)로
  // 무너져 사실상 마지막 한 글자만 봤고(selector가 존재하지 않아도 통과),
  // longhand(animation-fill-mode)만 찾아 shorthand(animation: ... both;)로
  // 다시 쓰이면 못 잡았으며, 범위가 파일 끝까지라 무관한 규칙까지 함께
  // 봤다. 이제 관련 규칙마다 ruleBody(선택자 하나짜리 규칙)나
  // memberRuleBody(콤마로 묶인 규칙의 대표 selector 하나)로 본문을 직접
  // 집어 shorthand·longhand 둘 다 검사한다. 섹션과 BootSequence(I1) 양쪽을
  // 다 본다.
  it('애니메이션이 끝난 뒤 transform을 남기지 않는다', () => {
    // 콤마로 묶인 fill-mode 공유 규칙. 대표로 forward 하나만 찾아도
    // 같은 본문을 넷이 공유한다(위 섹션 전환 주석).
    for (const selector of [
      ".section-visible[data-section-direction='forward']",
      ".boot-caption-visible[data-section-direction='forward']",
    ]) {
      const body = memberRuleBody(selector);
      expect(body, `${selector}가 속한 콤마 규칙을 찾지 못했다`).toBeDefined();
      expect(body).not.toMatch(/animation-fill-mode:\s*(forwards|both)/);
      expect(body).not.toMatch(/animation:\s*[^;]*\b(forwards|both)\b/);
    }

    // 이름·길이만 정하는 단일 selector 규칙 넷(섹션 둘, boot-caption 둘).
    // 지금은 fill-mode를 선언하지 않지만, 나중에 shorthand로 합쳐지면
    // 여기서 잡는다.
    for (const selector of [
      ".section-visible[data-section-direction='forward']",
      ".section-visible[data-section-direction='backward']",
      ".section-hidden[data-section-leaving][data-section-direction='forward']",
      ".section-hidden[data-section-leaving][data-section-direction='backward']",
      ".boot-caption-visible[data-section-direction='forward']",
      ".boot-caption-visible[data-section-direction='backward']",
      ".boot-caption-hidden[data-section-leaving][data-section-direction='forward']",
      ".boot-caption-hidden[data-section-leaving][data-section-direction='backward']",
    ]) {
      const body = ruleBody(selector);
      expect(body, `${selector} 규칙을 찾지 못했다`).toBeDefined();
      expect(body).not.toMatch(/animation-fill-mode:\s*(forwards|both)/);
      expect(body).not.toMatch(/animation:\s*[^;]*\b(forwards|both)\b/);
    }
  });

  // 확대 원점이 요소 중심이면 제자리 줌이 된다.
  it('확대 원점이 소실점 토큰이다', () => {
    expect(css).toMatch(
      /transform-origin:\s*var\(--tunnel-vanishing-x\)\s+var\(--tunnel-vanishing-y\)/
    );
  });

  // 이탈 키프레임은 from을 반드시 적어야 한다. 키프레임이 opacity를
  // 건드리지 않으므로(아래 "전환 키프레임이 opacity를 건드리지 않는다"
  // 참고) 시작 상태(scale(1))를 명시해야 이탈이 제자리에서 커지기
  // 시작한다는 것이 코드로 드러난다.
  it('이탈 키프레임이 시작값을 명시한다', () => {
    for (const name of ['section-leave-forward', 'section-leave-backward']) {
      const frames = css.match(
        new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n {2}\\}`)
      )?.[1];
      expect(frames, `${name}을 찾지 못했다`).toBeDefined();
      expect(frames).toMatch(/from \{/);
      expect(frames).toMatch(/transform:\s*scale\(1\)/);
    }
  });

  // 전진과 후진의 배율 방향이 반대여야 한다. 같으면 방향이 안 읽힌다.
  it('전진과 후진의 키프레임이 서로 다르다', () => {
    const frames = (name: string) =>
      css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n {2}\\}`))?.[1];

    expect(frames('section-enter-forward')).toBeDefined();
    expect(frames('section-enter-backward')).toBeDefined();
    expect(frames('section-enter-forward')).not.toBe(
      frames('section-enter-backward')
    );
    expect(frames('section-leave-forward')).not.toBe(
      frames('section-leave-backward')
    );
  });

  // 최종 리뷰 I4: 예전 버전은 파일 안의 reduce 블록 다섯 개를 전부 이어붙여
  // 검사했다. [data-section-direction]과 animation: none이 서로 다른
  // 블록에서 각각 만족돼도 통과했다(나머지 네 블록엔 [data-section-direction]도,
  // animation: none과 무관한 다른 규칙도 섞여 있다). [data-section-direction]을
  // 포함하는 그 블록 하나만 뽑아 그 안에서 검사한다.
  it('reduce에서 전환 애니메이션이 끊긴다', () => {
    const reduceBlock = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{\n {4}\.section-hidden,[\s\S]*?\n {2}\}/
    )?.[0];
    expect(reduceBlock, '[data-section-direction]을 포함하는 reduce 블록을 찾지 못했다').toBeDefined();
    expect(reduceBlock).toMatch(/\[data-section-direction\]/);
    expect(reduceBlock).toMatch(/animation:\s*none/);

    // I1: BootSequence(boot-caption-*)도 같은 블록 안에서 함께 끊겨야 한다.
    expect(reduceBlock).toMatch(/boot-caption-visible\[data-section-direction\]/);
    expect(reduceBlock).toMatch(/boot-caption-hidden\[data-section-direction\]/);

    // I4 부수 발견: leaving 선택자의 transition-duration(특이도 0-0-3-0)이
    // 위 .section-hidden{transition:none}(0-0-1-0)을 특이도로 이긴다. 같은
    // 특이도(0-0-3-0)로 한 번 더 끊는 규칙이 이 블록 안에 있어야 한다.
    expect(reduceBlock).toMatch(
      /\.section-hidden\[data-section-leaving\]\[data-section-direction='forward'\],[\s\S]*?transition:\s*none;/
    );
  });

  // 키프레임이 opacity를 건드리면 안 된다. .section-hidden도 진입
  // 애니메이션의 0% 지점도 opacity 0이라, 클래스가 바뀌는 순간의 전후
  // 계산값이 같아진다. CSS 전환은 값이 바뀌어야 시작하므로 transitionend가
  // 오지 않고, 그것으로 닫히는 completeTransition이 영영 안 불려
  // isTransitioning이 true로 굳는다. 배경 가속이 안 꺼지고 예열도 멈춘다.
  // 페이드는 .section-hidden과 .section-visible의 transition: opacity가
  // 이미 맡고 있다.
  it('전환 키프레임이 opacity를 건드리지 않는다', () => {
    for (const name of [
      'section-enter-forward',
      'section-enter-backward',
      'section-leave-forward',
      'section-leave-backward',
    ]) {
      const frames = css.match(
        new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n {2}\\}`)
      )?.[1];
      expect(frames, `${name}을 찾지 못했다`).toBeDefined();
      expect(
        frames,
        `${name}이 opacity를 건드리면 transitionend가 오지 않는다`
      ).not.toMatch(/opacity/);
    }
  });
});
