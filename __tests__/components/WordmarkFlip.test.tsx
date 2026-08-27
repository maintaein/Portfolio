import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firePointer } from '@/__tests__/helpers/pointerEvents';
import HomeClient from '@/components/sections/HomeClient';
import { Flip, SITE_EASE } from '@/lib/gsap';

// HomeClient의 워드마크 FLIP 브리지(단일 wordmarkRef + onBeforeActiveChange +
// useLayoutEffect([active]))를 실제 통합 트리로 검증한다. 무거운 실제
// 섹션(About·Skills·Projects·Awards·Experience·Footer)과 WebGL 배경은 이
// 파일의 관심사가 아니므로 가볍게 대체하되, BootSequence와 Navigation은
// 실제 구현을 그대로 쓴다 — 이 둘 사이의 워드마크 공유가 검증 대상이다.
// onSceneReady를 마운트 즉시 불러준다 — 실제 HyperspeedBackground가 씬을
// 붙이는 순간과 같은 신호다. 이걸 안 부르면 BootSequence는 부팅 안무 브리프의
// "씬 준비 신호 또는 타임아웃" 경합에서 타임아웃(600ms)까지 기다려야 하는데,
// 이 파일은 실제 타이머를 그만큼 진행시키지 않으므로(fake timer, seek()만
// 진행 수단) 신호를 즉시 보내는 편이 이 파일의 관심사(워드마크 FLIP)와
// 무관한 타이밍 우연에 기대지 않는다.
vi.mock('@/components/blocks/HyperspeedBackground', async () => {
  const { useEffect } = await import('react');
  return {
    default: function HyperspeedBackgroundProbe({
      onSceneReady,
    }: {
      onSceneReady?: () => void;
    }) {
      useEffect(() => {
        onSceneReady?.();
      }, [onSceneReady]);
      return <div data-testid="hyperspeed-background-probe" />;
    },
  };
});

vi.mock('@/components/sections', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/components/sections')>();
  return {
    ...actual,
    AboutSection: () => (
      <section>
        <h2>About</h2>
      </section>
    ),
    SkillsSection: () => (
      <section>
        <h2>Skills</h2>
      </section>
    ),
    ProjectsSection: () => (
      <section>
        <h2>Projects</h2>
      </section>
    ),
    AwardAndCertificateSection: () => (
      <section>
        <h2>Awards</h2>
      </section>
    ),
    ExperienceSection: () => (
      <section>
        <h2>Experience</h2>
      </section>
    ),
    Footer: () => <a href="mailto:test@example.com">Contact footer</a>,
  };
});

interface MockMediaController {
  fire: (matches: boolean) => void;
}

function installMatchMedia(reduced: boolean): MockMediaController {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const reducedQuery = {
    matches: reduced,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.add(listener);
      }
    ),
    removeEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.delete(listener);
      }
    ),
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      if (query === reducedQuery.media) return reducedQuery;
      return {
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    })
  );

  return {
    fire(matches: boolean) {
      reducedQuery.matches = matches;
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  installMatchMedia(false);
  // BootSequence의 GSAP timeline이 자동재생하며 예약하는 rAF가 테스트 경계를
  // 넘어 발화하지 않도록 fake timer로 얼려 둔다(BootSequence.test.tsx와 같은
  // 이유). 진행 수단은 쓰지 않는다 — 이 파일은 Flip 호출 여부·인자만 본다.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderHome() {
  return render(<HomeClient /> as ReactElement);
}

// HomeClient는 마운트 직후 useEffect에서 import('@/lib/gsap')을 동적으로
// 시작해 gsapModuleRef에 담아 둔다(gsap-lazy-brief.md). handleBeforeActiveChange는
// 이 ref를 동기적으로만 읽으므로, renderHome() 직후 곧바로 경계 전환을
// 일으키면 이 promise가 아직 도착하지 않아 FLIP이 조용히 스킵된다. fake
// timer가 걸려 있어(BootSequence의 rAF 오염 방지와 같은 이유) real timer로
// 바꾸지 않고 pending microtask만 흘려보낸다 — 시간을 진행시키지 않는다.
async function flushGsapImport() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('WordmarkFlip — 단일 워드마크 노드의 hero/compact 전환', () => {
  it('최초 Overview 마운트에는 Flip이 호출되지 않는다', () => {
    const getStateSpy = vi.spyOn(Flip, 'getState');
    const fromSpy = vi.spyOn(Flip, 'from');

    renderHome();

    expect(getStateSpy).not.toHaveBeenCalled();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('overview → about에서 같은 워드마크 노드가 500ms hero→compact FLIP을 실행한다', async () => {
    const getStateSpy = vi.spyOn(Flip, 'getState');
    const fromSpy = vi.spyOn(Flip, 'from');
    renderHome();
    const wordmark = screen.getByTestId('wordmark');
    expect(wordmark).toHaveAttribute('data-wordmark-mode', 'hero');
    await flushGsapImport();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    });

    expect(getStateSpy).toHaveBeenCalledTimes(1);
    expect(getStateSpy).toHaveBeenCalledWith(wordmark);
    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(fromSpy.mock.calls[0][0]).toBe(getStateSpy.mock.results[0]!.value);
    // toMatchObject를 쓴다 — Flip.from은 전달받은 vars 객체를 그 자리에서
    // 확장한다(예: clearProps 기본값 주입, 실측). 우리가 실제로 지정한
    // 네 값만 정확히 검증한다.
    expect(fromSpy.mock.calls[0][1]).toMatchObject({
      duration: 0.5,
      ease: SITE_EASE,
      scale: true,
      absolute: true,
    });
    expect(screen.getByTestId('wordmark')).toBe(wordmark); // 동일 DOM 노드
    expect(wordmark).toHaveAttribute('data-wordmark-mode', 'compact');
  });

  it('about → overview에서 같은 노드가 compact→hero로 돌아오며 BootSequence는 재생하지 않는다', async () => {
    // gsap.timeline() 호출 수는 여기서 못 쓴다 — Flip.from()도 자기
    // 애니메이션을 위해 내부적으로 gsap.timeline()을 부른다(node_modules/
    // gsap/Flip.js:540,1222 확인). 대신 관찰 가능한 행동으로 고정한다:
    // 새 boot timeline이 만들어졌다면 역할·START의 fromTo가
    // immediateRender로 즉시 opacity를 0으로 되돌렸을 것이다 — 그렇지
    // 않다는 것이 "재생 안 함"의 직접 증거다.
    const fromSpy = vi.spyOn(Flip, 'from');
    renderHome();
    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');
    await flushGsapImport();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    });
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('1');

    act(() => {
      fireEvent.click(screen.getByTestId('wordmark')); // wordmark 클릭 = overview로 복귀
    });
    // hasStartedRef 없이 이 시점의 상태만 보면(flush 없이) 새 timeline을
    // 만드는 import('@/lib/gsap') promise가 아직 도착하지 않았을 뿐이라
    // 우연히 통과해버린다 — 반드시 flush까지 해야 "재생 안 함"이 실제
    // 값으로 증명된다. 뮤테이션 (c)가 이 flush 없이는 잡히지 않음을 실측
    // 확인했다.
    await flushGsapImport();

    expect(screen.getByTestId('wordmark')).toHaveAttribute(
      'data-wordmark-mode',
      'hero'
    );
    expect(fromSpy).toHaveBeenCalledTimes(2);
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('1');
  });

  const overviewBoundaryTriggers: Array<
    [string, (container: HTMLElement) => void]
  > = [
    [
      '상단 네비 클릭',
      () => fireEvent.click(screen.getByRole('button', { name: /^about$/i })),
    ],
    ['START 버튼', () => fireEvent.click(screen.getByTestId('boot-start'))],
    [
      '스와이프',
      (container) => {
        const stage = container.querySelector('.section-stage');
        expect(stage).not.toBeNull();
        firePointer(stage!, 'pointerdown', {
          pointerId: 1,
          pointerType: 'touch',
          clientX: 240,
          clientY: 200,
        });
        firePointer(stage!, 'pointerup', {
          pointerId: 1,
          pointerType: 'touch',
          clientX: 160,
          clientY: 205,
        });
      },
    ],
    [
      'popstate',
      () => {
        window.history.pushState(null, '', '#about');
        window.dispatchEvent(new PopStateEvent('popstate'));
      },
    ],
  ];

  it.each(overviewBoundaryTriggers)(
    '%s도 active 기반 단일 bridge를 통해 정확히 한 번의 Flip만 만든다',
    async (_label, trigger) => {
      const getStateSpy = vi.spyOn(Flip, 'getState');
      const fromSpy = vi.spyOn(Flip, 'from');
      const { container } = renderHome();
      await flushGsapImport();

      act(() => trigger(container));

      // START는 클릭 링(방출 서사의 뒷절반)을 볼 시간을 주려고 실제 전환을
      // START_TRANSITION_DELAY_MS만큼 미룬다. 다른 세 트리거는 즉시 전환이라
      // 이 진행이 무해하다 — 네 트리거를 같은 모양으로 두기 위해 공통으로 흘린다.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(getStateSpy).toHaveBeenCalledTimes(1);
      expect(fromSpy).toHaveBeenCalledTimes(1);
    }
  );

  it('overview를 거치지 않는 전환(about → projects)은 Flip을 만들지 않는다', async () => {
    // 위 it.each는 매번 overview를 지나는 경계만 검증한다 — 이 테스트가
    // 없으면 crossesOverviewBoundary 게이트 자체를 지워도(양쪽 다 overview가
    // 아닌 전환에서도 Flip을 시도하는 회귀) 기존 테스트가 하나도 못 잡는다.
    const getStateSpy = vi.spyOn(Flip, 'getState');
    const fromSpy = vi.spyOn(Flip, 'from');
    renderHome();
    await flushGsapImport();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    });
    getStateSpy.mockClear();
    fromSpy.mockClear();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^projects$/i }));
    });

    expect(getStateSpy).not.toHaveBeenCalled();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('GSAP 모듈이 아직 로드되지 않았으면 FLIP 없이 넘어간다(위 테스트들과 달리 flushGsapImport를 부르지 않는다)', () => {
    const getStateSpy = vi.spyOn(Flip, 'getState');
    const fromSpy = vi.spyOn(Flip, 'from');
    renderHome();
    // 마운트 직후 import('@/lib/gsap')이 아직 pending인 바로 그 순간을
    // 재현한다 — gsapModuleRef가 비어 있을 때도 Flip을 시도하면(구멍) 여기서
    // 잡힌다. hero/compact 전환 자체는 CSS·data 속성이 담당하므로 FLIP 없이도
    // 깨지지 않아야 한다.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    });

    expect(getStateSpy).not.toHaveBeenCalled();
    expect(fromSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('wordmark')).toHaveAttribute(
      'data-wordmark-mode',
      'compact'
    );
  });

  it('reduced-motion은 Flip.from() 없이 최종 위치를 즉시 적용한다', () => {
    installMatchMedia(true);
    const getStateSpy = vi.spyOn(Flip, 'getState');
    const fromSpy = vi.spyOn(Flip, 'from');
    renderHome();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    });

    expect(getStateSpy).not.toHaveBeenCalled();
    expect(fromSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('wordmark')).toHaveAttribute(
      'data-wordmark-mode',
      'compact'
    );
  });

  it('세션 도중 reduced-motion으로 바뀌면 그 이후 전환부터 Flip을 만들지 않는다', () => {
    const media = installMatchMedia(false);
    const getStateSpy = vi.spyOn(Flip, 'getState');
    const fromSpy = vi.spyOn(Flip, 'from');
    renderHome();

    act(() => media.fire(true));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    });

    expect(getStateSpy).not.toHaveBeenCalled();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('부팅 중 조기 이탈은 BootSequence timeline을 정리하고 재방문 시 역할·START가 최종 상태로 보인다', async () => {
    renderHome();
    // 파티클 경합 브리프. BootSequence의 타임라인 생성이 이제 기기 등급
    // (tier) 판정도 함께 기다린다. 판정 promise가 도착할 microtask를
    // 흘려보내야 이 시점에 timeline이 이미 만들어져 있다는 아래 전제가
    // 성립한다(gsap import 흐름과 같은 flush).
    await flushGsapImport();
    const role = screen.getByTestId('boot-role');
    const start = screen.getByTestId('boot-start');

    // 부팅 sweep(1.4초) 전에 다른 섹션으로 떠난다 — real/fake timer를 전혀
    // 진행시키지 않았으므로 이 시점의 timeline은 t=0 그대로다.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    });
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('1');

    act(() => {
      fireEvent.click(screen.getByTestId('wordmark'));
    });
    expect(role.style.opacity).toBe('1');
    expect(start.style.opacity).toBe('1');
  });

  it('동일 id 재선택과 modal-only popstate에는 Flip을 만들지 않는다', () => {
    renderHome();
    const getStateSpy = vi.spyOn(Flip, 'getState');
    const fromSpy = vi.spyOn(Flip, 'from');

    // 동일 id — 이미 overview인 상태에서 wordmark(overview로 이동)를 다시 누른다.
    act(() => {
      fireEvent.click(screen.getByTestId('wordmark'));
    });
    expect(fromSpy).not.toHaveBeenCalled();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^projects$/i }));
    });
    fromSpy.mockClear();
    getStateSpy.mockClear();

    act(() => {
      window.history.replaceState(
        { projectModalId: 'x' },
        '',
        '#projects'
      );
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: { projectModalId: 'x' } })
      );
    });
    expect(getStateSpy).not.toHaveBeenCalled();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('초기 해시 hydration은 Flip을 만들지 않고 최종 hero/compact 모드를 즉시 적용한다', () => {
    window.history.replaceState(null, '', '/#projects');
    const getStateSpy = vi.spyOn(Flip, 'getState');
    const fromSpy = vi.spyOn(Flip, 'from');

    renderHome();

    expect(getStateSpy).not.toHaveBeenCalled();
    expect(fromSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('wordmark')).toHaveAttribute(
      'data-wordmark-mode',
      'compact'
    );
  });

  // routeResolved=false·motionReady=false는 useSectionNav.test.ts("동기
  // 커밋이 끝나기 전에 최초 route를 해석한다")가 고정한 대로 같은 동기
  // 커밋 안에서 true로 해석되므로, 실제 HomeClient 트리에서 "routeResolved
  // 또는 motionReady가 false인 채로 사용자가 상호작용한다"는 시나리오 자체가
  // 만들어지지 않는다 — jsdom 이전에 React 자체의 생명주기가 그 경로를
  // 막는다. 이 게이트(BootSequence의 동명 prop과 동일한 값)는
  // BootSequence.test.tsx가 prop을 직접 주입해 고정한다.
});

// 캡션 컨테인먼트 점프(부팅 안무 브리프 3절) — 이 파일은 실제 HomeClient +
// 실제 BootSequence + 실제 Navigation을 함께 마운트하는 유일한 스위트라
// "BootSequence가 실제로 overview 섹션 밖에 사는가"라는 구조를 여기서만
// 증명할 수 있다(HomeClient.test.tsx는 BootSequence 자체를 mock으로
// 대체한다). jsdom은 paint containment도 실제 점프도 계산하지 못한다 — 여기
// 고정하는 것은 "캡션이 overview data-section의 자손이 아니다"라는 DOM
// 구조뿐이고, 컨테인먼트가 실제로 사라졌는지는 실기기 확인 사항이다.
describe('WordmarkFlip — 부팅 캡션은 overview 섹션 컨테인먼트 밖에 산다', () => {
  it('boot-sequence는 data-section="overview"의 자손이 아니다 — 뮤테이션 (m)', () => {
    const { container } = renderHome();
    const overviewSection = container.querySelector('[data-section="overview"]');
    const bootSequence = screen.getByTestId('boot-sequence');

    expect(overviewSection, 'overview 섹션 wrapper를 찾지 못했다').not.toBeNull();
    // 뮤테이션 (m) — 캡션을 다시 섹션 안으로 되돌리면 이 contains()가 true가
    // 되어 FAIL한다. 워드마크와 정확히 같은 방식으로 검증한다(HomeClient.test.tsx
    // 의 "Footer는 .section-stage의 자손이 아니며" 패턴과 동일).
    expect(overviewSection!.contains(bootSequence)).toBe(false);
  });

  it('워드마크와 boot-sequence가 같은 셸 레벨(overview data-section 밖)에 나란히 산다', () => {
    const { container } = renderHome();
    const overviewSection = container.querySelector('[data-section="overview"]');
    const wordmark = screen.getByTestId('wordmark');

    expect(overviewSection!.contains(wordmark)).toBe(false);
  });
});

// 세 이음매 브리프 3절 — 모바일에서 워드마크가 네비 항목(ABOUT)과 겹친다.
// .nav-strip-visible(300ms)이 워드마크 FLIP(500ms)보다 먼저 다 보여 스트립이
// 200ms 이르게 나타났다. 워드마크가 착지한(FLIP 지속) 뒤에만 스트립이 나타나게
// transition-delay를 준다 — 숨기는 쪽은 지연 없이 즉시(비대칭). CSS 파일 자체는
// jsdom에 로드되지 않으므로(Navigation.test.tsx 주석과 같은 이유) 여기서는
// design-tokens.css 원문과 HomeClient 소스를 각각 readFileSync로 읽어 값을
// 교차 검증한다 — 실제 시각적 겹침 소멸 여부는 실기기 확인 사항이다.
describe('WordmarkFlip — 네비 스트립은 워드마크가 착지한 뒤에 나타난다(겹침 회피)', () => {
  const homeClientSource = readFileSync(
    path.resolve(process.cwd(), 'components/sections/HomeClient/index.tsx'),
    'utf8'
  );
  const designTokensCss = readFileSync(
    path.resolve(process.cwd(), 'styles/design-tokens.css'),
    'utf8'
  );

  function ruleBody(selector: string): string | undefined {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return designTokensCss.match(
      new RegExp(`^  ${escaped}\\s*\\{([\\s\\S]*?)^  \\}`, 'm')
    )?.[1];
  }

  it('FLIP 지속(WORDMARK_FLIP_DURATION_MS)과 CSS --wordmark-flip-duration이 같은 값이다 — 단일 출처, 뮤테이션 (h)', () => {
    // String.prototype.match()는 매치 실패 시 undefined가 아니라 null을
    // 준다 — toBeDefined()는 null을 통과시켜버려(자가 발견 결함) CSS 변수가
    // 통째로 사라져도 이 단언이 조용히 넘어가고 그 다음 줄에서야 크래시로
    // 잡혔다. not.toBeNull()로 실패 이유가 여기서 바로 드러나게 한다.
    const jsMatch = homeClientSource.match(
      /WORDMARK_FLIP_DURATION_MS\s*=\s*(\d+)/
    );
    expect(jsMatch, 'WORDMARK_FLIP_DURATION_MS 선언을 찾지 못했다').not.toBeNull();

    const cssMatch = designTokensCss.match(
      /--wordmark-flip-duration:\s*(\d+)ms/
    );
    expect(cssMatch, '--wordmark-flip-duration 선언을 찾지 못했다').not.toBeNull();

    // 뮤테이션 (h) — 두 값을 다른 숫자로 갈라놓으면(예: CSS만 400ms로 바꾸면)
    // 이 비교가 FAIL한다.
    expect(Number(jsMatch![1])).toBe(Number(cssMatch![1]));

    // 상수를 선언만 하고 여전히 리터럴 0.5를 쓰면(단일 출처가 아니게 되면)
    // 여기서도 잡힌다.
    expect(homeClientSource).toMatch(
      /duration:\s*WORDMARK_FLIP_DURATION_MS\s*\/\s*1000/
    );
  });

  it('.nav-strip-visible은 --wordmark-flip-duration만큼 지연된 뒤 나타난다 — 뮤테이션 (f)', () => {
    const visibleBody = ruleBody('.nav-strip-visible');
    expect(visibleBody, '.nav-strip-visible 규칙을 찾지 못했다').toBeDefined();

    // 뮤테이션 (f) — transition-delay(= var(--wordmark-flip-duration))를
    // 지우면 이 매치가 실패한다.
    expect(visibleBody).toMatch(
      /transition\s*:\s*opacity[^;]*var\(--wordmark-flip-duration\)/
    );
  });

  it('.nav-strip-hidden은 지연 없이 즉시 비킨다 — 비대칭, 뮤테이션 (g)', () => {
    const hiddenBody = ruleBody('.nav-strip-hidden');
    expect(hiddenBody, '.nav-strip-hidden 규칙을 찾지 못했다').toBeDefined();

    // transition 값만 먼저 떼어낸다 — 그냥 [^,]+로 opacity 항목을 자르면
    // cubic-bezier(0.22, 1, 0.36, 1) 안의 콤마에서 먼저 끊겨 뒤에 붙는
    // --wordmark-flip-duration을 못 본다(자가 발견 결함 — 처음 작성한
    // 정규식은 뮤테이션 (g)를 실제로 못 잡았다). "다음 항목(visibility) 직전의
    // 콤마"를 lookahead로 찾아 opacity 항목 전체를 정확히 끊는다.
    const transitionDecl = hiddenBody!.match(/transition\s*:\s*([\s\S]*?);/)?.[1];
    expect(transitionDecl, '.nav-strip-hidden의 transition 선언을 찾지 못했다').toBeDefined();

    const opacityTransition = transitionDecl!.match(
      /opacity[\s\S]*?(?=,\s*visibility)/
    )?.[0];
    expect(opacityTransition, 'opacity 전환 항목을 찾지 못했다').toBeDefined();
    // 뮤테이션 (g) — hidden 쪽에도 --wordmark-flip-duration 지연을 붙이면
    // 여기서 잡힌다(비대칭 계약 위반).
    expect(opacityTransition).not.toMatch(/--wordmark-flip-duration/);
  });

  it('reducedMotion에서는 nav-strip 전환 자체가 없다 — 지연도 없다, 뮤테이션 (i)', () => {
    const reduceBlocks =
      designTokensCss.match(
        /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n {2}\}\n/g
      ) ?? [];
    const navStripReduceBlock = reduceBlocks.find((block) =>
      block.includes('.nav-strip-hidden')
    );
    expect(
      navStripReduceBlock,
      'nav-strip의 reduce 오버라이드를 찾지 못했다'
    ).toBeDefined();
    // 뮤테이션 (i) — transition: none을 지우거나 지연을 남기는 규칙을
    // 추가하면 이 매치가 실패한다.
    expect(navStripReduceBlock).toMatch(/transition\s*:\s*none\s*;/);
    expect(navStripReduceBlock).not.toMatch(/--wordmark-flip-duration/);
  });
});
