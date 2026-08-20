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
vi.mock('@/components/blocks/HyperspeedBackground', () => ({
  default: () => <div data-testid="hyperspeed-background-probe" />,
}));

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

  it('부팅 중 조기 이탈은 BootSequence timeline을 정리하고 재방문 시 역할·START가 최종 상태로 보인다', () => {
    renderHome();
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
