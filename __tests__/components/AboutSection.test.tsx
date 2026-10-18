import { useRef as useVisibilityRef } from 'react';
const localVisibility = vi.hoisted(() => ({ visible: true, hasEntered: true }));
vi.mock('@/hooks/useSectionVisibility', () => ({ useSectionVisibility: () => ({ ref: useVisibilityRef(null), visible: localVisibility.visible, hasEntered: localVisibility.hasEntered }) }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AboutSection from '@/components/sections/AboutSection';
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

beforeEach(() => {
  localVisibility.visible = true; localVisibility.hasEntered = true;
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 1024px)', media: query,
      addEventListener: () => {}, removeEventListener: () => {},
    }))
  );
});

// HomeClient는 항상 이 Provider로 전 섹션을 감싼다. AboutSection은 문항
// 전환의 방향(direction)을 정할 때 useSectionActivity().reducedMotion을
// 읽는다(Task 6). reducedMotion을 matchMedia 스텁 값으로 계산해 넘겨야
// 아래 'reducedMotion이면...' 테스트의 stubGlobal 재정의가 실제로 전달된다.
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
      <AboutSection />
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
  it('전기 로고를 동적으로 불러온다', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/AboutSection/index.tsx'),
      'utf8'
    );
    const dynamicImports = [...source.matchAll(/dynamic\(\s*\(\)\s*=>\s*import\('([^']+)'\)/g)].map(
      (m) => m[1]
    );
      expect(dynamicImports).toContain('@/components/blocks/ElectricLogo');
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

    for (const evidence of container.querySelectorAll('[data-about-evidence]')) {
      expect(evidence.firstElementChild).not.toHaveClass('font-mono');
      const values = evidence.querySelectorAll(':scope > div > div > div:last-child');
      expect(values).toHaveLength(2);
      for (const value of values) {
        expect(value).toHaveClass('text-d3', 'font-bold');
      }
    }
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

  it('한 로고가 세 인덱스에 남아 있고 선택할 때만 형태가 바뀐다', async () => {
    vi.useFakeTimers();
    try {
      const { container } = renderAboutSection();
      await act(async () => { await Promise.resolve(); });
      const logo = container.querySelector('[data-electric-src]');
      expect(logo).toHaveAttribute('data-electric-src', '/icons-mono/react.svg');
      act(() => vi.advanceTimersByTime(60_000));
      expect(logo).toHaveAttribute('data-electric-src', '/icons-mono/react.svg');

      fireEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[1].label) }));
      expect(container.querySelector('[data-electric-src]')).toBe(logo);
      expect(logo).toHaveAttribute('data-electric-src', '/about/fixtool.webp');

      fireEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[2].label) }));
      expect(container.querySelector('[data-electric-src]')).toBe(logo);
      expect(logo).toHaveAttribute('data-electric-src', '/about/handshake.webp');
    } finally {
      vi.useRealTimers();
    }
  });

  it('첫 로고가 준비될 때까지 정적 실루엣을 보여준다', async () => {
    const { container } = renderAboutSection();
    const fallback = container.querySelector('.about-electric-static');
    expect(fallback).toHaveClass('opacity-100');
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(container.querySelector('[data-signal-ready]')!);
    expect(fallback).toHaveClass('opacity-0');
  });

  it('로고 전환 중 광휘 강도가 바뀌지 않는다', async () => {
    const { container } = renderAboutSection();
    await act(async () => { await Promise.resolve(); });
    const logo = container.querySelector('[data-electric-src]');
    const glow = logo?.getAttribute('data-glow');
    const intensity = logo?.getAttribute('data-intensity');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[1].label) }));
    expect(logo).toHaveAttribute('data-glow', glow);
    expect(logo).toHaveAttribute('data-intensity', intensity);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[2].label) }));
    expect(logo).toHaveAttribute('data-glow', glow);
    expect(logo).toHaveAttribute('data-intensity', intensity);
  });

  it('About을 떠났다가 돌아와도 WebGL 인스턴스를 재사용한다', async () => {
    const view = (active: NavId) => (
      localVisibility.visible = active === SECTION_IDS.ABOUT,
      <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}>
        <AboutSection />
      </SectionActivityProvider>
    );
    const { container, rerender } = render(view(SECTION_IDS.ABOUT));
    await act(async () => { await Promise.resolve(); });
    const logo = container.querySelector('[data-electric-src]');
    rerender(view(SECTION_IDS.SKILLS));
    expect(container.querySelector('[data-electric-src]')).toBe(logo);
    expect(logo).toHaveAttribute('data-electric-active', 'false');
    rerender(view(SECTION_IDS.ABOUT));
    expect(container.querySelector('[data-electric-src]')).toBe(logo);
    expect(logo).toHaveAttribute('data-electric-active', 'true');
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
      .toHaveAttribute('aria-current', 'true');
  });

  // 계획 4 Global Constraints: "선택 전까지 01이 활성이다".
  it('선택 전에는 01(index 0)이 활성이다', () => {
    const { container } = renderAboutSection();
    expect(container.querySelector('[data-detail="0"]')?.hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('button', { name: new RegExp(coreValues[0].label) }))
      .toHaveAttribute('aria-current', 'true');
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

  it('격자가 12칸 6줄이다', () => {
    const { container } = renderAboutSection();
    const grid = container.querySelector('[data-about-grid]');
    expect(grid?.className).toMatch(/grid-cols-12/);
    expect(grid?.className).toMatch(/grid-rows-6/);
  });

  // Task 7: 폭이 좁아 열두 칸 배치가 의미를 잃는다. 넷으로 줄이고 세로로
  // 쌓는다. 스크롤 없음은 데스크톱 요구였다. 모바일은 허용한다.
  it('좁은 화면에서 격자가 넷으로 줄고 세로로 쌓인다', () => {
    const { container } = renderAboutSection();
    const grid = container.querySelector('[data-about-grid]');
    expect(grid?.className).toMatch(/grid-cols-4/);
    expect(grid?.className).toMatch(/lg:grid-cols-12/);
  });

  it('좁은 화면에서 요소가 첫 칸부터 폭 전체를 쓴다', () => {
    const { container } = renderAboutSection();
    const title = container.querySelector('[data-about-title]');
    expect(title?.className).toMatch(/col-span-4/);
    expect(title?.className).toMatch(/lg:col-span-5/);
  });

  // Task 7 조사: 상세 3개가 전부 absolute로 겹쳐 있으면 부모(.relative
  // flex-1)에 흐름 안 자식이 하나도 없어 자체 높이가 0으로 무너진다(Task 2가
  // min-h-[640px]를 걷어낸 뒤 lg 미만에서 About 전체가 안 보이던 원인).
  // 활성 상세만 lg 미만에서 흐름에 남기고 비활성은 absolute로 빼내 해결한다.
  it('lg 미만에서 활성 상세만 흐름에 남고 비활성은 absolute로 빠진다 (0px 붕괴 방지)', () => {
    const { container } = renderAboutSection();
    const activeTokens = container.querySelector('[data-detail="0"]')?.className.split(/\s+/) ?? [];
    const inactiveTokens = container.querySelector('[data-detail="1"]')?.className.split(/\s+/) ?? [];

    // 활성: lg 미만 기본 클래스에 absolute가 없어야 흐름에 남아 부모에 실제
    // 콘텐츠 높이를 물려준다. lg부터는 여전히 absolute로 겹쳐 크로스페이드한다.
    expect(activeTokens).not.toContain('absolute');
    expect(activeTokens).toContain('lg:absolute');

    // 비활성: lg 미만에서도 absolute로 빼내야 자리가 두 배로 늘어나지 않는다.
    expect(inactiveTokens).toContain('absolute');
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

  // 슬라이드도 크로스페이드도 아니다. 카메라가 터널을 지나간다. 앞으로 갈
  // 때 나가는 요소가 커지며 벌어지고 새 요소가 소실점에서 자란다.
  it('앞으로 갈 때와 뒤로 갈 때 방향이 반대다', async () => {
    const { container } = renderAboutSection();
    const grid = () => container.querySelector('[data-about-grid]') as HTMLElement;

    await userEvent.click(screen.getByRole('button', { name: coreValues[1].label }));
    const forward = grid().dataset.aboutDirection;

    await userEvent.click(screen.getByRole('button', { name: /BASICS/ }));
    const backward = grid().dataset.aboutDirection;

    expect(forward).toBe('forward');
    expect(backward).toBe('backward');
  });

  // 건너뛰면 깊이 차가 둘이다. 이동 거리와 배율 변화가 그만큼 커진다.
  it('건너뛰면 깊이 차가 커진다', async () => {
    const { container } = renderAboutSection();
    await userEvent.click(screen.getByRole('button', { name: /TEAMWORK/ }));
    const grid = container.querySelector('[data-about-grid]') as HTMLElement;
    expect(grid.dataset.aboutDistance).toBe('2');
  });

  // 최종 리뷰 발견 1: 01→02는 direction/distance가 none/0에서 forward/1로
  // 바뀌어 재생되지만, 이어서 02→03으로 가면 값이 그대로 forward/1이라
  // key 없이는 React가 DOM 속성을 다시 쓰지 않아 CSS 애니메이션이
  // 재시작하지 않는다. 03(TEAMWORK)의 격자는 첫 클릭(0→1) 시점에 이미
  // forward/1 값을 공유 상태로부터 받으므로, 그 직후 노드 참조와 두 번째
  // 클릭(1→2, 같은 방향) 직후 노드 참조가 같으면 리마운트가 없었다는
  // 뜻이다.
  it('같은 방향으로 두 번 연속 이동해도 격자 노드가 매번 교체된다 (전환 재생 보장)', async () => {
    const { container } = renderAboutSection();

    await userEvent.click(screen.getByRole('button', { name: coreValues[1].label })); // 0 -> 1, forward
    const gridAfterFirstMove = container.querySelector('[data-detail="2"] [data-about-grid]');

    await userEvent.click(screen.getByRole('button', { name: /TEAMWORK/ })); // 1 -> 2, forward 그대로
    const gridAfterSecondMove = container.querySelector('[data-detail="2"] [data-about-grid]');

    expect(gridAfterSecondMove).not.toBe(gridAfterFirstMove);
  });

  // 실제 이동은 CSS의 animation-delay가 만든다. TS 쪽에 같은 값을 상수로
  // 복제하면 아무 데서도 쓰이지 않아 lint가 잡거나, 잡히지 않으면 CSS와
  // 조용히 어긋난다. design-tokens.css 원문을 정규식으로 읽어 계약을
  // 고정한다(BootSequence.test.tsx와 같은 관례). 동시에 같은 양으로
  // 움직이면 화면 전체가 줌하는 것으로 보여 깊이감이 사라진다. 증거가
  // 먼저 움직이고 제목과 설명이 늦게 따라온다.
  it('증거가 제목과 설명보다 먼저 움직인다 (design-tokens.css의 animation-delay)', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'styles/design-tokens.css'),
      'utf8'
    );
    const evidenceDelay = css.match(
      /\[data-about-evidence\]\s*\{\s*animation-delay:\s*(\d+)ms;/
    )?.[1];
    const titleDelay = css.match(
      /\[data-about-title\]\s*\{\s*animation-delay:\s*(\d+)ms;/
    )?.[1];
    expect(evidenceDelay, '[data-about-evidence]의 animation-delay를 찾지 못했다').toBeDefined();
    expect(titleDelay, '[data-about-title]의 animation-delay를 찾지 못했다').toBeDefined();
    expect(Number(evidenceDelay)).toBeLessThan(Number(titleDelay));
  });

  it('reducedMotion이면 전환 없이 즉시 바뀐다', async () => {
    // 이 파일의 beforeEach가 matchMedia를 matches:false로 stub한다. 여기서만
    // true로 덮는다.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        media: '',
        addEventListener: () => {},
        removeEventListener: () => {},
      })
    );
    const { container } = renderAboutSection();
    await userEvent.click(screen.getByRole('button', { name: /TEAMWORK/ }));
    const grid = container.querySelector('[data-about-grid]') as HTMLElement;
    expect(grid.dataset.aboutDirection).toBe('none');
  });

  describe('shared visual', () => {
    it('uses one visual slot for all three items', () => {
      const { container } = renderAboutSection();
      const visuals = container.querySelectorAll('[data-about-visual]');
      expect(visuals).toHaveLength(1);
      expect(visuals[0].className).toMatch(/\bcol-start-2\b/);
      expect(visuals[0].className).toMatch(/\bcol-span-4\b/);
    });

    it('hides the visual slot on narrow screens', () => {
      const { container } = renderAboutSection();
      const layer = container.querySelector('[data-about-visual]')?.parentElement;
      expect(layer?.className).toMatch(/\bhidden\b/);
      expect(layer?.className).toMatch(/\blg:grid\b/);
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

    it('loads the desktop logo only after local entry and preserves it offscreen', async () => {
      localVisibility.visible = false; localVisibility.hasEntered = false;
      const view = () => <SectionActivityProvider obscured={false} pageVisible routeResolved motionReady reducedMotion={false}><AboutSection /></SectionActivityProvider>;
      const { container, rerender } = render(view());
      expect(container.querySelector('[data-electric-src]')).toBeNull();
      localVisibility.visible = true; localVisibility.hasEntered = true;
      rerender(view()); await act(async () => { await Promise.resolve(); });
      const logo = container.querySelector('[data-electric-src]'); expect(logo).toHaveAttribute('data-electric-active', 'true');
      localVisibility.visible = false; rerender(view());
      expect(container.querySelector('[data-electric-src]')).toBe(logo); expect(logo).toHaveAttribute('data-electric-active', 'false');
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
