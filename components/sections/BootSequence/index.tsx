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

// 부팅 안무 타이밍(초) — 부팅 안무 2차 브리프가 다시 확정한 표. 광선
// (HyperspeedHandle.bootIn)과 이름(이 컴포넌트)이 같은 BOOT_DURATION_SECONDS를
// 공유하고 같은 씬-준비 신호에서 함께 출발한다.
//
// 1차 라운드는 이름이 0.15초부터 등장해 "광선이 아직 깊이에서 밀려오는 중인데
// 이름이 이미 도착해 있다"는 문제였다(2차 실기기 피드백). 광선의 개수 램프가
// 목표(idle)에 도달해 "자연스럽게 전환"되는 시각(App의 BOOT_LIGHT_RAMP_RATIO —
// 2초 부팅 기준 1.30초)에 이름이 함께 실리도록 등장 시각을 뒤로 미뤘다.
//
// 터널 진입 브리프(3차)가 광선 쪽을 다시 바꿨다 — 광선은 더 이상 t=0에 fov
// 펀치로 즉시 최고 속도가 아니라 "느리게 시작 → 개수 램프와 함께 빨라짐 →
// 1.30초에 idle로 정착"하는 대칭 곡선이고(Hyperspeed/index.tsx bootIn 참고),
// 소실점(aOffset.z 압축)에서 밀려나오는 연출도 같은 1.30초에 완성된다. 이름
// 타임라인 자체의 시각(NAME_TRANSFORM_AT 등)은 그대로다 — 광선이 idle로
// 수렴하는 시각과 여전히 일치하기 때문이다. 이름은 opacity 0으로 시작해
// (LCP 계약 변경, 3절) 이 구간에 scale·blur와 함께 1로 열린다.
//
//   0.00–1.30  광선 느림→빠름→idle 정착 + 개수 램프(먼 것부터 채움) + 소실점 압축 해제 | 이름은 아직 opacity 0 / scale .35 / blur 11px(페인트조차 안 된다)
//   0.75–1.30  (위와 겹침)                                        | 이름 opacity→1, scale→1, blur→0(0.55s) — 광선이 idle로 정착하는 것과 같은 박자
//   1.30–1.55  idle                                               | 역할 라벨
//   1.55–1.80  idle                                               | START + 밑줄 draw(0.35s, 1.90 종료)
//   1.80–2.00  버퍼
const NAME_TRANSFORM_AT = 0.75;
const NAME_TRANSFORM_DURATION = 0.55; // 종료 시각 1.30초 — 광선 개수 램프·감속 도착과 동시
const ROLE_REVEAL_AT = 1.3;
const ROLE_REVEAL_DURATION = 0.25; // 종료 시각 1.55초
const START_REVEAL_AT = 1.55;
const START_REVEAL_DURATION = 0.25; // 종료 시각 1.80초
const UNDERLINE_DRAW_DURATION = 0.35; // 종료 시각 1.90초(버퍼 구간까지 살짝 걸친다)

// START 클릭 후 실제 섹션 전환(onStart)까지의 지연(ms). 클릭 링은 터널
// 진입 브리프(3차)에서 제거됐다 — 대신 글자가 --color-cyan-hi로 반짝인다
// (.boot-start-flash, 0.42s, 정점은 40% 지점 ≈168ms). 지연은 그 정점을
// 확실히 지나 "차오름"이 보인 뒤에 전환이 시작되도록 재조정했다(이전 링
// 기준 220ms에서 소폭 상향). 부팅 2초 계약과는 별개 예산이다(START를
// 눌러야만 발생하고, 부팅 자체의 길이에는 포함되지 않는다).
const START_TRANSITION_DELAY_MS = 230;

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
  // START를 누를 때마다 새 키로 텍스트 span을 다시 마운트해 반짝임
  // 애니메이션(.boot-start-flash)을 처음부터 재생한다. 0이면 아직 한 번도
  // 누르지 않은 것이라 클래스를 걸지 않는다(상시 맥동이 아니다).
  const [flashKey, setFlashKey] = useState(0);
  // 클릭 후 실제 onStart()까지의 지연 예약. null이면 예약이 없다 — 이
  // 값의 존재 자체가 "이미 예약됨" 가드다(중복 클릭 방지).
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        wordmarkEl.style.opacity = '1';
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
          // 값과 같아 핸드오프에 점프가 없다. 0.35 — 2차 실기기 피드백
          // ("멀리서 도착한다는 느낌이 없다")에 따라 1차의 0.65에서
          // 낮췄다. 2차 감사는 가독을 이유로 0.6~0.7을 권했고 0.2~0.3
          // 같은 극단에는 반대했다 — 0.35는 그 권고 범위 바로 아래,
          // 사용자가 요구한 "더 강한 원경감"과 감사의 가독 우려 사이의
          // 절충이다. wrapperEl 자신은 여전히 opacity를 건드리지 않는다
          // (FLIP 불변식은 scale·position만의 문제이므로 이대로 유지) —
          // 다만 opacity 0→1은 이제 wordmarkEl 쪽에서 걸린다(터널 진입
          // 브리프 3절, LCP 계약 변경). 즉 이름은 도착 시각까지 아예
          // 페인트되지 않으므로, scale(0.35)의 "가장 크게 렌더된 순간을
          // 늦춘다"는 우려보다 opacity 자체가 LCP 시각을 늦춘다는 우려가
          // 더 크다 — 실기기 LCP 재측정 필요(리포트 참고).
          tl.fromTo(
            wrapperEl,
            { scale: 0.35 },
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
          // pre-boot blur·opacity는 CSS([data-wordmark-mode='hero'],
          // design-tokens.css)가 소유한다. from 값(11px·0)이 CSS와 같아
          // (immediateRender) 핸드오프에 점프가 없다. 광선의 개수 램프·감속이
          // idle로 정착하는 시각과 같은 시각(NAME_TRANSFORM_AT~+DURATION)에
          // 시작해 도착한다 — scale과 짝을 이루는 "도착" 신호의 다른
          // 절반이다. 11px — 1차의 8px에서 올렸다(2차 브리프 권고 범위
          // 10~12px의 중간). opacity 0→1 — 사용자가 LCP 계약 중 "opacity
          // 0으로 시작하지 않는다"를 폐기하기로 결정하며 새로 추가됐다
          // (터널 진입 브리프 3절) — "광선을 타고 가다가 이름에 닿는다"를
          // 위해 첫 프레임부터 흐릿하게라도 보이던 이름을 아예 감춘다.
          tl.fromTo(
            wordmarkEl,
            { filter: 'blur(11px)', opacity: 0 },
            { filter: 'blur(0px)', opacity: 1, duration: NAME_TRANSFORM_DURATION, ease: SITE_EASE },
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

  // 지연 중 active가 다른 곳으로 바뀌면(다른 네비게이션이 먼저 이겼다는
  // 뜻) 예약된 onStart()가 그걸 덮어쓰면 안 된다 — 이 effect의 cleanup이
  // active가 바뀔 때마다(그리고 unmount 시에도) 남은 예약을 정리한다.
  useEffect(() => {
    return () => {
      if (startTimeoutRef.current !== null) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    };
  }, [active]);

  // START를 누르면 글자를 새로 마운트해 반짝임(.boot-start-flash)을 재생하고
  // START_TRANSITION_DELAY_MS 뒤에 섹션 전환을 시작한다 — "에너지가
  // 차올랐다 돌아오는" 반짝임을 볼 시간을 준다(터널 진입 브리프 4절, 클릭
  // 링은 이 라운드에서 제거했다). 배경의 fov 펀치("임팩트")는 이 전환이
  // 만드는 isTransitioning edge를 HyperspeedBackground가 이미 boost()로
  // 받는다(기존 계약) — 여기서 handle을 따로 참조하지 않는다.
  //
  // 가드 네 가지: (1) 이미 예약돼 있으면(startTimeoutRef가 non-null) 재클릭을
  // 무시한다 — 전환이 두 번 예약되지 않는다. (2) 지연 중 다른 네비가 이기면
  // 위 effect의 cleanup이 이 예약을 정리한다. (3) 언마운트도 같은 cleanup이
  // 처리한다. (4) reducedMotion이면 지연 없이 즉시 이동한다.
  function handleStartClick() {
    if (startTimeoutRef.current !== null) return;

    setFlashKey((key) => key + 1);

    if (reducedMotion) {
      onStart();
      return;
    }

    startTimeoutRef.current = setTimeout(() => {
      startTimeoutRef.current = null;
      onStart();
    }, START_TRANSITION_DELAY_MS);
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
          클릭 가능함을 드러낸다. 정지 상태에서 글자 자신(START 텍스트)에는
          어떤 상시 애니메이션도 걸지 않는다 — 맥동은 밑줄·광휘만의 몫이다.
          클릭 시 한 번 반짝이는 것은 다른 것이고 사용자가 명시적으로
          요청했다(터널 진입 브리프 4절) — 아래 flashKey 분기 참고. */}
      <button
        ref={startRef}
        data-testid="boot-start"
        type="button"
        onClick={handleStartClick}
        className="boot-start relative inline-flex min-h-11 items-center text-t5 sm:text-t3 md:text-t2 uppercase tracking-[0.2em] text-[var(--color-text-primary)] transition-colors duration-300 hover:text-[var(--color-cyan-hi)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
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
        {/* 텍스트를 감싸는 relative span — 밑줄의 위치 기준이다. 44px
            터치 타깃(min-h-11)은 버튼 자신이 지키고, 이 span은 글자
            자신의 박스 크기만 갖는다. 예전에는 밑줄이 버튼 바로 아래
            자식(absolute bottom-0)이라 44px 박스의 바닥(글자보다
            10~13px 아래)에 그어졌다 — 이 wrapper로 밑줄을 글자에
            붙인다(2차 실기기 피드백). */}
        <span className="relative inline-block pb-1">
          {/* 클릭 반짝임 — 사용자 판단으로 클릭 링을 대체했다("에너지가
              차오르듯이 글씨가 Hyperspeed 색으로 반짝거리기만 하도록",
              터널 진입 브리프 4절). key를 클릭마다 올려 span을 다시
              마운트하면 .boot-start-flash(design-tokens.css, 1회성
              keyframe)가 처음부터 재생된다 — 상시 루프가 아니라 클릭
              반응이므로 "글자 자신에는 어떤 CSS 애니메이션도 걸리지
              않는다"는 계약(위 주석)은 정지 상태 한정으로 좁혀 유지한다.
              reducedMotion에서는 클래스를 걸지 않는다 — 호흡·개수 램프와
              같은 원칙. */}
          <span
            key={flashKey}
            data-testid="boot-start-text"
            className={flashKey > 0 && !reducedMotion ? 'boot-start-flash' : undefined}
          >
            START
          </span>
          {/* 밑줄 — GSAP이 좌→우로 한 번 그린 뒤(scaleX), 이후는 순수 CSS
              루프로 opacity만 0.55↔1 호흡한다(글자는 건드리지 않는다). */}
          <span
            ref={underlineRef}
            data-testid="boot-start-underline"
            aria-hidden="true"
            className="boot-start-underline absolute bottom-0 left-0 h-px w-full origin-left bg-[var(--color-cyan-core)]"
          />
        </span>
      </button>
    </div>
  );
}
