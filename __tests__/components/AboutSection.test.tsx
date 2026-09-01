import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AboutSection from '@/components/sections/AboutSection';
import { SectionActivityProvider } from '@/components/common/SectionActivityContext';
import { coreValues } from '@/lib/data';
import { ABOUT_SCRIMS } from '@/components/sections/AboutSection/scrim';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {},
    })
  );
});

// HomeClient는 항상 이 Provider로 전 섹션을 감싼다. AboutSection은 문항
// 전환의 방향(direction)을 정할 때 useSectionActivity().reducedMotion을
// 읽는다(Task 6). reducedMotion을 matchMedia 스텁 값으로 계산해 넘겨야
// 아래 'reducedMotion이면...' 테스트의 stubGlobal 재정의가 실제로 전달된다.
function renderAboutSection() {
  return render(
    <SectionActivityProvider
      active="overview"
      entryAnimationTarget={null}
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
    const { container } = renderAboutSection();
    const scrims = container.querySelectorAll('[data-about-scrim]');
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
    const { container } = renderAboutSection();
    for (const scrim of container.querySelectorAll('[data-about-scrim]')) {
      expect(scrim.className).toMatch(/-z-\[1\]/);
    }
  });

  // 레이아웃이 통일되면서 개별성이 콘텐츠와 배경에만 남았다. 셋이 같으면
  // 세 화면이 같아 보인다.
  it('세 문항의 스크림이 서로 다르다', () => {
    expect(new Set(ABOUT_SCRIMS).size).toBe(3);
  });

  it('활성 문항의 스크림만 걸린다', () => {
    const { container } = renderAboutSection();
    const scrim = container.querySelector('[data-about-scrim]');
    expect(scrim).toHaveStyle({ background: ABOUT_SCRIMS[0] });
  });

  // 최종 리뷰 발견 4: 위 테스트는 초기 상태에서 ABOUT_SCRIMS[0]만 보므로
  // 구현을 ABOUT_SCRIMS[0] 하드코딩으로 바꿔도 통과했다. 문항별 배선
  // 자체(레이어마다 다른 배경, 클릭 뒤 활성 레이어 교체)를 여기서 고정한다.
  it('세 스크림 레이어가 문항별로 다른 배경을 갖고, 클릭하면 활성 레이어가 바뀐다', async () => {
    const { container } = renderAboutSection();
    const layerFor = (index: number) =>
      container.querySelector(`[data-about-scrim][data-about-scrim-index="${index}"]`) as HTMLElement;

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

  // 슬라이드도 크로스페이드도 아니다. 카메라가 터널을 지나간다. 앞으로 갈
  // 때 나가는 요소가 커지며 벌어지고 새 요소가 소실점에서 자란다.
  it('앞으로 갈 때와 뒤로 갈 때 방향이 반대다', async () => {
    const { container } = renderAboutSection();
    const grid = () => container.querySelector('[data-about-grid]') as HTMLElement;

    await userEvent.click(screen.getByRole('button', { name: /AI WORKFLOW/ }));
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

    await userEvent.click(screen.getByRole('button', { name: /AI WORKFLOW/ })); // 0 -> 1, forward
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
});

// AboutSection이 WhenVisible의 paused/shouldLoad를 Cubes·Orbit에 곧이곧대로
// 넘기는지를 보던 production 배선 describe를 지웠다. About 재설계가 장식
// 컴포넌트 자체를 폐기해(Task 2) 넘길 대상이 없다. 배경이 이미 있는데 별도
// 도형을 얹으면 경쟁한다.
