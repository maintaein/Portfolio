'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { OVERVIEW, type NavId } from '@/hooks/useSectionNav';
import type { gsap } from '@/lib/gsap';

export interface BootSequenceProps {
  active: NavId;
  routeResolved: boolean;
  motionReady: boolean;
  reducedMotion: boolean;
  wordmarkRef: RefObject<HTMLButtonElement | null>;
  onStart: () => void;
}

// 부팅 안무 타이밍(초) — 계획 D6/D7이 확정한 2초 부팅.
// 이름은 이 파일이 렌더하지 않는다(Navigation 소유). wordmarkRef로
// blur와 시안 스윕 오버레이만 연출한다 — LCP 계약이 이름 자신의
// transform·filter만 허용하고 opacity는 건드릴 수 없기 때문이다.
const SWEEP_AT = 1.4;
const SWEEP_DURATION = 0.3; // blur(5px) → blur(0) 완료 시각: 1.7초
const SWEEP_HALF = SWEEP_DURATION / 2; // 시안 스윕이 지나가는 절반 지점 — 페이드 인/아웃 경계
const ROLE_REVEAL_DURATION = 0.15; // 역할 라벨 완료 시각: 1.85초
const START_REVEAL_DURATION = 0.15; // START 완료 시각: 2.0초
const BOOT_DURATION = 2; // 부팅 총 길이

export default function BootSequence({
  active,
  routeResolved,
  motionReady,
  reducedMotion,
  wordmarkRef,
  onStart,
}: BootSequenceProps) {
  const roleRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const hasStartedRef = useRef(false);

  useLayoutEffect(() => {
    const eligible =
      routeResolved && motionReady && !reducedMotion && active === OVERVIEW;

    if (!eligible || hasStartedRef.current) return;
    hasStartedRef.current = true;

    // cleanup 시점엔 ref.current가 이미 바뀌어 있을 수 있으므로(린트가 경고하는
    // 그대로) 이 effect가 실제로 다룰 노드를 지금 스냅샷으로 고정해 둔다.
    const wordmarkEl = wordmarkRef.current;
    const roleEl = roleRef.current;
    const startEl = startRef.current;

    // 이 effect가 아직 살아있는지 — 언마운트·조건 변화로 정리된 뒤에 동적
    // import promise가 늦게 도착해도 죽은 노드에 timeline을 걸지 않는다.
    let cancelled = false;
    let timeline: gsap.core.Timeline | null = null;

    // GSAP 없이도(청크 로드 실패·언마운트 뒤 도착 등) 항상 쓸 수 있는 최종
    // 상태 노출. 역할 라벨·START의 pre-boot 은닉은 CSS가 소유하므로
    // (styles/design-tokens.css의 no-preference 오버라이드) 인라인 스타일로
    // 그것을 덮어써야 드러난다 — gsap.set()과 동일한 값을 직접 대입한다.
    function revealFinalState() {
      if (roleEl) {
        roleEl.style.opacity = '1';
        roleEl.style.transform = 'translateY(0)';
      }
      if (startEl) {
        startEl.style.opacity = '1';
        startEl.style.transform = 'translateY(0)';
      }
      if (wordmarkEl) {
        wordmarkEl.style.filter = 'blur(0px)';
        // 시안 스윕도 같은 노드(Navigation) 안에 산다 — 실패·중단 경로에서
        // 중간 프레임(반쯤 보이는 스윕)이 남지 않도록 투명으로 되돌린다.
        const sweepEl = wordmarkEl.querySelector<HTMLElement>(
          '[data-testid="wordmark-sweep"]'
        );
        if (sweepEl) sweepEl.style.opacity = '0';
      }
    }

    import('@/lib/gsap')
      .then(({ gsap, registerGsap, SITE_EASE }) => {
        if (cancelled) return;
        registerGsap();

        const tl = gsap.timeline();
        timeline = tl;

        if (wordmarkEl) {
          // pre-boot blur는 이제 CSS([data-wordmark-mode='hero'], design-tokens.css)가
          // 소유한다. 여기서 다시 blur(5px)를 set하지 않는다 — 그러면 SSR
          // 첫 프레임엔 선명하다가 GSAP 로드 뒤에야 갑자기 흐려지는 역방향
          // 플래시가 재발한다. fromTo의 "from" 값은 CSS가 이미 그린 값과
          // 같아서(immediateRender) 핸드오프에 시각적 점프가 없다 — 역할
          // 라벨·START와 동일한 패턴이다.
          tl.fromTo(
            wordmarkEl,
            { filter: 'blur(5px)' },
            { filter: 'blur(0px)', duration: SWEEP_DURATION, ease: SITE_EASE },
            SWEEP_AT
          );

          // 시안 스윕 — 부팅 안무의 시그니처(계획 D6/D7 2단계). 이름 자신의
          // opacity는 LCP 요소라 건드리지 않고, Navigation이 워드마크 버튼
          // 안에 함께 그려 둔 별도 오버레이(wordmark-sweep)만 transform·
          // opacity로 지나가게 한다. 전반부는 화면 왼쪽에서 들어오며
          // 페이드인, 후반부는 오른쪽으로 빠지며 페이드아웃 — 광선 하나가
          // 이름을 스치고 지나가는 모양이다.
          const sweepEl = wordmarkEl.querySelector<HTMLElement>(
            '[data-testid="wordmark-sweep"]'
          );
          if (sweepEl) {
            tl.fromTo(
              sweepEl,
              { xPercent: -140, opacity: 0 },
              { xPercent: 0, opacity: 1, duration: SWEEP_HALF, ease: SITE_EASE },
              SWEEP_AT
            ).to(
              sweepEl,
              { xPercent: 140, opacity: 0, duration: SWEEP_HALF, ease: SITE_EASE },
              SWEEP_AT + SWEEP_HALF
            );
          }
        }

        if (roleEl) {
          tl.fromTo(
            roleEl,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: ROLE_REVEAL_DURATION, ease: SITE_EASE },
            SWEEP_AT + SWEEP_DURATION
          );
        }

        if (startEl) {
          tl.fromTo(
            startEl,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: START_REVEAL_DURATION, ease: SITE_EASE },
            SWEEP_AT + SWEEP_DURATION + ROLE_REVEAL_DURATION
          );
        }

        // 2초 지점을 타임라인 길이로 고정한다 — "2초 안에 완료" 계약의 경계.
        tl.set({}, {}, BOOT_DURATION);
      })
      .catch(() => {
        // GSAP 청크 로드 실패 — 역할 라벨·START의 pre-boot 은닉은 CSS가
        // 소유하므로 아무것도 하지 않으면 영원히 안 보인다. 최종 상태로
        // 강제로 드러낸다(이번 변경이 새로 만드는 위험).
        if (cancelled) return;
        revealFinalState();
      });

    return () => {
      cancelled = true;
      // 부팅 도중 이탈(active가 overview를 벗어남·reducedMotion으로 전환 등) —
      // 역할 라벨·START·워드마크를 중간 프레임이 아니라 최종 안정 상태로
      // 맞춘다. 재방문 시 이 최종 상태가 그대로 유지되고 타임라인은 다시
      // 만들어지지 않는다(hasStartedRef가 이미 true). timeline이 아직 없으면
      // (로드 대기 중 이탈) 곧바로 최종 상태로 둔다.
      timeline?.kill();
      revealFinalState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, motionReady, reducedMotion, routeResolved]);

  return (
    // 워드마크(Navigation)와 같은 뷰포트 50% 기준점을 쓴다 — margin-top의
    // --boot-caption-gap 하나가 간격의 유일한 출처다(design-tokens.css).
    // bottom 값을 여기서 미세조정하지 않는다.
    <div
      data-testid="boot-sequence"
      className="fixed top-1/2 left-1/2 z-40 mt-[var(--boot-caption-gap)] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {/* 역할 라벨 — 정체성 진술. 보조 정보라 START보다 작고 흐리다. */}
      <span
        ref={roleRef}
        data-testid="boot-role"
        className="boot-role block text-t8 uppercase tracking-[0.1em] text-[var(--color-text-secondary)]"
      >
        FRONTEND DEVELOPER
      </span>
      {/* START — 행동 유도. 시안 밑줄 + hover 화살표로 클릭 가능함을
          정지 상태에서도 드러낸다(모바일엔 hover가 없다). */}
      <button
        ref={startRef}
        data-testid="boot-start"
        type="button"
        onClick={onStart}
        className="boot-start group inline-flex min-h-11 items-center gap-2 border-b border-[var(--color-cyan-core)] pb-1 text-t6 uppercase tracking-[0.2em] text-[var(--color-text-primary)] transition-colors duration-300 hover:text-[var(--color-cyan-hi)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
      >
        START — ABOUT
        <span
          aria-hidden="true"
          className="transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      </button>
    </div>
  );
}
