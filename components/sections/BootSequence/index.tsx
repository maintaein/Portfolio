'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { BOOT_DURATION_SECONDS } from '@/lib/constants';
import { OVERVIEW, type NavId } from '@/hooks/useSectionNav';
import type { gsap } from '@/lib/gsap';

export interface BootSequenceProps {
  active: NavId;
  routeResolved: boolean;
  motionReady: boolean;
  reducedMotion: boolean;
  // 씬(HyperspeedBackground)이 처음 살아난 순간 true가 된다. 이름 타임라인이
  // 광선과 같은 순간에 출발해야 하나의 제스처로 읽힌다(부팅 안무 브리프
  // 1절). 씬이 영영 안 뜨는 경우(WebGL·청크 실패)를 위해 SCENE_READY_TIMEOUT_MS
  // 타임아웃과 경합시킨다 — 아래 readyOrTimedOut 참고.
  sceneReady: boolean;
  wordmarkRef: RefObject<HTMLButtonElement | null>;
  // 이름이 "멀리서 도착하는" scale을 여는 wrapper. 워드마크 버튼(FLIP 대상)
  // 자신에는 절대 걸지 않는다 — Navigation/index.tsx의 계약 참고.
  wordmarkScaleRef: RefObject<HTMLDivElement | null>;
  onStart: () => void;
}

// 부팅 안무 타이밍(초) — 부팅 안무 브리프가 확정한 표. 광선(HyperspeedHandle.
// bootIn)과 이름(이 컴포넌트)이 같은 BOOT_DURATION_SECONDS를 공유하고 같은
// 씬-준비 신호에서 함께 출발한다.
//
//   0.00–0.15  광선 fov 펀치            | 이름 scale .65 / blur 8px로 이미 페인트
//   0.15–1.05  광선 고속 유지            | 이름 scale→1, blur→0
//   0.90–1.30  광선 감속(도착)           | (이름은 1.05에 도착 — 감속 구간에 얹힌다)
//   1.30–1.55  idle                     | 역할 라벨
//   1.55–1.80  idle                     | START + 밑줄 draw(0.35s, 1.90 종료)
//   1.80–2.00  버퍼
const NAME_TRANSFORM_AT = 0.15;
const NAME_TRANSFORM_DURATION = 0.9; // 종료 시각 1.05초
const ROLE_REVEAL_AT = 1.3;
const ROLE_REVEAL_DURATION = 0.25; // 종료 시각 1.55초
const START_REVEAL_AT = 1.55;
const START_REVEAL_DURATION = 0.25; // 종료 시각 1.80초
const UNDERLINE_DRAW_DURATION = 0.35; // 종료 시각 1.90초(버퍼 구간까지 살짝 걸친다)

// 씬 준비 신호가 이 시간(ms) 안에 안 오면(WebGL 실패·청크 실패) 타임아웃이
// 대신 부팅을 출발시킨다 — 이름이 영원히 안 나오는 사고를 막는다. Hyperspeed
// 청크(three.js+postprocessing)가 합리적인 회선에서 로드되는 데 걸리는
// 시간보다 넉넉히 크게 잡았다.
const SCENE_READY_TIMEOUT_MS = 600;

export default function BootSequence({
  active,
  routeResolved,
  motionReady,
  reducedMotion,
  sceneReady,
  wordmarkRef,
  wordmarkScaleRef,
  onStart,
}: BootSequenceProps) {
  const roleRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const underlineRef = useRef<HTMLSpanElement>(null);
  const hasStartedRef = useRef(false);
  // START를 누를 때마다 새 키로 링을 다시 마운트해 애니메이션을 처음부터
  // 재생한다. 0이면 아직 한 번도 누르지 않은 것이라 아무것도 렌더하지 않는다.
  const [rippleKey, setRippleKey] = useState(0);

  // 씬 준비 신호 또는 타임아웃 중 먼저 오는 쪽으로 출발한다. sceneReady가
  // true가 되면 곧바로, 아니면 SCENE_READY_TIMEOUT_MS 뒤 타임아웃이 대신
  // readyOrTimedOut을 true로 만든다 — 이후로는 절대 false로 돌아가지 않는다.
  const [readyOrTimedOut, setReadyOrTimedOut] = useState(false);

  useEffect(() => {
    if (sceneReady) {
      setReadyOrTimedOut(true);
      return;
    }
    const timer = setTimeout(() => setReadyOrTimedOut(true), SCENE_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [sceneReady]);

  useLayoutEffect(() => {
    const eligible =
      routeResolved &&
      motionReady &&
      !reducedMotion &&
      active === OVERVIEW &&
      readyOrTimedOut;

    if (!eligible || hasStartedRef.current) return;
    hasStartedRef.current = true;

    // cleanup 시점엔 ref.current가 이미 바뀌어 있을 수 있으므로(린트가 경고하는
    // 그대로) 이 effect가 실제로 다룰 노드를 지금 스냅샷으로 고정해 둔다.
    const wordmarkEl = wordmarkRef.current;
    const wrapperEl = wordmarkScaleRef.current;
    const roleEl = roleRef.current;
    const startEl = startRef.current;
    const underlineEl = underlineRef.current;

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
      }
      if (wrapperEl) {
        wrapperEl.style.transform = 'none';
      }
      if (underlineEl) {
        underlineEl.style.transform = 'scaleX(1)';
      }
    }

    import('@/lib/gsap')
      .then(({ gsap, registerGsap, SITE_EASE }) => {
        if (cancelled) return;
        registerGsap();

        const tl = gsap.timeline();
        timeline = tl;

        if (wrapperEl) {
          // 이름이 "멀리서 도착"하는 scale — 워드마크 버튼이 아니라 이
          // wrapper에 건다(FLIP 불변식, Navigation/index.tsx 계약). from
          // 값은 CSS(.wordmark-scale-wrapper, no-preference)가 이미 그린
          // 값과 같아 핸드오프에 점프가 없다.
          tl.fromTo(
            wrapperEl,
            { scale: 0.65 },
            { scale: 1, duration: NAME_TRANSFORM_DURATION, ease: SITE_EASE },
            NAME_TRANSFORM_AT
          );
          // 광선이 도착한 뒤(이 트윈이 끝나는 시각) wrapper의 transform을
          // 인라인 'none'으로 명시 정착시킨다 — GSAP이 scale:1로 남기는
          // 합성 transform(예: matrix(1,0,0,1,0,0))도 "transform 없음"과
          // 달리 자손의 containing block을 바꿀 수 있어, 나중에 Flip이
          // absolute:true로 워드마크를 붙잡을 때 좌표 기준이 흔들릴 위험이
          // 있다(부팅 안무 브리프 1절 경고). 순수 DOM 대입이라 GSAP의 transform
          // 문자열 파싱을 거치지 않고 항상 리터럴 'none'이 된다.
          tl.call(
            () => {
              wrapperEl.style.transform = 'none';
            },
            undefined,
            NAME_TRANSFORM_AT + NAME_TRANSFORM_DURATION
          );
        }

        if (wordmarkEl) {
          // pre-boot blur는 CSS([data-wordmark-mode='hero'], design-tokens.css)가
          // 소유한다. from 값(8px)이 CSS와 같아(immediateRender) 핸드오프에
          // 점프가 없다. 광선과 같은 시각(0.15)에 시작해 같은 시각(1.05)에
          // 도착한다 — scale과 짝을 이루는 "도착" 신호의 다른 절반이다.
          tl.fromTo(
            wordmarkEl,
            { filter: 'blur(8px)' },
            { filter: 'blur(0px)', duration: NAME_TRANSFORM_DURATION, ease: SITE_EASE },
            NAME_TRANSFORM_AT
          );
        }

        if (roleEl) {
          tl.fromTo(
            roleEl,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: ROLE_REVEAL_DURATION, ease: SITE_EASE },
            ROLE_REVEAL_AT
          );
        }

        if (startEl) {
          tl.fromTo(
            startEl,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: START_REVEAL_DURATION, ease: SITE_EASE },
            START_REVEAL_AT
          );
        }

        if (underlineEl) {
          // 좌→우로 한 번 그어진다(scaleX 0→1, origin-left는 CSS가 건다).
          // START 자체보다 살짝 길게(0.35s) 그어 텍스트가 나타난 뒤에도
          // 잠깐 더 그려지는 느낌을 준다 — 버퍼 구간(1.80–2.00)까지 걸친다.
          tl.fromTo(
            underlineEl,
            { scaleX: 0 },
            { scaleX: 1, duration: UNDERLINE_DRAW_DURATION, ease: SITE_EASE },
            START_REVEAL_AT
          );
        }

        // 2초 지점을 타임라인 길이로 고정한다 — "2초 안에 완료" 계약의 경계.
        tl.set({}, {}, BOOT_DURATION_SECONDS);
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
      // 역할 라벨·START·워드마크·wrapper·밑줄을 중간 프레임이 아니라 최종
      // 안정 상태로 맞춘다. 재방문 시 이 최종 상태가 그대로 유지되고
      // 타임라인은 다시 만들어지지 않는다(hasStartedRef가 이미 true).
      // timeline이 아직 없으면(로드 대기 중 이탈) 곧바로 최종 상태로 둔다.
      timeline?.kill();
      revealFinalState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, motionReady, reducedMotion, routeResolved, readyOrTimedOut]);

  // START를 누르면 클릭 링을 새로 마운트하고(반경은 START 버튼의 2.4배까지만)
  // 곧바로 섹션 전환을 시작한다. 배경의 fov 펀치("임팩트")는 이 클릭이
  // 만드는 isTransitioning edge를 HyperspeedBackground가 이미 boost()로
  // 받는다(기존 계약) — 여기서 handle을 따로 참조하지 않는다.
  function handleStartClick() {
    setRippleKey((key) => key + 1);
    onStart();
  }

  // 워드마크와 마찬가지로 이 컴포넌트는 HomeClient에서 overview 섹션 밖(셸
  // 레벨)에 렌더된다 — content-visibility의 paint containment가 이 fixed
  // 요소를 재배치하는 캡션 점프 버그를 피하기 위해서다(브리프 3절). 그래서
  // 섹션 wrapper의 inert·aria-hidden·은닉을 더 이상 상속받지 못하므로 이
  // 컴포넌트 자신이 active를 보고 직접 그 상태를 소유한다.
  const hiddenFromOverview = active !== OVERVIEW;

  return (
    // 워드마크(Navigation)와 같은 뷰포트 50% 기준점을 쓴다 — margin-top의
    // --boot-caption-gap 하나가 간격의 유일한 출처다(design-tokens.css).
    // bottom 값을 여기서 미세조정하지 않는다.
    <div
      data-testid="boot-sequence"
      inert={hiddenFromOverview}
      aria-hidden={hiddenFromOverview}
      className={`fixed top-1/2 left-1/2 z-40 mt-[var(--boot-caption-gap)] flex -translate-x-1/2 flex-col items-center gap-2 ${
        hiddenFromOverview ? 'boot-caption-hidden' : 'boot-caption-visible'
      }`}
    >
      {/* 역할 라벨 — 정체성 진술. 보조 정보라 START보다 작고 흐리다. */}
      <span
        ref={roleRef}
        data-testid="boot-role"
        className="boot-role block text-t8 uppercase tracking-[0.1em] text-[var(--color-text-secondary)]"
      >
        FRONTEND DEVELOPER
      </span>
      {/* START — 행동 유도. 역할 라벨의 1.36배뿐이던 위계를 깨고 모바일
          t5/태블릿 t3/데스크톱 t2로 역할 라벨(t8 고정)과 항상 2배 이상
          벌어지게 한다 — "속삭임 → 행동"이 성립하는 최소 비율. 화살표·
          목적지 표기 없이 텍스트만 남긴다(3라운드 사용자 판단) — 시안 밑줄
          draw·호흡 + hover 색 전환 + focus-visible 윤곽이 화살표 없이도
          클릭 가능함을 드러낸다. 글자 자신(STAR 텍스트)에는 어떤 애니메이션도
          걸지 않는다 — 맥동은 밑줄·광휘 몫이다. */}
      <button
        ref={startRef}
        data-testid="boot-start"
        type="button"
        onClick={handleStartClick}
        className="boot-start relative inline-flex min-h-11 items-center pb-1 text-t5 sm:text-t3 md:text-t2 uppercase tracking-[0.2em] text-[var(--color-text-primary)] transition-colors duration-300 hover:text-[var(--color-cyan-hi)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
      >
        {/* 아이들 광휘 — 정지 상태의 생동감(축적 서사). transform·opacity만
            애니메이션하는 순수 CSS 루프라 캔버스 비용이 없다. */}
        <span
          aria-hidden="true"
          data-testid="boot-start-glow"
          className="boot-start-glow pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(circle, var(--color-cyan-core) 0%, transparent 70%)',
          }}
        />
        START
        {/* 밑줄 — GSAP이 좌→우로 한 번 그린 뒤(scaleX), 이후는 순수 CSS
            루프로 opacity만 0.55↔1 호흡한다(글자는 건드리지 않는다). */}
        <span
          ref={underlineRef}
          data-testid="boot-start-underline"
          aria-hidden="true"
          className="boot-start-underline absolute bottom-0 left-0 h-px w-full origin-left bg-[var(--color-cyan-core)]"
        />
        {/* 클릭 링 — 이미 있던 .animate-ripple(design-tokens.css)을 재사용한다.
            시안 대신 정점색(--color-cyan-hi)으로 "순간 백색 피크"를 낸다.
            base 크기 60% × keyframe의 scale(4) = 2.4배 반경 상한. 캔버스는
            되살리지 않는다 — 배경이 이미 팽창하는 광선 터널이라 동심원
            링을 더 얹으면 노이즈 위의 노이즈로 읽힌다(감사 판정). */}
        {rippleKey > 0 && (
          <span
            key={rippleKey}
            aria-hidden="true"
            data-testid="boot-start-ripple"
            className="animate-ripple pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[60%] rounded-full bg-[var(--color-cyan-hi)]"
          />
        )}
      </button>
    </div>
  );
}
