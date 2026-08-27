import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AboutSection from '@/components/sections/AboutSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { coreValues, techStack } from '@/lib/data';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {},
    })
  );
});

// WhenVisible(Cubes가 01 상세에서 쓴다)이 useSectionActivity()로 이 컨텍스트를
// 읽는다. HomeClient는 항상 이 Provider로 전 섹션을 감싸므로 실제 운영에서는
// 문제가 없지만, 이 파일은 AboutSection을 단독으로 렌더한다. Provider 없이는
// useSectionActivity()가 던진다. active를 'about'이 아닌 'overview'로 둬 이
// 파일의 테스트들(인덱스·상세 구조 검증)이 Cubes의 GSAP 동적 로드와 얽히지
// 않게 한다. WhenVisible이 넘긴 실제 paused/shouldLoad가 Cubes까지 그대로
// 전달되는지는 아래 "AboutSection production 배선" describe가 따로 본다.
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
  // 격자는 aria-hidden이고 청크도 늦게 온다. 기술명 15개는 AboutSection이
  // sr-only로 항상 내보내야 스크린리더와 페이지 내 찾기에서 살아남는다.
  // Cubes 안에 두면 청크가 오기 전까지 통째로 사라진다.
  it('기술명 15개가 접근 가능한 텍스트로 존재한다', () => {
    renderAboutSection();
    for (const tech of techStack) {
      expect(screen.getByText(tech.name)).toBeInTheDocument();
    }
  });

  // 격자는 next/dynamic으로 갈라 두고 shouldLoad가 열려야 렌더한다. 열어
  // 보기 전까지 청크를 내려받을 이유가 없다. 기술명은 위 sr-only가 이미
  // 덮으므로 청크가 늦거나 실패해도 의미는 완결된다.
  //
  // jsdom에서는 이것을 행동으로 증명할 수 없다. Vitest 환경의 next/dynamic은
  // 청크를 실제로 해석하지 않아 게이트가 있든 없든 격자가 DOM에 나타나지
  // 않는다. 아무리 기다려도 마찬가지라 "없다"는 단언은 아무것도 잡지 못한다.
  // 실제로 게이트를 벗기는 뮤테이션이 그 방식으로는 통과했다. 그래서 이
  // 저장소가 CSS와 BootSequence에 이미 쓰는 소스 검사 방식으로 고정한다.
  // 번들이 실제로 갈라졌는지는 check-bundle의 firstLoadJs가 증거다.
  it('격자를 next/dynamic으로 가르고 shouldLoad 뒤에만 렌더한다', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'components/sections/AboutSection/index.tsx'),
      'utf8'
    );

    // 정적 import로 되돌리면 FAIL한다.
    expect(source).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/blocks\/Cubes'\)/);
    // 게이트를 벗기면(항상 렌더하면) FAIL한다.
    expect(source).toMatch(/shouldLoad\s*\?\s*\(/);
  });

  it('인덱스 항목 3개를 렌더한다', () => {
    renderAboutSection();
    for (const v of coreValues) {
      expect(screen.getByRole('button', { name: new RegExp(v.title) })).toBeInTheDocument();
    }
  });

  it('상세 3개가 전부 DOM에 있다 (SEO 회귀)', () => {
    // 활성 하나만 렌더하면 계획 2가 고친 조건부 렌더 결함을 재생산한다.
    // 조용한 실패라 화면은 멀쩡하고 크롤러만 손해를 본다.
    const { container } = renderAboutSection();
    expect(container.querySelectorAll('[data-detail]')).toHaveLength(3);
  });

  it('증거 문자열이 전부 DOM에 있다', () => {
    const { container } = renderAboutSection();
    const html = container.textContent ?? '';
    for (const needle of ['91%', 'AlphaMail', 'Flat', 'Compound']) {
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
    await userEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[1].title) }));

    const second = container.querySelector('[data-detail="1"]');
    expect(second?.hasAttribute('inert')).toBe(false);
  });

  it('활성 항목에 aria-current를 준다', async () => {
    renderAboutSection();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(coreValues[2].title) }));
    expect(screen.getByRole('button', { name: new RegExp(coreValues[2].title) }))
      .toHaveAttribute('aria-current', 'true');
  });

  // 계획 4 Global Constraints: "선택 전까지 01이 활성이다".
  it('선택 전에는 01(index 0)이 활성이다', () => {
    const { container } = renderAboutSection();
    expect(container.querySelector('[data-detail="0"]')?.hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('button', { name: new RegExp(coreValues[0].title) }))
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
});

// AboutSection이 WhenVisible의 render prop에서 받은 paused/shouldLoad를
// Cubes에 곧이곧대로 넘기는지를 보는 production 배선 테스트다. 이 파일의
// 다른 테스트들은 active="overview"라 이 배선이 아예 발동하지 않는다.
// Cubes.test.tsx는 Cubes 컴포넌트 자체에 paused/shouldLoad를 직접 주입해서
// 보므로, AboutSection이 그 사이에서 값을 놓치거나 하드코딩해도 잡아내지
// 못한다. 뮤테이션으로 실제 확인했다(paused={false}/shouldLoad={true}로
// 하드코딩해도 전체 스위트가 그대로 통과했다). 이 describe가 그 구멍을 막는다.
// 전체 스위트를 병렬로 돌리면 CPU 경합만으로 waitFor 기본 1초를 넘긴다.
// next/dynamic이 Cubes 청크를 해석하고 그 안에서 GSAP을 다시 동적으로
// 부르는 두 단계라 특히 길다. 수행 시간이 아니라 대기가 원인이므로
// useIntersection.test.tsx와 같은 방식으로 여유를 준다.
describe('AboutSection production 배선: WhenVisible이 Cubes에 실제 paused/shouldLoad를 준다', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/gsap', () => ({
      gsap: { to: vi.fn() },
      registerGsap: vi.fn(),
      Flip: {},
      SITE_EASE: 'site',
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/gsap');
  });

  function renderActiveAbout() {
    return render(
      <SectionActivityProvider
        active="about"
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

  it('01(tech-stack)에서 02로 옮기면 Cubes의 idle 루프가 멈춘다(paused가 실제로 전달된다는 증거)', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    renderActiveAbout();
    // About이 활성이고 01이 기본 선택이라 Cubes의 shouldLoad가 곧바로 열려
    // GSAP 청크를 불러오고, idle 루프가 첫 rAF를 건다.
    await waitFor(() => expect(rafSpy).toHaveBeenCalled(), { timeout: 15_000 });

    // paused={false}로 하드코딩돼 있었다면 02로 옮겨도 취소가 일어나지
    // 않는다. 이 클릭이 곧 뮤테이션을 잡아내는 지점이다.
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(coreValues[1].title) })
    );
    expect(cancelSpy).toHaveBeenCalled();
  });
});
