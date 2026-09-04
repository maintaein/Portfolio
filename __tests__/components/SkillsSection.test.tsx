import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SkillsSection from '@/components/sections/SkillsSection';
import { findTailwindPaletteColorUtilities } from '@/__tests__/helpers/tailwindPalette';
import { skillCategories } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'components/sections/SkillsSection/index.tsx'),
  'utf8'
);

// 브리프 카테고리 표. 카테고리 넷과 각 소속 기술, 순서까지 이 모양
// 그대로다.
const EXPECTED_CATEGORIES = [
  { label: 'LANGUAGES', names: ['JavaScript', 'TypeScript', 'Python', 'Java'] },
  {
    label: 'FRAMEWORK',
    names: ['Node.js', 'React', 'Next.js', 'Tailwind CSS', 'React Query', 'Zustand', 'Spring'],
  },
  { label: 'SERVER', names: ['MySQL', 'Linux'] },
  { label: 'DEVTOOLS', names: ['GitHub', 'Figma', 'Notion', 'Jira'] },
];

// 17개 전부의 아이콘 파일명. public/icons-mono/의 실제 파일명과 다르면
// mask-image가 빈 사각형을 그린다.
const EXPECTED_ICON_BY_NAME: Record<string, string> = {
  JavaScript: 'javascript',
  TypeScript: 'typescript',
  Python: 'python',
  Java: 'java',
  'Node.js': 'nodejs',
  React: 'react',
  'Next.js': 'nextjs',
  'Tailwind CSS': 'tailwind',
  'React Query': 'react-query',
  Zustand: 'zustand',
  Spring: 'spring',
  MySQL: 'mysql',
  Linux: 'linux',
  GitHub: 'github',
  Figma: 'figma',
  Notion: 'notion',
  Jira: 'jira',
};

// 디자인 리뷰 D23이 정본이다. 이름·증거·연결 프로젝트를 리터럴로 고정한다.
const D23_SKILLS = [
  {
    name: 'React',
    description: '컴포넌트 구독 범위를 Profiler로 진단하고 불필요한 연쇄 렌더를 제거',
    projects: 'AlphaMail · TDS · Ttabong',
  },
  {
    name: 'TypeScript',
    description:
      'strict/no-any와 타입 기반 디자인 토큰으로 잘못된 참조를 컴파일 단계에서 차단',
    projects: 'TDS · AlphaMail · Portfolio · Ttabong',
  },
  {
    name: 'Next.js',
    description: 'SSG/SSR·SEO를 적용하고 hydration 경고를 0건으로 정리',
    projects: 'Portfolio',
  },
  {
    name: 'React Query',
    description:
      '중복 폴링을 단일 20초 전략으로 통합하고 사용자 액션 완료 시 캐시를 즉시 무효화',
    projects: 'AlphaMail',
  },
  {
    name: 'Zustand',
    description: '입력 한 번당 4~5회 연쇄 렌더를 해당 필드 구독 컴포넌트 1회로 축소',
    projects: 'AlphaMail · Ttabong',
  },
  {
    name: 'Tailwind CSS',
    description: '세 웹 프로젝트에서 반응형 UI와 공통 스타일 규칙을 일관되게 적용',
    projects: 'AlphaMail · Portfolio · Ttabong',
  },
];

const ALL_SKILLS = skillCategories.flatMap((category) => category.skills);

function iconSpanOf(button: HTMLElement): HTMLElement {
  const icon = button.querySelector('.skill-icon');
  if (!icon) throw new Error('아이콘 span(.skill-icon)이 없다');
  return icon as HTMLElement;
}

function designTokensCss(): string {
  return readFileSync(resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');
}

// 광휘 두 겹의 공통 규칙 본문. 위치와 켜고 끄는 계약이 여기 모여 있다.
// 크기와 배경은 겹마다 다르다. 바깥 겹은 고정 원반, 안쪽 겹은 로고 실루엣.
function bloomLayerCss(): string {
  const body = designTokensCss().match(
    /^ {2}\.skill-icon-button::before,\n {2}\.skill-icon-button::after\s*\{([\s\S]*?)^ {2}\}/m
  )?.[1];
  if (!body) throw new Error('광휘 겹의 공통 규칙이 없다');
  return body;
}

// 겹 하나의 고유 규칙 본문. 공통 규칙이 두 선택자를 한 줄씩 나열하므로
// 크기를 쥔 쪽을 골라야 공통 규칙을 잘못 집지 않는다.
function bloomShadowCss(layer: 'before' | 'after'): string {
  const bodies = [
    ...designTokensCss().matchAll(
      new RegExp(
        `^ {2}\\.skill-icon-button::${layer}\\s*\\{([\\s\\S]*?)^ {2}\\}`,
        'gm'
      )
    ),
  ].map((m) => m[1]);
  const body = bodies.find((b) => /width:/.test(b));
  if (!body) throw new Error(`::${layer} 겹의 고유 규칙이 없다`);
  return body;
}

describe('SkillsSection 카테고리 아이콘 그리드', () => {
  it('id를 SECTION_IDS.SKILLS로 렌더한다', () => {
    const { container } = render(<SkillsSection />);
    expect(container.querySelector(`#${SECTION_IDS.SKILLS}`)).not.toBeNull();
  });

  // 이 섹션이 존재하는 이유. 카테고리 넷과 소속 기술이 브리프 표와
  // 정확히 같아야 한다. 카테고리가 통째로 바뀌거나, 기술이 다른
  // 카테고리로 새거나, 순서가 바뀌면 이 테스트가 잡는다.
  it('카테고리 넷과 각 소속 기술이 브리프 표 그대로다', () => {
    const actual = skillCategories.map((category) => ({
      label: category.label,
      names: category.skills.map((skill) => skill.name),
    }));
    expect(actual).toEqual(EXPECTED_CATEGORIES);
  });

  it('기술이 17개다', () => {
    expect(ALL_SKILLS).toHaveLength(17);
  });

  // 17개 전부 버튼으로 렌더되고, 각자의 mask-image 소스가 정확한
  // public/icons-mono 파일을 가리킨다. 아이콘 파일명이 하나라도 틀리면
  // mask-image가 빈 사각형을 그리는데 jsdom은 그 실패를 스스로 드러내지
  // 않으므로 소스 문자열을 직접 대조한다.
  it('17개 전부 렌더되고 아이콘 mask 경로가 맞다', () => {
    render(<SkillsSection />);

    for (const [name, icon] of Object.entries(EXPECTED_ICON_BY_NAME)) {
      const button = screen.getByRole('button', { name });
      expect(iconSpanOf(button), `${name}의 아이콘 span이 없다`).toBeTruthy();
      // 마스크 소스는 버튼이 쥔다. 아이콘 span과 광휘 두 겹이 상속으로
      // 같은 실루엣을 읽어야 세 겹이 어긋날 수 없다.
      expect(
        button.style.getPropertyValue('--skill-icon-src'),
        `${name}의 mask 경로가 없다`
      ).toBe(`url(/icons-mono/${icon}.svg)`);
    }
  });

  it('핵심 6개의 D23 문구와 연결 프로젝트가 리터럴 그대로다', () => {
    for (const expected of D23_SKILLS) {
      const skill = ALL_SKILLS.find((s) => s.name === expected.name);
      expect(skill, `${expected.name}이 데이터에 없다`).toBeDefined();
      expect(skill?.description).toBe(expected.description);
      expect(skill?.projects).toBe(expected.projects);
    }
  });

  // 설명 슬롯은 한 번에 기술 하나만 보여준다. 인터랙션 전에도 17개 전부의
  // 설명이 어딘가 텍스트로 있어야 크롤러와 스크린리더 사용자가 나머지
  // 16개를 놓치지 않는다.
  it('인터랙션 전에도 17개 전부의 설명이 문서에 있다(sr-only)', () => {
    const { container } = render(<SkillsSection />);
    const text = container.textContent ?? '';

    for (const skill of ALL_SKILLS) {
      expect(text, `${skill.name}의 설명이 없다`).toContain(skill.description);
    }
  });

  it('아이콘이 버튼이고 접근 가능한 이름을 가진다', () => {
    render(<SkillsSection />);
    for (const name of Object.keys(EXPECTED_ICON_BY_NAME)) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  // 기본은 React다. 호버·포커스·클릭 각각이 설명 슬롯을 바꾸고, 서로
  // 다른 기술로 두 번 옮겨봐야 한쪽 방향만 동작하는 구멍을 잡는다.
  it('기본 설명 슬롯은 React다', () => {
    render(<SkillsSection />);
    const slot = document.querySelector('[data-skill-description-slot]');
    expect(slot).toHaveAttribute('data-active-skill', 'React');
    expect(slot?.textContent).toContain(
      '컴포넌트 구독 범위를 Profiler로 진단하고 불필요한 연쇄 렌더를 제거'
    );
  });

  it('아이콘 호버가 설명 슬롯을 바꾸고, 다른 아이콘으로 옮기면 다시 바뀐다', async () => {
    render(<SkillsSection />);
    const slot = document.querySelector('[data-skill-description-slot]') as HTMLElement;

    await userEvent.hover(screen.getByRole('button', { name: 'Python' }));
    expect(slot).toHaveAttribute('data-active-skill', 'Python');
    expect(slot.textContent).toContain(
      '기본 문법 및 자료구조 활용, pandas, numpy 활용한 데이터 분석 경험'
    );

    await userEvent.hover(screen.getByRole('button', { name: 'Java' }));
    expect(slot).toHaveAttribute('data-active-skill', 'Java');
    expect(slot.textContent).not.toContain(
      '기본 문법 및 자료구조 활용, pandas, numpy 활용한 데이터 분석 경험'
    );
  });

  it('아이콘 포커스가 설명 슬롯을 바꾼다(키보드 접근)', () => {
    render(<SkillsSection />);
    const slot = document.querySelector('[data-skill-description-slot]') as HTMLElement;

    fireEvent.focus(screen.getByRole('button', { name: 'GitHub' }));
    expect(slot).toHaveAttribute('data-active-skill', 'GitHub');

    fireEvent.focus(screen.getByRole('button', { name: 'Figma' }));
    expect(slot).toHaveAttribute('data-active-skill', 'Figma');
  });

  it('아이콘 클릭이 설명 슬롯을 바꾼다(모바일에는 호버가 없다)', async () => {
    render(<SkillsSection />);
    const slot = document.querySelector('[data-skill-description-slot]') as HTMLElement;

    await userEvent.click(screen.getByRole('button', { name: 'Notion' }));
    expect(slot).toHaveAttribute('data-active-skill', 'Notion');

    await userEvent.click(screen.getByRole('button', { name: 'Jira' }));
    expect(slot).toHaveAttribute('data-active-skill', 'Jira');
  });

  // 활성 아이콘에만 skill-icon-active가 붙는다. 붙였다 뗐다 둘 다 봐야
  // "누르면 켜진다"만 확인하고 "떠나면 꺼진다"가 새는 것을 잡는다.
  it('활성 아이콘에만 skill-icon-active 클래스가 붙는다', async () => {
    render(<SkillsSection />);
    const reactIcon = iconSpanOf(screen.getByRole('button', { name: 'React' }));
    const pythonButton = screen.getByRole('button', { name: 'Python' });
    const pythonIcon = iconSpanOf(pythonButton);

    expect(reactIcon.className).toMatch(/\bskill-icon-active\b/);
    expect(pythonIcon.className).not.toMatch(/\bskill-icon-active\b/);

    await userEvent.click(pythonButton);

    expect(iconSpanOf(screen.getByRole('button', { name: 'React' })).className).not.toMatch(
      /\bskill-icon-active\b/
    );
    expect(iconSpanOf(pythonButton).className).toMatch(/\bskill-icon-active\b/);
  });

  // 레이아웃이 흔들리면 안 된다. 가장 짧은 문구(Linux, 20자)와 가장 긴
  // 문구(JavaScript, 65자)를 오가도 슬롯의 높이 클래스는 똑같아야 한다.
  // min-h가 아니라 고정 h를 쓰는지도 함께 고정한다. min-h로 바뀌면
  // className 동일성 검사만으로는 안 잡히므로 클래스 이름 자체도 본다.
  it('설명 슬롯 높이가 고정이다', async () => {
    render(<SkillsSection />);
    const slot = document.querySelector('[data-skill-description-slot]') as HTMLElement;
    const classNameAtDefault = slot.className;

    expect(classNameAtDefault).toMatch(/\bh-36\b/);
    expect(classNameAtDefault).toMatch(/\blg:h-28\b/);
    expect(classNameAtDefault).not.toMatch(/\bmin-h-/);

    await userEvent.hover(screen.getByRole('button', { name: 'Linux' }));
    expect(slot.className).toBe(classNameAtDefault);

    await userEvent.hover(screen.getByRole('button', { name: 'JavaScript' }));
    expect(slot.className).toBe(classNameAtDefault);
  });

  // 카테고리 라벨을 누르면 그 레인만 남고 나머지는 흐려진다. 다시 누르면
  // 해제된다. 양방향 다 확인한다.
  it('카테고리 라벨 클릭이 다른 레인을 흐리게 하고, 다시 누르면 해제한다', async () => {
    render(<SkillsSection />);
    const languagesLabel = screen.getByRole('button', { name: 'LANGUAGES' });

    expect(document.querySelector('[data-skill-category="LANGUAGES"]')).toHaveAttribute(
      'data-skill-category-dimmed',
      'false'
    );
    expect(document.querySelector('[data-skill-category="FRAMEWORK"]')).toHaveAttribute(
      'data-skill-category-dimmed',
      'false'
    );

    await userEvent.click(languagesLabel);

    expect(languagesLabel).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-skill-category="LANGUAGES"]')).toHaveAttribute(
      'data-skill-category-dimmed',
      'false'
    );
    expect(document.querySelector('[data-skill-category="FRAMEWORK"]')).toHaveAttribute(
      'data-skill-category-dimmed',
      'true'
    );
    expect(document.querySelector('[data-skill-category="SERVER"]')).toHaveAttribute(
      'data-skill-category-dimmed',
      'true'
    );
    expect(document.querySelector('[data-skill-category="DEVTOOLS"]')).toHaveAttribute(
      'data-skill-category-dimmed',
      'true'
    );

    await userEvent.click(languagesLabel);

    expect(languagesLabel).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('[data-skill-category="FRAMEWORK"]')).toHaveAttribute(
      'data-skill-category-dimmed',
      'false'
    );
  });

  // 아이콘의 기본과 활성 사이 전환은 즉시다. transition이 없으므로
  // prefers-reduced-motion 방어가 필요 없다. 이 저장소는 언제나
  // transition과 reduce 방어를 짝지어 왔으므로, 누가 여기 transition을
  // 붙이면 이 테스트가 막아서 방어도 함께 넣게 만든다.
  it('아이콘 상태 전환에 transition이 없다, 그래서 reduce 방어도 필요 없다', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'styles/design-tokens.css'),
      'utf8'
    );
    // .skill-icon의 마스크가 빠지면 17개가 전부 시안 사각형이 된다. 광휘
    // 겹을 고치다 마스크를 지우는 변이가 여기서 안 잡히는 것을 봤다.
    const iconRule = css.match(
      /^ {2}\.skill-icon\s*\{([\s\S]*?)^ {2}\}/m
    )?.[1];
    expect(iconRule, '.skill-icon 규칙이 없다').toBeDefined();
    expect(
      iconRule,
      '마스크가 빠지면 아이콘이 전부 시안 사각형이 된다'
    ).toMatch(/mask:\s*var\(--skill-icon-src\)/);

    for (const sel of [
      '.skill-icon',
      '.skill-icon-active',
      '.skill-icon-button::before',
    ]) {
      const body = css.match(
        new RegExp(`^  \\${sel}\\s*\\{([\\s\\S]*?)^  \\}`, 'm')
      )?.[1];
      expect(body, `${sel} 규칙을 찾지 못했다`).toBeDefined();
      expect(
        body,
        `${sel}에 transition이 생겼다. reduce 블록에 transition: none을 짝지어라`
      ).not.toMatch(/transition/);
    }
  });

  // 광휘 겹은 버튼 뒤에 깔리므로 z-index가 음수여야 하고, 버튼에 클래스가
  // 붙어야 CSS가 살아 있다. 둘 중 하나만 빠져도 눈으로는 "그냥 좀 약하네"로
  // 보여 넘어가기 쉬운데, z-index가 뒤집히면 번짐이 아이콘을 덮어 로고가
  // 시안 덩어리로 뭉개진다. 그래서 따로따로 못 박는다.
  it('광휘 겹이 아이콘 뒤에 깔리고 버튼이 그 클래스를 갖는다', () => {
    const glow = bloomLayerCss();
    expect(
      glow,
      '번짐이 아이콘 앞으로 나오면 로고가 뭉개진다. z-index를 음수로 둬라'
    ).toMatch(/z-index:\s*-\d/);
    expect(glow, '기본 상태에서 번짐이 보이면 안 된다').toMatch(
      /opacity:\s*0\s*;/
    );

    // 안쪽 겹만 로고 모양을 따라간다. 실루엣은 배경 이미지로 얻는다.
    // 바깥 겹은 일부러 실루엣을 안 쓴다. drop-shadow는 알파 면적에 비례해
    // 빛나서 원이 꽉 찬 Next.js와 획만 가는 MySQL이 몇 배씩 차이 났다.
    // 여기에 --skill-icon-src가 되돌아오면 그 차이도 같이 돌아온다.
    expect(
      bloomShadowCss('after'),
      '광휘가 로고 모양을 안 따라간다. ::after의 background에 --skill-icon-src를 줘라'
    ).toMatch(/background:\s*var\(--skill-icon-src\)/);
    expect(
      bloomShadowCss('before'),
      '바깥 겹이 실루엣을 쓰면 아이콘마다 광휘 세기가 달라진다'
    ).not.toMatch(/--skill-icon-src/);
    expect(
      bloomShadowCss('before'),
      '바깥 겹은 17개가 공유하는 고정 원반이어야 한다'
    ).toMatch(/background:\s*var\(--skill-icon-ambient\)/);

    // 이 겹에 마스크를 걸면 안 된다. CSS는 filter 다음에 mask를 적용하므로
    // 마스크가 방금 만든 그림자를 도로 잘라내고, 광휘가 아이콘 밖으로 한
    // 픽셀도 안 나간다. 눈으로는 "그냥 좀 약하네"로 보여 넘어가기 쉬운데
    // 실제로는 아무것도 안 그려진다. 한 번 그렇게 배포했다.
    expect(
      glow,
      'mask를 걸면 그림자가 마스크에 잘려 광휘가 아예 안 보인다'
    ).not.toMatch(/mask:/);

    // 배율을 건드리면 파낸 구멍이 어긋나 뒤의 흰 실루엣이 비친다.
    // JavaScript의 JS 글자가 흰색으로 메워진다. 이것도 한 번 배포했다.
    expect(
      glow,
      '배율을 바꾸면 파낸 구멍이 어긋나 로고 글자가 메워진다'
    ).not.toMatch(/scale\(/);

    // 실루엣에서 바깥으로 나가는 것은 drop-shadow뿐이어야 한다. blur는
    // 몸통 자체를 흐리게 만들어 도형이 그대로 커진 것처럼 보인다.
    const shadow = bloomShadowCss('after');
    expect(shadow, '::after가 drop-shadow가 아니다').toMatch(
      /filter:\s*drop-shadow\(/
    );
    expect(
      shadow,
      '::after의 blur는 몸통을 통째로 번지게 해서 도형 티가 난다'
    ).not.toMatch(/blur\(/);

    // 패스가 하나로 줄면 가는 획이 다시 어두워진다. 알파가 1에서 멈추므로
    // 첫 패스가 획 사이를 메우는 동안 꽉 찬 로고는 더 밝아지지 못한다.
    // 그 비대칭이 세기 차이를 좁히는 장치다.
    expect(
      shadow.match(/drop-shadow\(/g)?.length ?? 0,
      '::after의 drop-shadow가 한 겹이면 가는 획 로고가 다시 어두워진다'
    ).toBeGreaterThanOrEqual(2);

    // 두 겹의 크기가 같으면 겹칠 이유가 없다. 넓은 원반과 좁은 실루엣이
    // 있어야 심지에서 바깥까지 자연스럽게 떨어진다.
    const size = (layer: 'before' | 'after') =>
      Number(bloomShadowCss(layer).match(/width:\s*(\d+)px/)?.[1]);
    expect(
      size('before'),
      '::before가 넓은 겹이어야 한다'
    ).toBeGreaterThan(size('after'));

    // 클래스가 버튼에 없으면 위 CSS는 전부 죽은 코드다. 마스크 소스도
    // 버튼이 쥐어야 가상 요소가 읽는다.
    render(<SkillsSection />);
    const iconButton = screen.getByRole('button', { name: 'React' });
    expect(iconButton.className).toMatch(/\bskill-icon-button\b/);
    expect(iconButton.style.getPropertyValue('--skill-icon-src')).toBe(
      'url(/icons-mono/react.svg)'
    );
  });

  // 광휘가 :hover를 따라가면 마우스를 뗀 순간 꺼진다. 그런데 설명 슬롯은
  // 그 기술을 계속 보여주고 있어서, 아래 글이 어느 아이콘 이야기인지
  // 가리키는 것이 사라진다. 그래서 활성 클래스를 따라가야 한다. CSS의
  // 선택자와 React의 상태 둘 다 봐야 이 계약이 지켜진다.
  it('마우스를 떼도 광휘가 유지된다(활성 클래스를 따라간다)', async () => {
    const css = designTokensCss();
    expect(
      css,
      '광휘를 켜는 규칙이 활성 클래스를 따라가지 않는다'
    ).toMatch(/\.skill-icon-button:has\(\.skill-icon-active\)::before\s*\{/);
    expect(
      css,
      '광휘가 :hover로 켜지면 마우스를 떼는 순간 꺼진다'
    ).not.toMatch(/\.skill-icon-button:hover/);

    // React 상태 쪽. 떠난 뒤에도 활성 클래스가 남아 있어야 위 CSS가 켜진 채
    // 유지된다.
    const user = userEvent.setup();
    render(<SkillsSection />);
    const python = screen.getByRole('button', { name: 'Python' });

    await user.hover(python);
    expect(iconSpanOf(python).className).toMatch(/\bskill-icon-active\b/);

    await user.unhover(python);
    expect(
      iconSpanOf(python).className,
      '마우스를 떼자 활성 클래스가 사라졌다. 광휘도 같이 꺼진다'
    ).toMatch(/\bskill-icon-active\b/);
  });

  // 좁은 겹이 먼저 켜지고 넓은 겹이 늦게 붙어야 번짐이 바깥으로 자라는
  // 것처럼 읽힌다. 이 저장소는 언제나 움직임과 reduce 방어를 짝지어 왔다.
  // fill-mode도 못 박는다. forwards는 끝난 뒤에도 상태를 남겨 position:
  // fixed 자손의 컨테이닝 블록이 되는데, 섹션 전환에서 이미 한 번 데었다.
  it('광휘 애니메이션에 backwards와 reduce 방어가 짝지어져 있다', () => {
    const css = designTokensCss();
    const keyframes = css.match(
      /@keyframes skill-bloom\s*\{([\s\S]*?)^ {2}\}/m
    )?.[1];
    expect(keyframes, 'skill-bloom keyframes가 없다').toBeDefined();
    expect(
      keyframes,
      'to 프레임을 두면 최종 상태를 규칙에서 못 쥔다'
    ).not.toMatch(/\bto\b|100%/);

    const on = (layer: 'before' | 'after') =>
      css.match(
        new RegExp(
          `\\.skill-icon-button:has\\(\\.skill-icon-active\\)::${layer}\\s*\\{([\\s\\S]*?)^ {2}\\}`,
          'm'
        )
      )?.[1];

    for (const layer of ['before', 'after'] as const) {
      const rule = on(layer);
      expect(rule, `::${layer}를 켜는 규칙이 없다`).toBeDefined();
      expect(rule, `::${layer}에 광휘 애니메이션이 없다`).toMatch(
        /animation:\s*skill-bloom/
      );
      expect(
        rule,
        `::${layer}에 forwards나 both를 쓰면 상태가 남는다`
      ).not.toMatch(/forwards|both/);
      expect(rule, `::${layer}에 backwards가 없다`).toMatch(/backwards/);
    }

    // 넓은 겹(::before)만 지연을 갖는다. 지연이 빠지면 두 겹이 같이 켜져
    // 그냥 페이드인이 되고, 바깥으로 자라는 느낌이 사라진다.
    expect(
      on('before'),
      '넓은 겹에 지연이 없으면 번짐이 자라지 않고 그냥 켜진다'
    ).toMatch(/animation:[^;]*var\(--animate-duration-fast\)\s+backwards/);
    expect(
      on('after'),
      '좁은 겹은 지연 없이 먼저 켜져야 한다'
    ).toMatch(/animation:\s*skill-bloom\s+var\([^)]*\)\s+ease-out\s+backwards/);

    // 움직이는 것은 transform과 opacity뿐이어야 한다. drop-shadow 반경을
    // 전환하면 매 프레임 알파를 다시 흐리게 만든다. START 호버가 끊겼던
    // 원인이 그것이었다(파티클 잔소음 브리프 6차).
    expect(
      keyframes,
      'keyframes에서 filter를 건드리면 매 프레임 다시 흐려진다'
    ).not.toMatch(/filter|drop-shadow/);

    const reduce = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.skill-icon-button:has\([\s\S]*?\n {2}\}/
    )?.[0];
    expect(reduce, '광휘 애니메이션에 reduce 방어가 없다').toBeDefined();
    expect(reduce, 'reduce에서 애니메이션을 꺼야 한다').toMatch(
      /animation:\s*none/
    );
  });
  // 아이콘 하나만 보면 구멍이 남는다. 처음 이 테스트가 React 버튼만 봤고,
  // 그 사이 카테고리 라벨 버튼 넷이 112x28px로 빠져 있었다. 컨트롤러가
  // 브라우저에서 재고 나서야 발견했다. 그래서 섹션 안 모든 버튼을 센다.
  it('섹션 안의 모든 버튼이 44px 터치 타깃을 지킨다', () => {
    const { container } = render(<SkillsSection />);
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.length, '버튼을 하나도 찾지 못했다').toBeGreaterThan(0);

    const tooSmall = buttons
      .filter((b) => !/\bmin-h-11\b/.test(b.className))
      .map((b) => (b.textContent ?? '').trim().slice(0, 20));
    expect(
      tooSmall,
      `44px 최소 높이가 없는 버튼: ${tooSmall.join(', ')}`
    ).toEqual([]);

    // 아이콘 버튼은 가로도 좁아질 수 있어 폭까지 본다. 카테고리 라벨은
    // 글자가 길어 가로는 자연히 넉넉하다.
    const iconButton = screen.getByRole('button', { name: 'React' });
    expect(iconButton.className).toMatch(/\bmin-w-11\b/);
  });

  // Hyperspeed 광선이 설명 슬롯 뒤를 지나간다. 전면 카드(불투명 단색)로
  // 덮으면 안 되고 텍스트 영역에만 국소 그라데이션을 깔아야 한다(브리프
  // "배경과 대비" 절, About의 scrim.ts와 같은 처방).
  it('설명 슬롯 뒤에 스크림이 있고 평평한 막이 아니라 그라데이션이다', () => {
    const { container } = render(<SkillsSection />);
    const scrim = container.querySelector('[data-skill-description-scrim]');
    expect(scrim, '설명 슬롯 스크림이 없다').not.toBeNull();

    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    expect(scrim?.className).toMatch(/\bpointer-events-none\b/);
    expect(scrim?.className).toMatch(/\babsolute\b/);
    expect(scrim?.className).toMatch(/-z-\[1\]/);

    const background = (scrim as HTMLElement).style.background;
    expect(background, '평평한 단색이 아니라 그라데이션이어야 한다').toMatch(/gradient/);
  });

  it('Github가 아니라 GitHub다', () => {
    render(<SkillsSection />);
    expect(screen.getByRole('button', { name: 'GitHub' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bGithub\b/);
  });

  it('탭과 AnimatePresence와 next/image, framer-motion을 쓰지 않는다', () => {
    expect(SOURCE).not.toMatch(/framer-motion/);
    expect(SOURCE).not.toMatch(/AnimatePresence/);
    expect(SOURCE).not.toMatch(/next\/image/);
    expect(SOURCE).not.toMatch(/whileInView/);
  });

  it('<img> 태그를 쓰지 않는다(mask-image 전용)', () => {
    const { container } = render(<SkillsSection />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('설명이 line-clamp나 말줄임으로 잘리지 않는다', () => {
    expect(SOURCE).not.toMatch(/line-clamp/);
    expect(SOURCE).not.toMatch(/truncate/);
    expect(SOURCE).not.toMatch(/text-ellipsis/);
  });

  it('마크업에 라이트 팔레트 유틸리티가 0건이다', () => {
    const { container } = render(<SkillsSection />);
    expect(findTailwindPaletteColorUtilities(container.innerHTML)).toEqual([]);
  });

  // 이 저장소의 SEO 계약. 크롤러는 HTML을 읽지 Ctrl+F를 쓰지 않는다.
  it('의미 콘텐츠가 SSR HTML에 존재한다', () => {
    const html = renderToString(<SkillsSection />);
    expect(html).toContain(`id="${SECTION_IDS.SKILLS}"`);

    for (const category of EXPECTED_CATEGORIES) {
      expect(html).toContain(category.label);
      for (const name of category.names) {
        expect(html).toContain(name);
      }
    }

    for (const skill of D23_SKILLS) {
      expect(html).toContain(skill.description);
      expect(html).toContain(skill.projects);
    }
  });
});
