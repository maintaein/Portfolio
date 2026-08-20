'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { OVERVIEW, type NavId } from '@/hooks/useSectionNav';
import { gsap, registerGsap, SITE_EASE } from '@/lib/gsap';

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
// blur만 연출한다 — LCP 계약이 transform·filter만 허용하기 때문이다.
const SWEEP_AT = 1.4;
const SWEEP_DURATION = 0.3; // blur(5px) → blur(0) 완료 시각: 1.7초
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

    registerGsap();

    // cleanup 시점엔 ref.current가 이미 바뀌어 있을 수 있으므로(린트가 경고하는
    // 그대로) 이 effect가 실제로 다룰 노드를 지금 스냅샷으로 고정해 둔다.
    const wordmarkEl = wordmarkRef.current;
    const roleEl = roleRef.current;
    const startEl = startRef.current;

    const tl = gsap.timeline();

    if (wordmarkEl) {
      tl.set(wordmarkEl, { filter: 'blur(5px)' }, 0);
      tl.to(
        wordmarkEl,
        { filter: 'blur(0px)', duration: SWEEP_DURATION, ease: SITE_EASE },
        SWEEP_AT
      );
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

    return () => {
      tl.kill();
      // 부팅 도중 이탈(active가 overview를 벗어남·reducedMotion으로 전환 등) —
      // 역할 라벨·START·워드마크를 중간 프레임이 아니라 최종 안정 상태로
      // 맞춘다. 재방문 시 이 최종 상태가 그대로 유지되고 타임라인은 다시
      // 만들어지지 않는다(hasStartedRef가 이미 true).
      if (roleEl) gsap.set(roleEl, { opacity: 1, y: 0 });
      if (startEl) gsap.set(startEl, { opacity: 1, y: 0 });
      if (wordmarkEl) gsap.set(wordmarkEl, { filter: 'blur(0px)' });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, motionReady, reducedMotion, routeResolved]);

  return (
    <div
      data-testid="boot-sequence"
      className="fixed left-6 bottom-4 z-40 flex flex-col items-start gap-2 sm:left-10 sm:bottom-6"
    >
      <span
        ref={roleRef}
        data-testid="boot-role"
        className="boot-role block text-t7 uppercase tracking-[0.2em] text-[var(--color-cyan-hi)]"
      >
        FRONTEND DEVELOPER
      </span>
      <button
        ref={startRef}
        data-testid="boot-start"
        type="button"
        onClick={onStart}
        className="boot-start min-h-11 text-t7 uppercase tracking-[0.2em] text-[var(--color-text-primary)]"
      >
        START — ABOUT →
      </button>
    </div>
  );
}
