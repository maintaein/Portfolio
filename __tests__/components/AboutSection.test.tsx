import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AboutSection from '@/components/sections/AboutSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { coreValues } from '@/lib/data';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {},
    })
  );
});

// HomeClient는 항상 이 Provider로 전 섹션을 감싼다. AboutSection은 장식을
// 폐기해(Task 2) 더는 useSectionActivity()를 직접 쓰지 않지만, 실제 배선과
// 같은 모양을 유지하려고 이 파일도 Provider로 감싼다.
function renderAboutSection() {
  return render(
    <SectionActivityProvider
      active="overview"
      entryAnimationTarget={null}
      pageVisible
      routeResolved
      motionReady
      reducedMotion={false}
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
    expect(source).not.toMatch(/next\/dynamic/);
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

  // Task 4가 상세 내부를 12칸 격자로 다시 짜면서 증거 콘텐츠도 함께
  // 바뀌었다(EVIDENCE 배열, components/sections/AboutSection/index.tsx).
  // AlphaMail 수상 인용과 Flat/Compound 대비는 더 이상 나오지 않는다.
  it('증거 문자열이 전부 DOM에 있다', () => {
    const { container } = renderAboutSection();
    const html = container.textContent ?? '';
    for (const needle of ['91%', 'Tree-shaking', 'Prompt', 'Ship']) {
      expect(html, `${needle}이 없다`).toContain(needle);
    }
  });

  // Global Constraints의 증거 위계 항목이 명시하는 03 상세의 라벨 3개.
  // 위 needle 목록에는 없지만 브리프가 별도로 요구하는 문서 계약이다.
  it('03 상세의 ROLE / CONVENTION / ARCHITECTURE 라벨이 DOM에 있다', () => {
    const { container } = renderAboutSection();
    const html = container.textContent ?? '';
    for (const needle of ['ROLE', 'CONVENTION', 'ARCHITECTURE']) {
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
});

// AboutSection이 WhenVisible의 paused/shouldLoad를 Cubes·Orbit에 곧이곧대로
// 넘기는지를 보던 production 배선 describe를 지웠다. About 재설계가 장식
// 컴포넌트 자체를 폐기해(Task 2) 넘길 대상이 없다. 배경이 이미 있는데 별도
// 도형을 얹으면 경쟁한다.
