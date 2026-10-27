import { useRef as useVisibilityRef } from 'react';
const localVisibility = vi.hoisted(() => ({ visible: true, hasEntered: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: localVisibility.visible, hasEntered: localVisibility.hasEntered }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AboutSection, { type AboutSectionHandle } from '@/components/sections/AboutSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { coreValues } from '@/lib/data';
import { ABOUT_SCRIMS } from '@/components/sections/AboutSection/scrim';
import { SECTION_IDS } from '@/lib/constants';
import type { NavId } from '@/hooks/useSectionNav';

vi.mock('@/components/blocks/ElectricLogo', () => ({
  default: ({ src, active, prewarm, onReady, glow, intensity }: {
    src: string;
    active: boolean;
    prewarm?: boolean;
    onReady?: (src: string) => void;
    glow: number;
    intensity: number;
  }) => (
    <div data-electric-src={src} data-electric-active={active} data-electric-prewarm={prewarm} data-glow={glow} data-intensity={intensity}>
      <button type="button" data-signal-ready onClick={() => onReady?.(src)} />
    </div>
  ),
}));
vi.mock('@/components/blocks/AboutRings', () => ({ default: () => null }));
vi.mock('@/components/sections/AboutSection/styles.module.css', () => ({ default: {} }));
vi.mock('@/components/sections/AboutSection/chapter-focus.module.css', () => ({ default: {} }));

// 문서 스크롤 위치. jsdom은 스크롤하지 않으므로 scrollTo가 이 값만 옮긴다.
let documentY = 0;
beforeEach(() => {
  localVisibility.visible = true; localVisibility.hasEntered = true;
  documentY = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => documentY });
  vi.spyOn(window, 'scrollTo').mockImplementation(((options: ScrollToOptions) => { documentY = options.top ?? documentY; }) as typeof window.scrollTo);
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 1024px)', media: query,
      addEventListener: () => {}, removeEventListener: () => {},
    }))
  );
});

// HomeClient는 항상 이 Provider로 전 섹션을 감싼다. AboutSection은 정적
// 원문 여부를 정할 때 useSectionActivity().reducedMotion을 읽는다.
// reducedMotion을 matchMedia 스텁 값으로 계산해 넘겨야 모션 감소 테스트의
// stubGlobal 재정의가 실제로 전달된다.
// active는 스크림 포털(C1)의 활성 게이트다. 스크림 동작을 보는 테스트는
// About이 실제로 활성이어야 하므로 기본값을 about으로 둔다.
function renderAboutSection(active: NavId = SECTION_IDS.ABOUT) {
  localVisibility.visible = active === SECTION_IDS.ABOUT;
  return render(
    <SectionActivityProvider obscured={false}


      pageVisible
      routeResolved
      motionReady
      reducedMotion={matchMedia('(prefers-reduced-motion: reduce)').matches}
    >
      <AboutSection onChapterChange={() => {}} navigationPending={false} />
    </SectionActivityProvider>
  );
}

describe('AboutSection', () => {
  // Cubes와 Orbit은 폐기했다. 배경이 이미 있는데 별도 도형을 얹으면 경쟁한다.
  // 되살리면 이 테스트가 FAIL한다.
  it('장식 컴포넌트를 쓰지 않는다', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/AboutSection/index.tsx'),
      'utf8'
    );
    expect(source).not.toMatch(/blocks\/Cubes/);
    expect(source).not.toMatch(/blocks\/Orbit/);
  });

  // 위 잠금은 한때 next/dynamic 자체를 금지했다. 그 금지가 겨눈 것은
  // "섹션을 코드 스플리팅하지 않는다"는 폐기 처방(DESIGN.md)인데, 섹션이
  // 제 안의 WebGL 블록을 가르는 것은 그 처방이 아니라 오히려 번들 예산이
  // 요구하는 바다(ProjectsSection이 PreviewMorph를 같은 방식으로 가른다).
  // 그래서 WebGL 블록의 지연 로딩만 허용한다. 섹션 자체가
  // 갈리는 회귀는 HomeClient 쪽 잠금이 잡는다.
  // 공유 로고는 HomeClient 셸의 host 하나가 띄운다(2b). About이 두 번째 ElectricLogo를
  // 만들면 Hero에서 넘어온 로고와 두 개가 겹친다.
  it('전기 로고를 직접 띄우지 않고 about-logo 앵커만 둔다', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/AboutSection/index.tsx'),
      'utf8'
    );
    expect(source).not.toContain('@/components/blocks/ElectricLogo\'');
    expect(source).not.toMatch(/import\('@\/components\/blocks\/ElectricLogo'\)/);
    const { container } = renderAboutSection();
    expect(container.querySelectorAll('[data-motion-anchor="about-logo"]')).toHaveLength(1);
    expect(container.querySelector('[data-electric-src]')).toBeNull();
  });

  it('인덱스 항목 3개를 렌더한다', () => {
    renderAboutSection();
    for (const v of coreValues) {
      expect(screen.getByRole('button', { name: new RegExp(v.label) })).toBeInTheDocument();
    }
  });

  it('상세 3개가 전부 DOM에 있다 (SEO 회귀)', () => {
    // 활성 하나만 렌더하면 계획 2가 고친 조건부 렌더 결함을 재생산한다.
    // 조용한 실패라 화면은 멀쩡하고 크롤러만 손해를 본다.
    const { container } = renderAboutSection();
    expect(container.querySelectorAll('[data-detail]')).toHaveLength(3);
  });

  // 증거 문구는 profile.ts에만 두고 상세는 데이터를 그대로 렌더한다.
  it('증거 문자열이 전부 DOM에 있다', () => {
    const { container } = renderAboutSection();
    const html = container.textContent ?? '';
    for (const value of coreValues) {
      for (const evidence of value.evidence) {
        expect(html, `${evidence.label}이 없다`).toContain(evidence.label);
        expect(html, `${evidence.value}이 없다`).toContain(evidence.value);
      }
    }
  });

  it('세 인덱스의 증거 값에 같은 글꼴과 크기를 적용한다', () => {
    const { container } = renderAboutSection();
    const evidence = [...container.querySelectorAll('[data-about-evidence]')];
    expect(evidence).toHaveLength(3);
    expect(new Set(evidence.map((item) => item.className)).size).toBe(1);
    for (const item of evidence) expect(item.querySelectorAll('dd')).toHaveLength(2);
  });

  it('제목·설명·증거 문구의 강조 표기와 설명 문단을 렌더한다', () => {
    const value = coreValues[0];
    const original = {
      title: value.title,
      description: value.description,
      label: value.evidence[0].label,
      evidenceValue: value.evidence[0].value,
    };

    try {
      value.title = '**기술** 역량';
      value.description = '첫 번째 **문단**\n\n두 번째 __문단__';
      value.evidence[0].label = '**경험**';
      value.evidence[0].value = '`React`';

      const { container } = renderAboutSection();
      const detail = container.querySelector('[data-detail="0"]');
      expect(detail?.querySelector('[data-about-title] strong')).toHaveTextContent('기술');
      expect(detail?.querySelectorAll('[data-about-description] p')).toHaveLength(2);
      expect(detail?.querySelector('[data-about-description] strong')).toHaveTextContent('문단');
      expect(detail?.querySelector('[data-about-description] mark')).toHaveTextContent('문단');
      expect(detail?.querySelector('[data-about-evidence] strong')).toHaveTextContent('경험');
      expect(detail?.querySelector('[data-about-evidence] code')).toHaveTextContent('React');
    } finally {
      value.title = original.title;
      value.description = original.description;
      value.evidence[0].label = original.label;
      value.evidence[0].value = original.evidenceValue;
    }
  });

  it('한 앵커의 정적 실루엣이 선택할 때만 형태를 바꾸고 선택을 셸에 알린다', () => {
    const onChapterChange = vi.fn();
    const { container } = render(
      <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}>
        <AboutSection onChapterChange={onChapterChange} navigationPending={false} />
      </SectionActivityProvider>
    );
    const anchor = container.querySelector('[data-motion-anchor="about-logo"]');
    const shape = () => container.querySelector<HTMLElement>('[data-motion-anchor="about-logo"] .about-electric-static-shape')!;
    expect(shape().style.maskImage).toContain('/icons-mono/react.svg');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[1].label) }));
    expect(shape().style.maskImage).toContain('/about/fixtool.webp');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[2].label) }));
    expect(container.querySelector('[data-motion-anchor="about-logo"]')).toBe(anchor);
    expect(shape().style.maskImage).toContain('/about/handshake.webp');
    expect(onChapterChange).toHaveBeenLastCalledWith(2);
  });

  // 공유 로고가 그려지면 셸이 data-logo-live를 단다. 그 전에는 실루엣이 자리를 지킨다.
  it('공유 로고가 살아나기 전까지 정적 실루엣을 보여준다', () => {
    const { container } = renderAboutSection();
    expect(container.querySelector('[data-motion-anchor="about-logo"] .about-electric-static')).toHaveClass('about-electric-static-charging');
    const css = readFileSync(resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');
    expect(css).toMatch(/\[data-logo-live\] \[data-motion-anchor\] \.about-electric-static \{[^}]*opacity: 0;/);
  });

  // TEAMWORK의 현재 증거 항목을 본문에 표시한다.
  it('03 상세의 ROLE / CONVENTION 라벨이 DOM에 있다', () => {
    const { container } = renderAboutSection();
    const html = container.textContent ?? '';
    for (const needle of ['ROLE', 'CONVENTION']) {
      expect(html, `${needle}이 없다`).toContain(needle);
    }
  });

  it('비활성 상세는 inert로 Tab에서 빠진다', () => {
    const { container } = renderAboutSection();
    const details = container.querySelectorAll('[data-detail]');
    const inertCount = Array.from(details).filter((d) => d.hasAttribute('inert')).length;
    expect(inertCount).toBe(2);
  });

  it('인덱스를 누르면 활성 상세가 바뀐다', async () => {
    const { container } = renderAboutSection();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[1].label) }));

    const second = container.querySelector('[data-detail="1"]');
    expect(second?.hasAttribute('inert')).toBe(false);
  });

  it('활성 항목에 aria-current를 준다', async () => {
    renderAboutSection();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[2].label) }));
    expect(screen.getByRole('button', { name: new RegExp(coreValues[2].label) }))
      .toHaveAttribute('aria-current', 'step');
  });

  // 계획 4 Global Constraints: "선택 전까지 01이 활성이다".
  it('선택 전에는 01(index 0)이 활성이다', () => {
    const { container } = renderAboutSection();
    expect(container.querySelector('[data-detail="0"]')?.hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('button', { name: new RegExp(coreValues[0].label) }))
      .toHaveAttribute('aria-current', 'step');
  });

  describe('자동 순환하지 않고 선택된 상세 하나만 활성화한다', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('타이머를 아무리 진행해도 activeIndex가 저절로 바뀌지 않는다', () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const { container } = renderAboutSection();

      vi.advanceTimersByTime(60_000);

      // setInterval을 전혀 쓰지 않아야 한다. 자동 순환 구현은 대개 이걸 쓴다.
      expect(setIntervalSpy).not.toHaveBeenCalled();
      // 01이 그대로 활성이고 나머지 둘은 여전히 inert다.
      const details = container.querySelectorAll('[data-detail]');
      const activeDetails = Array.from(details).filter((d) => !d.hasAttribute('inert'));
      expect(activeDetails).toHaveLength(1);
      expect(activeDetails[0]).toHaveAttribute('data-detail', '0');
    });
  });

  it('상세 요소에 박스·라운드·그림자 클래스가 없다 (헤어라인만 사용)', () => {
    const { container } = renderAboutSection();
    const html = container.innerHTML;
    // rounded-* / shadow-* 유틸리티가 하나라도 붙으면 헤어라인 전용 구조
    // 원칙이 깨진다. 대상을 좁히려고 정확한 유틸리티 접두사만 잡는다.
    expect(html).not.toMatch(/\brounded(-\S+)?\b/);
    expect(html).not.toMatch(/\bshadow(-\S+)?\b/);
  });

  it('라이트 테마 클래스가 남아 있지 않다', () => {
    const { container } = renderAboutSection();
    const html = container.innerHTML;
    for (const cls of ['bg-white', 'text-gray-900', 'text-grey-500', 'from-blue-600', 'shadow-sm', 'rounded-2xl']) {
      expect(html, `${cls}가 남아 있다`).not.toContain(cls);
    }
  });

  // 데스크톱 스크롤의 정체는 텍스트가 폭의 절반만 받아 넘친 것이었다.
  // 50/50 분할을 버렸으므로 스크롤 유틸리티가 있으면 안 된다.
  it('데스크톱에서 스크롤 유틸리티를 쓰지 않는다', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/AboutSection/index.tsx'),
      'utf8'
    );
    expect(source).not.toMatch(/overflow-y-auto/);
    expect(source).not.toMatch(/lg:w-1\/2/);
    expect(source).not.toMatch(/min-h-\[\d+px\]/);
  });

  // 칸을 나누는 경계선이 와이어프레임을 만들었다. 헤어라인으로 박스를 그리지
  // 않는다.
  it('상세 안에 칸을 나누는 경계선이 없다', () => {
    const { container } = renderAboutSection();
    const detail = container.querySelector('[data-detail="0"]');
    expect(detail?.innerHTML).not.toMatch(/\bborder-r\b/);
    expect(detail?.innerHTML).not.toMatch(/\bborder-b\b/);
  });

  it('세 문항이 같은 격자 자리를 쓴다', () => {
    const { container } = renderAboutSection();
    const titles = container.querySelectorAll('[data-about-title]');
    expect(titles).toHaveLength(3);
    const classes = [...titles].map((t) => t.className);
    expect(new Set(classes).size, '세 제목의 배치가 서로 달라졌다').toBe(1);
  });

  // 리뷰 발견 2: 옛 인덱스 nav 안에 있던 about-heading h2를 레일과
  // 분리하면서 sr-only로 다시 심었다. 스크린리더가 실제로 읽는지는 jsdom이
  // 증명하지 못하지만, aria-labelledby가 가리키는 id를 가진 요소가 실제로
  // 존재하는지는 잡을 수 있다. h2를 지우면 FAIL한다.
  it('섹션의 aria-labelledby가 가리키는 id가 실제로 존재한다', () => {
    const { container } = renderAboutSection();
    const section = container.querySelector('section[aria-labelledby]');
    const id = section?.getAttribute('aria-labelledby');
    expect(id, 'aria-labelledby 속성 자체가 없다').toBeTruthy();
    expect(container.querySelector(`#${id}`), `#${id} 요소가 없다`).not.toBeNull();
  });

  // 평평한 검은 막은 배경을 통째로 죽여 어우러짐이 사라진다. 글자가 놓인
  // 오른쪽만 덮고 왼쪽으로는 광선이 흐른다.
  it('스크림이 평평한 막이 아니라 그라데이션이다', () => {
    expect(ABOUT_SCRIMS).toHaveLength(3);
    for (const s of ABOUT_SCRIMS) {
      expect(s).toMatch(/linear-gradient/);
      expect(s).toMatch(/rgb\(0 0 0 \/ 0\)/);
    }
  });

  // 스크림이 .section-stage 안에 있으면 헤더 72px와 푸터 45px 띠가 빠져
  // 그 부분만 배경이 밝게 남는다. 사용자가 배포본에서 본 것이다.
  // fixed로 띄워 뷰포트 전체를 덮는다. Task 4가 섹션 래퍼에 transform을
  // 상시로 남기지 않는 이유가 이것이다.
  it('스크림이 뷰포트 전체를 덮는다(무대 안에 갇히지 않는다)', () => {
    renderAboutSection();
    // 스크림은 document.body로 포털된다(C1). container(About의 section
    // 서브트리) 기준으로는 찾을 수 없다.
    const scrims = document.body.querySelectorAll('[data-about-scrim]');
    expect(scrims.length).toBeGreaterThan(0);
    for (const scrim of scrims) {
      expect(scrim.className, '스크림이 absolute면 무대에 갇힌다').toMatch(
        /\bfixed\b/
      );
      expect(scrim.className).toMatch(/\binset-0\b/);
    }
  });

  // fixed는 positioned라 그냥 두면 흐름 안의 본문 위에 그려진다.
  // 음수 z로 내려 배경(-z-10)과 본문 사이에 둔다.
  it('스크림이 본문 아래에 깔린다', () => {
    renderAboutSection();
    for (const scrim of document.body.querySelectorAll('[data-about-scrim]')) {
      expect(scrim.className).toMatch(/-z-\[1\]/);
    }
  });

  // 레이아웃이 통일되면서 개별성이 콘텐츠와 배경에만 남았다. 셋이 같으면
  // 세 화면이 같아 보인다.
  it('세 문항의 스크림이 서로 다르다', () => {
    expect(new Set(ABOUT_SCRIMS).size).toBe(3);
  });

  it('활성 문항의 스크림만 걸린다', () => {
    renderAboutSection();
    const scrim = document.body.querySelector('[data-about-scrim]');
    expect(scrim).toHaveStyle({ background: ABOUT_SCRIMS[0] });
  });

  // 최종 리뷰 발견 4: 위 테스트는 초기 상태에서 ABOUT_SCRIMS[0]만 보므로
  // 구현을 ABOUT_SCRIMS[0] 하드코딩으로 바꿔도 통과했다. 문항별 배선
  // 자체(레이어마다 다른 배경, 클릭 뒤 활성 레이어 교체)를 여기서 고정한다.
  it('세 스크림 레이어가 문항별로 다른 배경을 갖고, 클릭하면 활성 레이어가 바뀐다', async () => {
    renderAboutSection();
    const layerFor = (index: number) =>
      document.body.querySelector(`[data-about-scrim][data-about-scrim-index="${index}"]`) as HTMLElement;

    // 배선: 인덱스마다 고정된 배경을 받는다 (하드코딩이면 layerFor(2)가
    // ABOUT_SCRIMS[0]와 같아진다).
    expect(layerFor(0)).toHaveStyle({ background: ABOUT_SCRIMS[0] });
    expect(layerFor(2)).toHaveStyle({ background: ABOUT_SCRIMS[2] });

    // 초기: 0만 보이고 2는 숨겨져 있다.
    expect(layerFor(0).className).toMatch(/\bopacity-100\b/);
    expect(layerFor(2).className).toMatch(/\bopacity-0\b/);

    await userEvent.click(screen.getByRole('button', { name: /TEAMWORK/ }));

    // 클릭 뒤: 활성이 2로 넘어간다.
    expect(layerFor(2).className).toMatch(/\bopacity-100\b/);
    expect(layerFor(0).className).toMatch(/\bopacity-0\b/);
  });

  // C1: 스크림이 About의 <section> 서브트리 안에 있으면 조상(.section-scroll)의
  // 전환 transform이 fixed의 기준을 바꿔 무대 안에 갇힌다(진입 500ms 동안
  // 정지했다가 마지막에 튀는 결함). document.body로 포털해 서브트리 밖에
  // 둬야 한다. 포털을 되돌려 섹션 안에서 렌더하게 하면 이 테스트가 FAIL한다.
  it('스크림이 About의 section 서브트리 밖에 있다 (C1, 무대 갇힘 회귀 방지)', () => {
    const { container } = renderAboutSection();
    const section = container.querySelector('section');
    expect(section, 'About section을 찾지 못했다').not.toBeNull();

    expect(section!.querySelectorAll('[data-about-scrim]')).toHaveLength(0);
    expect(document.body.querySelectorAll('[data-about-scrim]').length).toBeGreaterThan(0);
  });

  // C1 재수정: 포털은 .section-hidden의 opacity:0 상속을 벗어나므로 About이
  // 비활성일 때 스스로 감춰야 한다. 처음엔 언마운트(active를 마운트 조건에
  // 넣음)로 했는데, 그러면 About을 떠나는 첫 프레임에 스크림 여섯이 통째로
  // 사라지는 반면 About 본문은 .section-hidden의 opacity transition을 타고
  // 300ms에 걸쳐서만 사라져, 그 사이 글자가 어두워지지 않은 배경 위에 놓이는
  // 새 결함을 냈다(컨트롤러 실측: 130ms 동안 본문 opacity 0.4 이상인데
  // 스크림은 이미 사라짐). 언마운트 대신 불투명도로 감춰야 본문과 나란히
  // 페이드한다. 그래서 이 테스트는 "스크림이 DOM에 없다"가 아니라 "DOM에
  // 있고 opacity-0이다"를 단언한다. 언마운트로 되돌리면 FAIL한다.
  it('About이 비활성이면 스크림이 DOM에 남아 있되 불투명도가 0이다 (C1 재수정, 활성 게이트)', () => {
    renderAboutSection('overview');
    const scrims = document.body.querySelectorAll('[data-about-scrim]');

    expect(scrims.length).toBeGreaterThan(0);
    for (const scrim of scrims) {
      expect(scrim.className).toMatch(/\bopacity-0\b/);
      expect(scrim.className).not.toMatch(/\bopacity-100\b/);
    }
  });

  describe('reading 시안', () => {
    const readingCss = () => readFileSync(resolve(process.cwd(), 'components/sections/AboutSection/styles.module.css'), 'utf8');
    const focusCss = () => readFileSync(resolve(process.cwd(), 'components/sections/AboutSection/chapter-focus.module.css'), 'utf8');

    it('상단에는 BASICS/QUALITY/TEAMWORK만 있고 진행도·인덱스·01/ABOUT·스크롤 안내가 없다', () => {
      const { container } = renderAboutSection();
      const words = within(screen.getByRole('navigation', { name: 'About 문항' })).getAllByRole('button');
      expect(words.map((word) => word.getAttribute('data-chapter-word'))).toEqual(['BASICS', 'QUALITY', 'TEAMWORK']);
      expect(container.querySelector('[role="progressbar"], [data-progress-boundary], [data-chapter-index]')).toBeNull();
      expect(container.textContent).not.toMatch(/01\s*\/\s*ABOUT|스크롤/);
    });

    it('About h2 아래에 chapter 제목 h3가 이어진다', () => {
      const { container } = renderAboutSection();
      expect([...container.querySelectorAll('h1, h2, h3, h4')].map((heading) => heading.tagName)).toEqual(['H2', 'H3', 'H3', 'H3']);
    });

    it('상단 단어는 정지한 광휘로 교차하고 설명은 같은 1초 동안 구면으로 돈다', () => {
      const { container } = renderAboutSection();
      expect(container.querySelector('[data-motion-layout="reading"]')).toHaveStyle({ '--chapter-transition': '1000ms' });
      const focus = focusCss();
      expect(focus).toMatch(/\.glow \{[^}]*transition: opacity calc\(var\(--chapter-transition\) \/ 2\) ease;/);
      expect(focus).not.toMatch(/animation/);
      const reading = readingCss();
      expect(reading).toMatch(/\.panel \{[^}]*filter: blur\(8px\);[^}]*transform: rotateX\(-25deg\);[^}]*transform-origin: 50% 50% calc\(0px - var\(--reading-orbit-radius\)\);/);
      expect(reading).toMatch(/\.panel\[data-position="past"\] \{ transform: rotateX\(25deg\); \}/);
    });

    it('chapter 단어는 44px 이상 누를 자리를 갖는다', () => {
      expect(focusCss()).toMatch(/\.word \{[^}]*min-height: 44px;/);
    });

    // 리뷰 발견 2: 비활성 단어도 누를 수 있는 컨트롤이다. 시안의 .35 불투명·흐림은 검정 위 2:1이었다.
    // 바닥값: 보조 텍스트 토큰, 불투명도 .75 이상, 흐림 없음. 측정은 probe/labels-2a.mjs.
    it('비활성 chapter 단어는 읽을 수 있는 바닥값을 지키고 포커스하면 밝아진다', () => {
      const css = focusCss();
      const label = css.match(/\.label \{([^}]*)\}/)?.[1] ?? '';
      expect(label).toMatch(/color: var\(--color-text-secondary\);/);
      expect(Number(label.match(/opacity: ([\d.]+);/)?.[1] ?? 1)).toBeGreaterThanOrEqual(0.75);
      expect(label).not.toMatch(/blur\(/);
      expect(css).toMatch(/\.word:focus-visible \.label \{[^}]*color: var\(--color-text-primary\);/);
      // 단어 줄 뒤 판이 광선을 눌러 바닥값이 줄 전체에서 유지된다.
      expect(css).toMatch(/\.chapters::before \{[^}]*background: linear-gradient\(/);
    });

    it('chapter 단어는 사이트 글꼴과 디자인 토큰을 쓴다', () => {
      const css = focusCss();
      expect(css).toMatch(/\.word \{[^}]*font-family: inherit;/);
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    });

    // JS가 data-static을 붙이기 전에 해시 이동이 위치를 재므로 배치는 CSS가 첫 페인트부터 맡는다.
    it('정적 원문 배치는 JS와 같은 미디어 조건에서 첫 페인트부터 쌓인다', () => {
      expect(readingCss()).toMatch(/@media \(prefers-reduced-motion: reduce\), \(max-height: 640px\) \{[^@]*\.stage \{ display: block; height: auto;[^@]*\.panelViewport \{ display: block; overflow: visible;/);
    });

    it('좁은 화면에서는 로고 자리를 접는다', () => {
      expect(readingCss()).toMatch(/@media \(max-width: 1023px\) \{[^@]*\.rail \{ display: none; \}/);
    });
  });

  describe('reading 제스처', () => {
    // 섹션의 문서 위 자리. jsdom은 scroll-margin을 계산하지 않으므로 잠금 위치가 곧 이 값이다.
    const START = 1000;
    let clock = 10_000;
    beforeEach(() => {
      clock = 10_000;
      vi.spyOn(performance, 'now').mockImplementation(() => clock);
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const top = this.id === SECTION_IDS.ABOUT ? START - documentY : 0;
        return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      });
    });
    afterEach(() => vi.restoreAllMocks());

    const stamp = <T extends Event>(event: T, at: number) => {
      clock = at;
      Object.defineProperty(event, 'timeStamp', { value: at });
      act(() => { window.dispatchEvent(event); });
      return event;
    };
    const wheel = (deltaY: number, at: number) => stamp(new WheelEvent('wheel', { deltaY, cancelable: true }), at);
    const key = (name: string, at: number) => stamp(new KeyboardEvent('keydown', { key: name, cancelable: true }), at);
    const scrollAt = (top: number, at: number) => { documentY = top; stamp(new Event('scroll'), at); };
    const mount = (top: number, initial: { navigationPending?: boolean; obscured?: boolean; logoOwner?: 'hero' | 'about' | 'boundary' | 'preview' | 'projects' | 'none' } = {}) => {
      documentY = top;
      const handle = createRef<AboutSectionHandle>();
      const onChapterChange = vi.fn();
      const view = ({ navigationPending = false, obscured = false, logoOwner = 'none' }: typeof initial) => (
        <SectionActivityProvider obscured={obscured} pageVisible routeResolved motionReady reducedMotion={matchMedia('(prefers-reduced-motion: reduce)').matches}>
          <AboutSection ref={handle} onChapterChange={onChapterChange} navigationPending={navigationPending} logoOwner={logoOwner} />
        </SectionActivityProvider>
      );
      const utils = render(view(initial));
      return { ...utils, handle, onChapterChange, update: (next: typeof initial) => utils.rerender(view(next)) };
    };
    const chapter = (container: HTMLElement) => container.querySelector('[data-position="active"]')?.getAttribute('data-chapter');
    const isLocked = (container: HTMLElement) => container.querySelector('[data-locked="true"]') !== null;
    const send = (events: [number, number][], base: number) => { for (const [time, delta] of events) wheel(delta, base + time); };

    // 최종 리뷰 triage. 잠금 근처가 아니면 Tab이 About의 유일한 컨트롤을 건너뛰었다. 포커스가 잠금 경로와 같이 About을 연다.
    it('Hero에서 Tab으로 chapter 단어에 닿고, 그 포커스가 BASICS로 잠가 연다', async () => {
      const { container } = mount(0);
      expect(container.querySelector('[data-entered="false"]')).not.toBeNull();
      expect(isLocked(container)).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'BASICS' })).toHaveFocus();
      expect(isLocked(container)).toBe(true);
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
      expect(chapter(container)).toBe('BASICS');
    });

    it('아래에서 Shift+Tab으로 돌아와 마지막 단어에 닿으면 TEAMWORK로 잠근다', async () => {
      const { container } = mount(2400);
      await userEvent.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'TEAMWORK' })).toHaveFocus();
      expect(isLocked(container)).toBe(true);
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
      expect(chapter(container)).toBe('TEAMWORK');
    });

    // M4 Task 0 (M3 최종 재리뷰 N1). 창이나 탭에 돌아오면 브라우저가 떠날 때 포커스가 있던 단어에 focus를 다시 보낸다.
    // 키보드로 단 포커스는 :focus-visible에 그대로 맞아, About을 지나친 방문자를 About으로 끌어올렸다.
    it('chapter 단어에 포커스를 둔 채 About을 지나친 뒤 창에 돌아와도 끌어올리지 않고, 다시 Tab으로 들어오면 잠근다', async () => {
      const { container, handle } = mount(0);
      await userEvent.tab();
      const basics = screen.getByRole('button', { name: 'BASICS' });
      expect(isLocked(container)).toBe(true);
      act(() => handle.current!.release());
      scrollAt(2400, 30_000);
      expect(isLocked(container)).toBe(false);
      vi.mocked(window.scrollTo).mockClear();
      act(() => { window.dispatchEvent(new FocusEvent('blur')); });
      fireEvent.focusIn(basics, { relatedTarget: null });
      expect(basics).toHaveFocus();
      expect(isLocked(container)).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
      // 사용자가 옮긴 포커스는 그대로 잠근다.
      act(() => basics.blur());
      scrollAt(0, 31_000);
      await userEvent.tab();
      expect(basics).toHaveFocus();
      expect(isLocked(container)).toBe(true);
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
    });

    // Task 5. 공유 로고가 About 자리로 날아가는 동안에는 잠그지 않는다. 그사이 잠금 자리에 닿으면 입력은 막지 않고, 내려앉을 때 잠근다.
    it('로고가 날아가는 동안 잠금 자리에 닿으면 입력을 막지 않고 기다렸다가 내려앉을 때 BASICS로 잠근다', () => {
      const { container, update } = mount(900, { logoOwner: 'boundary' });
      expect(wheel(60, 20_000).defaultPrevented).toBe(false);
      documentY = 960;
      expect(wheel(120, 20_016).defaultPrevented).toBe(false);
      expect(key('PageDown', 20_100).defaultPrevented).toBe(false);
      scrollAt(1080, 20_120);
      expect(isLocked(container)).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
      update({ logoOwner: 'about' });
      expect(isLocked(container)).toBe(true);
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
      expect(chapter(container)).toBe('BASICS');
    });

    // Task 10(사용자 결정 2026-10-21). 본문이 나타날 때 로고는 이미 About에 내려앉아 있다. 날아가는 동안에는 본문이 기다리고 입력은 막지 않는다.
    it('본문 등장은 로고 착지에 묶인다: 날아가는 동안 등장 자리에 와도 기다렸다가 내려앉으면 나타나고, 되돌아가면 다시 숨는다', () => {
      const entered = (container: HTMLElement) => container.querySelector('[data-entered]')!.getAttribute('data-entered');
      const { container, update } = mount(START - 300, { logoOwner: 'boundary' });
      expect(entered(container)).toBe('false');
      expect(wheel(60, 20_000).defaultPrevented).toBe(false);
      expect(screen.getByRole('button', { name: 'BASICS' }).closest('[data-entered]')).toHaveAttribute('data-entered', 'false');
      update({ logoOwner: 'about' });
      expect(entered(container)).toBe('true');
      update({ logoOwner: 'boundary' });
      expect(entered(container)).toBe('false');
      update({ logoOwner: 'none' });
      expect(entered(container)).toBe('true');
    });

    // Task 11(사용자 요청 2026-10-22). 위로 돌아갈 때 로고가 볼로 돌아가기 시작하는 순간까지 본문은 다 보인다.
    // 본문은 R(잠금 1000 - 화면 절반 384 = 616) 위로 올라가도 로고가 About에 있는 동안 남고, 로고가 떠나는 프레임에 사라진다. 내려올 때는 그대로 R에서 나타난다.
    it('위로 돌아갈 때 본문은 R이 아니라 로고가 About을 떠나는 순간 사라지고, 내려올 때는 그대로 R에서 나타난다', () => {
      const entered = (container: HTMLElement) => container.querySelector('[data-entered]')!.getAttribute('data-entered');
      const { container, update } = mount(START - 300, { logoOwner: 'about' });
      expect(entered(container)).toBe('true');
      scrollAt(START - 500, 20_000);
      expect(entered(container)).toBe('true');
      update({ logoOwner: 'boundary' });
      expect(entered(container)).toBe('false');
      update({ logoOwner: 'hero' });
      expect(entered(container)).toBe('false');
      // 다시 내려와 R 위에서 내려앉으면 본문은 아직 기다린다.
      update({ logoOwner: 'boundary' });
      update({ logoOwner: 'about' });
      expect(entered(container)).toBe('false');
      scrollAt(START - 300, 20_400);
      expect(entered(container)).toBe('true');
      // 아래로 지나치면 그대로 사라진다.
      scrollAt(START + 500, 20_800);
      expect(entered(container)).toBe('false');
    });

    // Task 12(사용자 요청 2026-10-22). 되돌기는 경로가 Overview로 바뀌는 R 아래 자리에서 시작한다. 본문은 그 프레임에 사라지고,
    // 로고가 Hero에 내려앉은 뒤에도 R과 잠금 자리 사이에서 다시 나타나지 않는다. 다시 내려와 로고가 About에 내려앉으면 나타난다.
    it('R과 잠금 자리 사이에서 로고가 Hero로 돌아가면 본문은 되돌기 시작에 사라지고 Hero에 내려앉아도 다시 나타나지 않는다', () => {
      const entered = (container: HTMLElement) => container.querySelector('[data-entered]')!.getAttribute('data-entered');
      const { container, update } = mount(START - 300, { logoOwner: 'about' });
      expect(entered(container)).toBe('true');
      update({ logoOwner: 'boundary' });
      expect(entered(container)).toBe('false');
      update({ logoOwner: 'hero' });
      expect(entered(container)).toBe('false');
      scrollAt(START - 250, 20_000);
      expect(entered(container)).toBe('false');
      update({ logoOwner: 'boundary' });
      expect(entered(container)).toBe('false');
      update({ logoOwner: 'about' });
      expect(entered(container)).toBe('true');
    });

    // M4 Task 1. 로고가 Projects 프리뷰로 날아가거나(preview) 프리뷰에 넘겨진 동안(projects)에도 About 본문은 About 자신의 규칙(반 화면)을 따른다.
    it('로고가 Projects 프리뷰로 가는 동안과 넘겨진 뒤에도 본문은 그대로이고 반 화면을 지나면 사라진다', () => {
      const entered = (container: HTMLElement) => container.querySelector('[data-entered]')!.getAttribute('data-entered');
      const { container, update } = mount(START + 200, { logoOwner: 'about' });
      expect(entered(container)).toBe('true');
      update({ logoOwner: 'preview' });
      expect(entered(container)).toBe('true');
      update({ logoOwner: 'projects' });
      expect(entered(container)).toBe('true');
      scrollAt(START + 500, 20_000);
      expect(entered(container)).toBe('false');
      update({ logoOwner: 'preview' });
      scrollAt(START + 300, 20_400);
      expect(entered(container)).toBe('true');
    });

    // M4 Task 1. Projects에서 돌아오는 로고가 아직 날고 있어도 About 읽기는 그대로다. 위로 잠금 자리에 닿으면 바로 TEAMWORK로 잠근다
    // (e2e navigation.spec의 "arriving at About locks it"이 지키는 읽던 chapter도 그대로다). Hero에서 About을 지나 프리뷰로 그대로 가면
    // Hero 쪽 비행 동안 미룬 잠금을 버린다.
    it('Projects에서 돌아오는 로고가 날아가는 동안에도 잠금은 바로 잡히고, Hero에서 About을 지나 프리뷰로 가면 미룬 잠금을 버린다', () => {
      const first = mount(START + 300, { logoOwner: 'preview' });
      documentY = START + 60;
      wheel(-120, 20_000);
      expect(isLocked(first.container)).toBe(true);
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
      expect(chapter(first.container)).toBe('TEAMWORK');
      first.unmount();
      vi.mocked(window.scrollTo).mockClear();
      const second = mount(900, { logoOwner: 'boundary' });
      documentY = 960;
      expect(wheel(120, 30_000).defaultPrevented).toBe(false);
      second.update({ logoOwner: 'preview' });
      second.update({ logoOwner: 'projects' });
      expect(isLocked(second.container)).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('로고가 날지 않으면(GL 로고 없음) 본문은 그대로 R에서 사라진다', () => {
      const entered = (container: HTMLElement) => container.querySelector('[data-entered]')!.getAttribute('data-entered');
      const { container } = mount(START - 300);
      expect(entered(container)).toBe('true');
      scrollAt(START - 500, 20_000);
      expect(entered(container)).toBe('false');
    });

    it('로고가 날아가는 동안 반 화면 넘게 지나쳤으면 내려앉아도 끌어오지 않는다', () => {
      const { container, update } = mount(960, { logoOwner: 'boundary' });
      wheel(120, 20_000);
      scrollAt(START + 800, 20_400);
      update({ logoOwner: 'about' });
      expect(isLocked(container)).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    // 리뷰 Important 1. 로고 지점이 잠금 자리에 가까워지면, 잠금 자리에 닿았다가 지점 위로 되돌아간 사람이
    // 로고가 Hero에 내려앉는 순간 About으로 끌려 내려갈 수 있었다. Hero로 내려앉으면 미룬 잠금을 버린다.
    it('로고가 Hero로 되돌아가 내려앉으면 미룬 잠금을 버린다', () => {
      const { container, update } = mount(900, { logoOwner: 'boundary' });
      documentY = 960;
      wheel(120, 20_000);
      scrollAt(START - 300, 20_300);
      update({ logoOwner: 'hero' });
      expect(isLocked(container)).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
      update({ logoOwner: 'boundary' });
      update({ logoOwner: 'about' });
      expect(isLocked(container)).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('진입 제스처는 BASICS에 세우기만 하고 남은 관성은 chapter를 넘기지 않는다', () => {
      const { container } = mount(900);
      wheel(60, 20_000);
      expect(window.scrollTo).not.toHaveBeenCalled();
      documentY = 960;
      wheel(60, 20_016);
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
      expect(isLocked(container)).toBe(true);
      for (let i = 1; i <= 40; i += 1) expect(wheel(40, 20_016 + i * 16).defaultPrevented).toBe(true);
      expect(chapter(container)).toBe('BASICS');
    });

    it('짧은 wheel과 긴 관성은 한 chapter만 넘긴다', () => {
      const { container, onChapterChange } = mount(START);
      expect(isLocked(container)).toBe(true);
      expect(wheel(1, 20_000).defaultPrevented).toBe(true);
      expect(chapter(container)).toBe('QUALITY');
      expect(onChapterChange).toHaveBeenLastCalledWith(1);
      send(Array.from({ length: 60 }, (_, i) => [20 + i * 20, Math.max(1, 30 * 0.95 ** i)]), 20_000);
      expect(chapter(container)).toBe('QUALITY');
      wheel(100, 22_000);
      expect(chapter(container)).toBe('TEAMWORK');
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('쉬지 않은 새 트랙패드 stroke는 다음 chapter로 간다', () => {
      const { container } = mount(START);
      send([[0, 40], [20, 20], [40, 8], [60, 3]], 20_000);
      expect(chapter(container)).toBe('QUALITY');
      send(Array.from({ length: 60 }, (_, i) => [80 + i * 20, 2 * 0.96 ** i]), 20_000);
      expect(chapter(container)).toBe('QUALITY');
      send([[1300, 35], [1320, 45]], 20_000);
      expect(chapter(container)).toBe('TEAMWORK');
    });

    // 실측(headed Chrome, 15fps): 바쁜 메인 스레드는 관성 wheel 둘을 하나로 합쳐 크기가 두 배로 온다.
    it('합쳐진 관성 wheel은 새 stroke로 보지 않는다', () => {
      const { container } = mount(START);
      send([[0, 200], [16, 85], [32, 77], [64, 142.6]], 20_000);
      send(Array.from({ length: 76 }, (_, i) => [80 + i * 16, Math.max(1, 66 * 0.95 ** i)]), 20_000);
      expect(chapter(container)).toBe('QUALITY');
    });

    // 리뷰 발견 1: 마우스 노치는 크기가 늘 같고 간격만 30-160ms로 흔들린다. 간격으로 나눈 속도로 재면 그 흔들림이 새 stroke가 됐다.
    const notches = [0, 45, 60, 110, 40, 35, 90, 150, 50, 40, 70, 120, 45, 38, 85, 140, 55, 42, 95, 60, 35, 120, 45, 90, 40, 130, 50, 35, 80, 160, 30, 75, 110, 45];
    const spin = (base: number) => { let at = base; for (const gap of notches) { at += gap; wheel(100, at); } return at - base; };

    it('불규칙한 마우스 노치를 2초 넘게 굴려 들어와도 BASICS에 선다', () => {
      const { container } = mount(900);
      expect(spin(20_000)).toBeGreaterThan(2000);
      expect(isLocked(container)).toBe(true);
      expect(chapter(container)).toBe('BASICS');
    });

    it('잠긴 뒤 불규칙한 마우스 노치를 2초 넘게 굴려도 한 chapter만 간다', () => {
      const { container } = mount(START);
      spin(20_000);
      expect(chapter(container)).toBe('QUALITY');
    });

    // 재리뷰 발견: 짧게 쉬고(80-200ms) 완만하게 올라오는 새 stroke를 놓쳤다. 쉰 뒤 첫 wheel은 줄여 재고, 바로 프레임 간격으로 이어진 다음 wheel은 쉬기 전 꼬리와도 견준다.
    const restroke = (tail: number, rest: number, onset: number, ramp: number) => {
      const { container } = mount(START);
      let at = 20_000; let speed = 40;
      wheel(40, at);
      while (speed > tail || at < 21_100) { at += 16; speed = Math.max(tail, speed * 0.95); wheel(speed, at); }
      expect(chapter(container)).toBe('QUALITY');
      at += rest; let delta = onset;
      for (let i = 0; i < 12; i += 1) { wheel(delta, at); at += 16; delta = Math.min(120, delta * ramp); }
      return chapter(container);
    };

    it('관성 꼬리 8px 뒤 100ms 쉬고 60에서 1.3배씩 오르는 stroke는 다음 chapter다', () => {
      expect(restroke(8, 100, 60, 1.3)).toBe('TEAMWORK');
    });

    it('관성 꼬리 2px 뒤 120ms 쉬고 20에서 1.5배씩 오르는 stroke는 다음 chapter다', () => {
      expect(restroke(2, 120, 20, 1.5)).toBe('TEAMWORK');
    });

    // 재리뷰 2: OS wheel 가속은 빨리 굴릴수록 노치 크기를 키운다. 30-160ms 간격이 쉼 경계를 넘나들며 새 stroke로 읽혔다.
    const accelerated = () => { let ema = 100; return notches.map((gap, i) => { if (i > 0) ema = 0.5 * gap + 0.5 * ema; return Math.round(Math.min(400, Math.max(20, 100 * (100 / ema)))); }); };
    const acceleratedSpin = (base: number) => { const deltas = accelerated(); let at = base; notches.forEach((gap, i) => { at += gap; wheel(deltas[i], at); }); };

    it('가속된 마우스 노치를 굴려 들어와도 BASICS에 선다', () => {
      const { container } = mount(900);
      acceleratedSpin(20_000);
      expect(isLocked(container)).toBe(true);
      expect(chapter(container)).toBe('BASICS');
    });

    it('잠긴 뒤 가속된 마우스 노치를 굴려도 한 chapter만 간다', () => {
      const { container } = mount(START);
      acceleratedSpin(20_000);
      expect(isLocked(container)).toBe(true);
      expect(chapter(container)).toBe('QUALITY');
    });

    // 재리뷰 2: 16ms 관성 꼬리에 65-80ms 끊김이 한 번 끼고 그 wheel이 한 프레임 크기만 실어 와도 같은 stroke다.
    it.each([65, 70, 80])('16ms 관성 꼬리에 %ims 끊김이 한 번 끼어도 새 stroke로 보지 않는다', (hiccup) => {
      const { container } = mount(START);
      let at = 20_000; let speed = 40;
      wheel(speed, at);
      for (let i = 1; speed > 0.3; i += 1) {
        speed *= 0.95;
        let gap = 16;
        if (i === 20) { gap = hiccup; for (let j = 0; j < Math.round(hiccup / 16) - 1; j += 1) speed *= 0.95; }
        at += gap;
        wheel(Math.max(0.1, speed), at);
      }
      expect(chapter(container)).toBe('QUALITY');
    });

    it('클릭도 같은 선택으로 이동하고 마지막 chapter의 새 제스처는 문서로 돌려준다', () => {
      const { container, onChapterChange } = mount(START);
      clock = 20_000;
      fireEvent.click(screen.getByRole('button', { name: 'TEAMWORK' }));
      expect(chapter(container)).toBe('TEAMWORK');
      expect(onChapterChange).toHaveBeenLastCalledWith(2);
      expect(wheel(100, 21_500).defaultPrevented).toBe(false);
      expect(isLocked(container)).toBe(false);
      expect(wheel(100, 21_516).defaultPrevented).toBe(false);
    });

    it('명시적 이동이 진행 중이면 새 잠금을 잡지 않고 도착한 뒤에 잡는다', () => {
      const { container, update } = mount(960, { navigationPending: true });
      expect(wheel(100, 20_000).defaultPrevented).toBe(false);
      scrollAt(START, 20_050);
      expect(window.scrollTo).not.toHaveBeenCalled();
      expect(isLocked(container)).toBe(false);
      update({ navigationPending: false });
      expect(isLocked(container)).toBe(true);
    });

    it('release()는 잠금을 풀어 명시적 이동을 About으로 끌어오지 않는다', () => {
      const { container, handle, update } = mount(START);
      wheel(1, 20_000);
      act(() => handle.current!.release());
      expect(isLocked(container)).toBe(false);
      scrollAt(START + 200, 20_050);
      expect(window.scrollTo).not.toHaveBeenCalled();
      update({ navigationPending: true });
      documentY = START;
      expect(wheel(100, 20_400).defaultPrevented).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    // 실측: Chrome의 부드러운 wheel 스크롤은 잠근 뒤에도 수백 px를 더 간다.
    it('진입 관성이 크게 넘쳐도 되돌리고, History와 다른 키는 그 창을 닫는다', () => {
      const { container } = mount(960);
      wheel(120, 20_000);
      scrollAt(START + 600, 20_100);
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
      expect(isLocked(container)).toBe(true);
      vi.mocked(window.scrollTo).mockClear();
      wheel(40, 20_200);
      act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
      scrollAt(START + 300, 20_250);
      expect(window.scrollTo).not.toHaveBeenCalled();
      expect(isLocked(container)).toBe(false);
      scrollAt(START - 1, 25_000);
      wheel(40, 25_100);
      key('End', 25_150);
      scrollAt(START + 3000, 25_200);
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('직접 해시로 About 아래에 열려도 About으로 돌려보내지 않는다', () => {
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'navigate' }] as never);
      const { container } = mount(3000);
      expect(window.scrollTo).not.toHaveBeenCalled();
      expect(isLocked(container)).toBe(false);
    });

    it('스크롤바·프로그램 이동은 잠금에서 빠져나가고 끌려오지 않는다', () => {
      const { container } = mount(START);
      scrollAt(START + 400, 30_000);
      expect(window.scrollTo).not.toHaveBeenCalled();
      expect(isLocked(container)).toBe(false);
      expect(wheel(100, 30_100).defaultPrevented).toBe(false);
    });

    it('키보드 화살표는 chapter를 넘기고 End는 문서에 맡긴다', () => {
      const { container } = mount(START);
      expect(key('ArrowDown', 20_000).defaultPrevented).toBe(true);
      expect(chapter(container)).toBe('QUALITY');
      expect(key('End', 20_100).defaultPrevented).toBe(false);
      expect(chapter(container)).toBe('QUALITY');
    });

    it('모달이 본문을 가리면 잠그지 않는다', () => {
      const { container } = mount(START, { obscured: true });
      expect(isLocked(container)).toBe(false);
      expect(wheel(100, 20_000).defaultPrevented).toBe(false);
    });

    // M4 Task 15. 헤드 실측(1280x720, 잠금 628): 881에서 -1031 wheel로 TEAMWORK에 잠갔고, 막지 않은 그 wheel의 착지가 369ms 뒤에 와
    // 350ms 넘침 창을 넘겼다. About이 풀려 0까지 갔다. 잠근 입력의 늦은 착지는 잠금 자리로 되돌린다. 아래로 들어올 때도 같다.
    it.each([
      ['위에서 돌아오며', START + 253, -1031, 0, 'TEAMWORK'],
      ['Hero 쪽에서 들어오며', START - 60, 504, START + 504, 'BASICS'],
    ] as const)('%s 잠근 wheel의 착지가 350ms 뒤에 와도 잠금 자리를 지킨다', (_, top, delta, landing, name) => {
      const { container } = mount(top);
      expect(wheel(delta, 20_000).defaultPrevented).toBe(false);
      expect(isLocked(container)).toBe(true);
      scrollAt(landing, 20_369);
      expect(isLocked(container)).toBe(true);
      expect(chapter(container)).toBe(name);
      expect(window.scrollTo).toHaveBeenLastCalledWith({ top: START, behavior: 'instant' });
      expect(documentY).toBe(START);
    });

    // M4 Task 15. 차단 wheel은 메인 스레드를 기다린다(헤드 실측 1280x720, Hero-About 사이 100px 노치 중앙값 221ms). 그래서 About은
    // 진입 리스너를 잠금 자리 근처에서도 비수동으로 바꾸지 않고 늦은 착지를 되돌린다. 잠금이 꺼져도 수동이다.
    it.each([
      ['멀리 위', START - 2000, false],
      ['바로 위', START - 60, false],
      ['바로 아래', START + 60, false],
      ['잠금이 꺼진 채 바로 위', START - 60, true],
    ] as const)('진입 wheel·touchmove 리스너는 %s에서 수동이다', (_, top, reduced) => {
      if (reduced) {
        vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
          matches: media === '(prefers-reduced-motion: reduce)' || media === '(min-width: 1024px)', media, addEventListener: () => {}, removeEventListener: () => {},
        })));
      }
      const add = vi.spyOn(window, 'addEventListener');
      mount(top);
      scrollAt(top, 20_000);
      const entry = add.mock.calls.filter(([type]) => ['wheel', 'touchmove'].includes(type));
      expect(entry.length).toBeGreaterThan(0);
      expect(entry.filter(([, , options]) => typeof options === 'object' && options.passive === false)).toEqual([]);
    });

    it.each(['(prefers-reduced-motion: reduce)', '(max-height: 640px)'])('%s이면 모든 chapter를 정적 원문으로 둔다', (query) => {
      vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
        matches: media === query || media === '(min-width: 1024px)', media, addEventListener: () => {}, removeEventListener: () => {},
      })));
      const { container } = mount(START);
      expect(container.querySelector('[data-static]')).not.toBeNull();
      expect(container.querySelectorAll('[data-detail][inert]')).toHaveLength(0);
      expect(wheel(100, 20_000).defaultPrevented).toBe(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    // 리뷰 발견 3: 정적 모드에 들어가기 전의 잠금이 남아 있다가 읽기 모드로 돌아올 때 About으로 끌어왔다.
    it('정적 모드를 지나 돌아와도 About 밖의 읽기 위치를 끌어오지 않는다', () => {
      let short = false;
      const listeners: (() => void)[] = [];
      vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
        get matches() { return media === '(max-height: 640px)' ? short : media === '(min-width: 1024px)'; }, media,
        addEventListener: (_: string, listener: () => void) => { if (media === '(max-height: 640px)') listeners.push(listener); }, removeEventListener: () => {},
      })));
      const flip = (next: boolean) => { short = next; act(() => listeners.forEach((listener) => listener())); };
      const { container } = mount(START);
      expect(isLocked(container)).toBe(true);
      flip(true);
      scrollAt(START + 2000, 30_000);
      flip(false);
      expect(window.scrollTo).not.toHaveBeenCalled();
      expect(isLocked(container)).toBe(false);
      // 제자리에 머문 채 돌아오면 다시 잠근다.
      scrollAt(START, 31_000);
      flip(true);
      flip(false);
      expect(isLocked(container)).toBe(true);
      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('shared visual', () => {
    it('uses one visual slot for all three items', () => {
      const { container } = renderAboutSection();
      expect(container.querySelectorAll('[data-about-visual]')).toHaveLength(1);
    });

    it('uses a static mask of the selected logo for reduced motion', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
        matches: true, media: '', addEventListener: () => {}, removeEventListener: () => {},
      }));
      const { container } = renderAboutSection();
      const logo = () => container.querySelector('.about-electric-static-shape') as HTMLElement;
      expect(logo()?.style.maskImage).toContain('/icons-mono/react.svg');
      fireEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[2].label) }));
      expect(logo()?.style.maskImage).toContain('/about/handshake.webp');
      expect(container.querySelector('[data-electric-src]')).toBeNull();
    });

    // 앵커는 진입 전에도 실제 레이아웃 자리를 가져야 경계가 도착점을 잴 수 있다.
    it('keeps the about-logo anchor in layout before entry and never mounts a GL logo itself', async () => {
      localVisibility.visible = false; localVisibility.hasEntered = false;
      const view = () => <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}><AboutSection onChapterChange={() => {}} navigationPending={false} /></SectionActivityProvider>;
      const { container, rerender } = render(view());
      expect(container.querySelector('[data-about-visual] [data-motion-anchor="about-logo"]')).not.toBeNull();
      localVisibility.visible = true; localVisibility.hasEntered = true;
      rerender(view()); await act(async () => { await Promise.resolve(); });
      expect(container.querySelector('[data-electric-src]')).toBeNull();
    });

    it('모바일에서는 보이지 않는 WebGL 로고를 예열하지 않는다', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
        matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {},
      }));
      const { container } = renderAboutSection('overview' as NavId);
      expect(container.querySelector('[data-electric-src]')).toBeNull();
    });
  });

  describe('폴더 CSS 계약', () => {
    const css = readFileSync(resolve(process.cwd(), 'styles/design-tokens.css'), 'utf8');
    // 모션을 끈 사용자용 블록은 빼고 본다. 거기에도 같은 선택자가 있는데
    // 그쪽은 움직임을 없애는 규칙이라 아래 두 검사의 대상이 아니다.
    const motionCss = css.replace(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n {2}\}/g,
      ''
    );

    // 시안은 transition: all이라 종이 높이도 함께 변했다. 높이는 레이아웃
    // 속성이라 이 저장소가 애니메이션하지 않기로 한 것이다(DESIGN.md).
    // 아이콘 광휘가 붙으면서 불투명도가 하나 늘었다. 둘 다 이 저장소가
    // 애니메이션해도 된다고 정해 둔 속성이다.
    it('열림 상태가 바꾸는 것은 transform과 불투명도뿐이다', () => {
      const openRules = [
        ...motionCss.matchAll(/\[data-about-folder\]\[data-open='true'\][^{]*\{([^}]*)\}/g),
      ].map((m) => m[1]);
      expect(openRules.length).toBeGreaterThanOrEqual(6);
      for (const body of openRules) {
        const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
        for (const prop of props.filter((prop) => prop !== 'transition-delay')) {
          expect(['transform', 'opacity']).toContain(prop);
        }
      }
    });

    // 문항을 고르면 본문이 먼저 바뀌고 폴더는 기다렸다가 펴진다. 기다리는
    // 시간은 새 숫자가 아니라 토큰이고, 닫힐 때는 기다리지 않는다.
    it('열림에만 토큰으로 만든 지연이 붙는다', () => {
      const openRules = [
        ...motionCss.matchAll(/\[data-about-folder\]\[data-open='true'\][^{]*\{([^}]*)\}/g),
      ].map((m) => m[1]);
      const delayed = openRules.filter((body) => body.includes('transition-delay'));
      expect(delayed.length).toBe(openRules.length);
      for (const body of delayed) {
        expect(body).toMatch(/transition-delay:[^;]*var\(--animate-duration-slow\)/);
      }
      const closedRule = css.match(/\.about-folder \{([^}]*)\}/)?.[1];
      expect(closedRule).not.toMatch(/transition-delay/);
    });

    it('전환에 토큰 지속과 사이트 이징을 쓴다', () => {
      expect(css).toMatch(
        /\.about-folder \{[\s\S]*?transition: transform var\(--animate-duration-slow\) cubic-bezier\(0\.22, 1, 0\.36, 1\);/
      );
    });

    // 이 저장소가 .section-hidden부터 매번 짝지어 온 방어다.
    it('모션을 끄면 폴더 전환이 끊긴다', () => {
      const reduceBlocks = [
        ...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n {2}\}/g),
      ].map((m) => m[1]);
      const folderGuard = reduceBlocks.find((b) => b.includes('.about-folder'));
      expect(folderGuard).toBeDefined();
      expect(folderGuard).toMatch(/\.about-folder-paper/);
      expect(folderGuard).toMatch(/\.about-folder-front/);
      expect(folderGuard).toMatch(/transition: none/);
    });

    // 번개 로고의 WebGL 캔버스가 찌그러지지 않도록 정사각형을 유지한다.
    it('번개 로고 상자가 정사각이다', () => {
      expect(css).toMatch(/\.about-electric \{[\s\S]*?aspect-ratio: 1 \/ 1;/);
      expect(css).toMatch(/\.about-teamwork \{[\s\S]*?aspect-ratio: 1 \/ 1;/);
    });

    // 종이는 흰 종이다. 시안 테두리를 두르면 폴더 앞판과 한 덩어리로
    // 뭉쳐 보였다. 윤곽은 선이 아니라 그림자가 만든다.
    it('종이가 희고 시안 테두리를 두르지 않는다', () => {
      const paper = css.match(/\.about-folder-paper \{([^}]*)\}/)?.[1];
      expect(paper).toBeDefined();
      expect(paper).toMatch(/background: var\(--color-text-primary\);/);
      expect(paper).toMatch(/box-shadow:/);
      expect(paper).not.toMatch(/border: /);
    });

    // 폴더 아이콘 광휘와 손뼉 광휘는 Skills 아이콘 호버와 같은 토큰을
    // 쓴다. 값을 따로 적으면 셋이 서로 다른 빛이 된다.
    it('두 광휘가 Skills 호버와 같은 토큰을 쓴다', () => {
      const slot = css.match(/\.about-folder-icon-slot::before \{([^}]*)\}/)?.[1];
      expect(slot).toMatch(/background: var\(--skill-icon-ambient\);/);
      const teamwork = css.match(/\.about-teamwork::before \{([^}]*)\}/)?.[1];
      expect(teamwork).toMatch(/background: var\(--skill-icon-ambient\);/);
      const bloom = css.match(/\.about-teamwork-bloom \{([^}]*)\}/)?.[1];
      expect(bloom).toMatch(/drop-shadow\(0 0 3px var\(--color-cyan-hi\)\)/);
      expect(bloom).toMatch(/drop-shadow\(0 0 9px var\(--color-cyan-hi\)\)/);
    });

    // 링 색의 정본은 여기고 셰이더는 사본이다. 토큰을 지우면 사본만 남아
    // 아무도 색을 못 찾는다.
    it('링이 쓰는 AI 색 토큰이 값 정본에 있다', () => {
      expect(css).toMatch(/--color-ai-violet: #8b5cf6;/);
      expect(css).toMatch(/--color-ai-cyan: #22d3ee;/);
      const shader = readFileSync(
        resolve(process.cwd(), 'components/blocks/AboutRings/index.tsx'),
        'utf8'
      );
      expect(shader).toMatch(/--color-ai-violet/);
      expect(shader).toMatch(/--color-ai-cyan/);
      expect(shader).toMatch(/COLOR_CORE = vec3\(0.545, 0.361, 0.965\)/);
      expect(shader).toMatch(/COLOR_HI = vec3\(0.133, 0.827, 0.933\)/);
    });

    // 사용자가 네모난 그림처럼 보인다고 한 결함. 광휘가 상자 끝에서 잘리면
    // 그 자리가 직선이 된다. 반지름으로 죽이고, 어두운 화소가 뒤를 덮지
    // 않도록 더하기로 합성한다.
    it('링이 상자 가장자리를 남기지 않는다', () => {
      const shader = readFileSync(
        resolve(process.cwd(), 'components/blocks/AboutRings/index.tsx'),
        'utf8'
      );
      expect(shader).toMatch(/coverage \*= 1.0 - smoothstep\(EDGE_IN, EDGE_OUT, length\(p\)\);/);
      expect(shader).toMatch(/blending: THREE.AdditiveBlending/);
    });
  });

});

// AboutSection이 WhenVisible의 paused/shouldLoad를 Cubes·Orbit에 곧이곧대로
// 넘기는지를 보던 production 배선 describe를 지웠다. About 재설계가 장식
// 컴포넌트 자체를 폐기해(Task 2) 넘길 대상이 없다. 배경이 이미 있는데 별도
// 도형을 얹으면 경쟁한다.
