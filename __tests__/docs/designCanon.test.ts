import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 디자인 정본이 어디 있는지가 흩어져 있었다. 루트에 진입점이 없어서 새로
// 들어온 사람도, 에이전트도 `.claude/DESIGN_GUIDE.md`를 찾지 못하고 옛
// 처방을 그대로 따라 썼다. 실제로 계획 5 문서는 "섹션 배경을 30%로
// 감광한다"고 적혀 있는데 사용자는 그 뒤에 0.55로 확정했다. 이런 드리프트를
// 문서 하나가 아니라 계약으로 막는다.
//
// 이 파일이 지키는 것은 커밋되는 표면뿐이다. `.claude/`는 gitignore 대상이라
// CI에 존재하지 않으므로 그 내용은 단언하지 않는다.
const root = (...p: string[]) => path.resolve(process.cwd(), ...p);
const read = (...p: string[]) => readFileSync(root(...p), 'utf8');

describe('디자인 정본 발견 경로', () => {
  it('루트에 DESIGN.md가 있다', () => {
    expect(
      existsSync(root('DESIGN.md')),
      '루트 DESIGN.md가 없으면 정본을 찾을 진입점이 없다'
    ).toBe(true);
  });

  // 인덱스는 두 정본을 가리키기만 한다. 설명 정본과 값 정본이 갈라져
  // 있다는 것 자체가 계약이다.
  it('DESIGN.md가 설명 정본과 값 정본을 모두 가리킨다', () => {
    const design = read('DESIGN.md');
    expect(design, '설명 정본 링크가 없다').toContain(
      '.claude/DESIGN_GUIDE.md'
    );
    expect(design, '값 정본 링크가 없다').toContain(
      'styles/design-tokens.css'
    );
  });

  // 값을 복제하면 그 순간부터 둘이 어긋난다. 인덱스는 값을 적지 않는다.
  it('DESIGN.md가 토큰 값을 복제하지 않는다', () => {
    const design = read('DESIGN.md');
    const hex = design.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex, `색 값이 복제됐다: ${hex.join(', ')}`).toHaveLength(0);
    const ms = design.match(/\b\d+ms\b/g) ?? [];
    expect(ms, `지속 값이 복제됐다: ${ms.join(', ')}`).toHaveLength(0);
  });
});

describe('Safe Area 책임', () => {
  // design-tokens.css가 env(safe-area-inset-*)로 푸터 높이와 무대 여백을
  // 계산한다. 그런데 Next는 기본 viewport에 viewport-fit=cover를 넣지
  // 않는다. 그 선언이 없으면 iOS에서 env() 값이 언제나 0이라 계산이
  // 조용히 무의미해지고 푸터가 홈 인디케이터에 깔린다. 두 파일이 같은
  // 계약을 공유해야 하므로 CSS가 safe area를 쓰는 한 layout이 cover를
  // 켜야 한다고 못박는다.
  it('CSS가 safe area를 쓰면 layout이 viewport-fit=cover를 켠다', () => {
    const css = read('styles', 'design-tokens.css');
    const usesSafeArea = /env\(\s*safe-area-inset-/.test(css);
    expect(usesSafeArea, 'CSS가 safe area를 쓰지 않는다').toBe(true);

    const layout = read('app', 'layout.tsx');
    expect(layout, 'layout에 viewport export가 없다').toMatch(
      /export const viewport\b/
    );
    expect(layout, "viewportFit: 'cover'가 없으면 env()가 언제나 0이다").toMatch(
      /viewportFit:\s*'cover'/
    );
  });
});
