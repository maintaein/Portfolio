'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { BOOT_DURATION_SECONDS } from '@/lib/constants';
import { OVERVIEW, type NavId } from '@/hooks/useSectionNav';
import type { gsap } from '@/lib/gsap';
import { detectQuality, type QualityTier } from '@/lib/deviceQuality';
import ParticleText, {
  type ParticleTextHandle,
  type ParticleTextTier,
} from '@/components/blocks/ParticleText';

export interface BootSequenceProps {
  active: NavId;
  routeResolved: boolean;
  motionReady: boolean;
  reducedMotion: boolean;
  wordmarkRef: RefObject<HTMLButtonElement | null>;
  onStart: () => void;
  // HERO 재순서 브리프 — 파티클 뭉침이 끝나 DOM 이름이 나타나는 그 순간
  // (아래 NAME_HANDOFF_AT) 정확히 한 번 불린다. 부모(HomeClient)는 이 신호로
  // Hyperspeed 배경을 페이드로 드러낸다("배경이 이름 다음에 온다"). GSAP
  // 타임라인이 도는 정상 경로뿐 아니라 실패·이탈 등 모든 폴백 경로에서도
  // revealFinalState()가 함께 불러 배경이 영원히 숨은 채로 남지 않는다.
  onNameRevealed?: () => void;
}

// HERO 재순서 브리프 — "아무것도 없는 배경 → 이름이 파티클로 뭉쳐 만들어짐 →
// Hyperspeed 배경이 자연스럽게 등장". 이전 라운드들이 시도한 광선 부팅
// 안무(느리게 시작 → 개수 램프와 함께 빨라짐 → idle 정착, 소실점 압축 해제
// 등)는 세 라운드에 걸쳐도 실기기에서 읽히지 않아 사용자가 전부 취소했다 —
// 이번에 전부 걷어내고(Hyperspeed/index.tsx 참고) 광선과 이름을 동기화하던
// sceneReady/타임아웃 게이트도 함께 지웠다. 이름은 이제 배경 상태와 무관하게
// 시작한다 — 애초에 배경이 이름이 끝날 때까지 보이지 않으므로 동기화할
// 대상이 없다.
//
// 파티클이 먼저 완전히 뭉치고, 뭉침이 끝나는 정확히 그 순간 DOM 이름이
// 나타난다(핸드오프) — 크로스페이드가 아니다. NAME_HANDOFF_AT 하나가 세
// 가지 시각의 단일 출처다: 파티클 형성 종료 = DOM 이름 등장 = 배경 노출
// 시작(onNameRevealed). 파티클의 durationMs prop도 이 값에서 파생된다
// (NAME_HANDOFF_AT_MS) — 두 컴포넌트가 각자 다른 상수를 들고 있지 않다.
//
// 파티클 이음매 브리프(5차) — "뭉친 파티클"과 "안티앨리어싱된 실제 글자"는
// 애초에 다른 그림이라(반지름 vs 안티앨리어싱) 한 프레임 하드 스왑은
// 아무리 타이밍을 맞춰도 툭 끊겨 보였다. 마지막 SEAM_OVERLAP_MS 동안만
// 캔버스 페이드아웃(ParticleText 내부, seamMs prop)과 DOM 이름 페이드인이
// 겹친다 — 3차 피드백이 거부한 0.55초 병렬 페이드(반 초 동안 파티클과
// 이름이 둘 다 따로 보였다)와는 다르다. 상한은 150ms(테스트가 고정), 지금
// 쓰는 값은 그 안의 120ms다.
//
//   0.00–0.78  캔버스에서 파티클이 흩어진 상태→이름 형태로 뭉친다 | DOM 이름은 opacity 0, 배경은 보이지 않는다
//   0.78–0.90  겹침(SEAM_OVERLAP_MS) — 캔버스가 흐려지며 사라진다 | DOM 이름이 같은 창에서 페이드인한다
//   0.90       핸드오프 종료 — 파티클 캔버스 완전히 비움, DOM opacity 1 확정, 배경 페이드 시작
//   1.05–1.30  idle                                               | 역할 라벨
//   1.30–1.55  idle                                               | START + 밑줄 draw(0.35s, 1.90 종료)
//   1.55–2.00  버퍼
const NAME_HANDOFF_AT = 0.9;
const NAME_HANDOFF_AT_MS = NAME_HANDOFF_AT * 1000;
// 이음매 겹침 구간(ms) — 위 표의 [0.78, 0.90] 창의 길이. 상한 150ms를
// 테스트가 고정한다(__tests__/components/BootSequence.test.tsx).
const SEAM_OVERLAP_MS = 120;
const SEAM_OVERLAP_SECONDS = SEAM_OVERLAP_MS / 1000;
const ROLE_REVEAL_AT = 1.05;
const ROLE_REVEAL_DURATION = 0.25; // 종료 시각 1.30초
const START_REVEAL_AT = 1.3;
const START_REVEAL_DURATION = 0.25; // 종료 시각 1.55초

export default function BootSequence({
  active,
  routeResolved,
  motionReady,
  reducedMotion,
  wordmarkRef,
  onStart,
  onNameRevealed,
}: BootSequenceProps) {
  const roleRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const hasDecidedRef = useRef(false);
  // 이름 파티클 형성(ParticleText)의 재생 트리거. GSAP 타임라인이 t=0에
  // tl.call()로 이 ref의 play()를 부른다. 아래 eligible 게이트가 tier를
  // 포함하므로 "기기 등급 미확정"은 더 이상 null의 이유가 아니다(파티클
  // 경합 브리프). 그래도 reducedMotion·low tier(캔버스 자체를 안 만드는
  // 경우)나 getContext 실패 같은 준비 실패로 null일 수 있어, 옵셔널
  // 체이닝으로 조용히 아무 일도 없게 둔다. DOM 워드마크의 opacity 전환은
  // 이 호출과 무관하게 항상 스케줄되므로, 파티클이 실패해도 "이름이 안
  // 보이는" 사고로 이어지지 않는다(아래 wordmarkEl 트윈 참고).
  const particleRef = useRef<ParticleTextHandle>(null);
  // START를 누를 때마다 새 키로 텍스트 span을 다시 마운트해 반짝임
  // 애니메이션(.boot-start-flash)을 처음부터 재생한다. 0이면 아직 한 번도
  // 누르지 않은 것이라 클래스를 걸지 않는다(상시 맥동이 아니다).
  const [flashKey, setFlashKey] = useState(0);
  // 이미 눌렀는가. 사용자가 "누르는 효과와 동시에 이동"으로 바꾸면서 클릭과
  // 전환 사이의 지연이 사라졌고, 지연 예약의 존재 자체가 맡던 중복 클릭
  // 가드도 함께 근거를 잃었다. 그것을 이 불리언이 대신한다. 같은 태스크에서
  // 두 번 눌러도 React가 아직 다시 그리기 전이므로 두 번째 클릭은 여기서
  // 걸린다. 아래 active를 보는 effect가 이동이 끝나면 풀어 줘서 overview로
  // 돌아왔을 때 START가 다시 눌린다.
  const startPressedRef = useRef(false);

  // 기기 등급(low/medium/high) — 파티클 형성을 돌릴지, 돌린다면 어떤
  // 파라미터로 돌릴지의 단일 출처(lib/deviceQuality.ts). null은 "아직
  // 모른다"이고, 아래 eligible 게이트가 이 null을 막는다. 등급이 정해지고
  // (필요하면) ParticleText가 마운트돼 ref가 붙은 뒤에야 부팅 타임라인이
  // 만들어진다(파티클 경합 브리프 (나)). GSAP 청크가 캐시에서 즉시 와도
  // ParticleText가 아직 마운트 전이라 particleRef.current가 null이던
  // 경합이 근본 원인이었다. 이 게이트가 tier를 영영 못 받으면 부팅이
  // 영원히 시작 안 되는 위험을 새로 만들므로, lib/deviceQuality.ts의
  // readBattery()에 상한을 둬 detectQuality()가 반드시 끝나게 한다(그쪽
  // 주석 참고). 이 게이트와 그 상한은 한 몸이다. low는 영구히 파티클을
  // 만들지 않는다. 대신 DOM 워드마크의 opacity 트윈(단순 페이드)이 그대로
  // 이름을 보여준다.
  const [tier, setTier] = useState<QualityTier | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectQuality()
      .catch(() => {
        // 등급을 못 정하면 tier가 영원히 null로 남는데, 아래 타임라인
        // 게이트가 tier를 보므로 부팅이 시작되지 않아 이름이 아예 안
        // 보인다. 여덟 경로 계약이 깨지는 최악의 결과다. readBattery의
        // 상한은 "응답이 없는" 경우만 막아 주므로 "던지는" 경우는 여기서
        // 받는다. low로 떨어뜨리면 파티클만 포기하고 DOM 워드마크의
        // opacity 트윈이 이름을 그대로 보여준다.
        return 'low' as const;
      })
      .then((detected) => {
        if (!cancelled) setTier(detected);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // medium(고밀도 터치 — deviceQuality.ts 기준 실측 기기, 예: Galaxy S25)에서도
  // 파티클을 돌리기로 판단했다: 이 저장소의 실기기 피드백 전부가 바로 그
  // 등급의 기기에서 나왔다. low에서만 완전히 끈다 — 판단 근거는
  // particle-name-report.md 참고.
  const particleTier: ParticleTextTier | null =
    tier === 'high' || tier === 'medium' ? tier : null;

  useLayoutEffect(() => {
    // 부팅 여부는 최초 라우트가 정해지는 그 순간 한 번만 판정한다. active는
    // 이 조건에 들어가지 않는다. 예전에는 active === OVERVIEW를 함께 요구해서
    // #projects 같은 딥링크로 들어오면 빗장이 잠기지 않은 채로 남았고, 나중에
    // 워드마크를 눌러 overview로 갈 때 조건이 그제야 전부 참이 되면서 부팅이
    // 처음부터 재생됐다(좌상단에서 파티클이 뭉친 뒤에야 overview로 넘어갔다).
    // tier가 조건에 있는 이유는 파티클 경합 브리프 (나)이고, readBattery()의
    // 상한이 이 조건을 영원히 막지 않게 하는 안전장치다.
    const decidable = routeResolved && motionReady && tier !== null;

    if (!decidable || hasDecidedRef.current) return;
    hasDecidedRef.current = true;

    // 모션을 끈 경우. CSS의 pre-boot 은닉 자체가 no-preference 안에만 있어
    // 이미 최종 상태로 보인다. 예전과 같이 아무것도 하지 않는다.
    if (reducedMotion) return;

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
    // onNameRevealed도 여기서 함께 부른다 — 이 경로(GSAP 실패·이탈·언마운트)
    // 는 이름이 이미 최종 상태로 강제 노출되므로 배경도 같은 순간 드러나야
    // 한다(그러지 않으면 이름은 보이는데 배경만 영원히 검은 채로 남는다).
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
        wordmarkEl.style.opacity = '1';
      }
      onNameRevealed?.();
    }

    // 최초 라우트가 overview가 아니었다. 부팅은 영영 재생되지 않는다. 그래도
    // 최종 상태로는 반드시 맞춰 둬야 한다. 이름·역할·START의 pre-boot 은닉은
    // CSS가 소유하고(no-preference 오버라이드) 그것을 벗기는 것은 부팅
    // 타임라인 아니면 이 함수뿐이다. 여기서 부르지 않으면 나중에 워드마크로
    // overview에 왔을 때 배경과 푸터만 남고 본문이 비어 보인다. 배경을 여는
    // onNameRevealed도 이 안에 함께 있다.
    if (active !== OVERVIEW) {
      revealFinalState();
      return;
    }

    import('@/lib/gsap')
      .then(({ gsap, registerGsap, SITE_EASE }) => {
        if (cancelled) return;
        registerGsap();

        const tl = gsap.timeline();
        timeline = tl;

        // 파티클 형성(ParticleText) 재생 — t=0에 흩어진 조각이 뭉치기
        // 시작한다(핸드오프 브리프 3절 "파티클이 먼저 완전히 뭉친다"). 위
        // eligible 게이트가 tier를 포함하므로 이 시점엔 등급이 이미
        // 정해졌고, particleTier가 있으면 ParticleText도 같은 커밋에서
        // 이미 마운트돼 layout effect로 샘플링까지 끝낸 뒤다(파티클 경합
        // 브리프 (나)(다)). particleRef.current가 그래도 없으면(low
        // tier·reducedMotion처럼 애초에 렌더하지 않는 경우, 또는 getContext
        // 실패 같은 준비 실패) 옵셔널 체이닝으로 조용히 아무것도 하지
        // 않는다. 아래 wordmarkEl의 opacity 전환은 이 호출과 완전히
        // 독립적으로 스케줄되므로, 파티클이 실패해도 이름은 원래 계획대로
        // 도착한다(파티클 형성 브리프의 "이름 없는 사이트를 만들지 마라"
        // 대응, 8번째 실패 경로).
        tl.call(
          () => {
            particleRef.current?.play();
          },
          undefined,
          0
        );

        if (wordmarkEl) {
          // 핸드오프(브리프 3절, 이음매 완화는 5차) — 크로스페이드가 아니라
          // 마지막 SEAM_OVERLAP_MS 동안만 캔버스 페이드아웃(ParticleText
          // 내부)과 겹친다. 3차 피드백이 거부한 0.55초 병렬 페이드(반 초
          // 동안 파티클과 이름이 둘 다 따로 보였다)와 다르다 — 이번 겹침은
          // SEAM_OVERLAP_MS(<=150ms 상한, 테스트가 고정)뿐이고 흐려지는
          // 캔버스 "뒤"에서 일어나 이음매 자체가 거의 안 보인다. pre-boot
          // opacity(0)는 여전히 CSS([data-wordmark-mode='hero'],
          // design-tokens.css)가 소유한다 — immediateRender:false가 없으면
          // gsap이 이 트윈을 만드는 즉시(포지션과 무관하게) opacity:0을
          // 동기로 인라인에 써버려 "핸드오프 전까지 JS가 인라인을 안
          // 건드린다"는 계약이 겹침 구간 시작 전에 깨진다 — 반드시 켜 둔다.
          tl.fromTo(
            wordmarkEl,
            { opacity: 0 },
            {
              opacity: 1,
              duration: SEAM_OVERLAP_SECONDS,
              ease: 'none',
              immediateRender: false,
            },
            NAME_HANDOFF_AT - SEAM_OVERLAP_SECONDS
          );
        }

        // 배경 노출 트리거 — 파티클 뭉침이 끝나는 것과 정확히 같은 순간에
        // 부모(HomeClient)가 Hyperspeed 배경을 페이드로 드러낸다. 위
        // wordmarkEl 트윈이 끝나는 위치(NAME_HANDOFF_AT)와 같은 곳에 둬 "두
        // 시각이 한 곳에서 정해진다"는 계약을 만족한다 — 상수가 아니라
        // 타임라인 위치 자체가 단일 출처다.
        tl.call(() => onNameRevealed?.(), undefined, NAME_HANDOFF_AT);

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
      // 타임라인은 다시 만들어지지 않는다(hasDecidedRef가 이미 true).
      // timeline이 아직 없으면(로드 대기 중 이탈) 곧바로 최종 상태로 둔다.
      timeline?.kill();
      revealFinalState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, motionReady, reducedMotion, routeResolved, tier]);

  // active가 바뀌면(START로 이동했든 다른 네비가 이겼든) 눌림 빗장을 푼다.
  // 그래야 overview로 돌아왔을 때 START가 다시 눌린다. cleanup이라 언마운트도
  // 같은 자리에서 처리된다.
  useEffect(() => {
    return () => {
      startPressedRef.current = false;
    };
  }, [active]);

  // START를 누르면 글자를 새로 마운트해 반짝임(.boot-start-flash)을 재생하고
  // 곧바로 섹션 전환을 시작한다. 예전에는 반짝임을 다 보여주려고 420ms를
  // 기다렸는데, 사용자가 "누르는 효과와 동시에 이동"으로 바꿨다. 버튼이 곧
  // 사라지므로 충전이 끝까지 보이지는 않는다. 그것이 요청한 결과다.
  // 배경의 fov 펀치("임팩트")는 이 전환이 만드는 isTransitioning edge를
  // HyperspeedBackground가 이미 boost()로 받는다(기존 계약).
  //
  // reducedMotion 분기는 사라졌다. 예전에는 그쪽만 즉시 이동이었는데 이제
  // 두 경로가 같아졌다.
  function handleStartClick() {
    if (startPressedRef.current) return;
    startPressedRef.current = true;

    setFlashKey((key) => key + 1);
    onStart();
  }

  // 워드마크와 마찬가지로 이 컴포넌트는 HomeClient에서 overview 섹션 밖(셸
  // 레벨)에 렌더된다 — content-visibility의 paint containment가 이 fixed
  // 요소를 재배치하는 캡션 점프 버그를 피하기 위해서다(브리프 3절). 그래서
  // 섹션 wrapper의 inert·aria-hidden·은닉을 더 이상 상속받지 못하므로 이
  // 컴포넌트 자신이 active를 보고 직접 그 상태를 소유한다.
  const hiddenFromOverview = active !== OVERVIEW;

  // START 버튼 자체 — 호버 시 전기 충전 효과(순수 CSS, .boot-start:hover +
  // design-tokens.css)가 이 마크업에 걸린다. Magnet(자석 추종 호버)은 사용자
  // 판단으로 걷어냈다 — "디자인 나쁨. 호버 시 효과를 자석이 아닌, 전기적
  // 에너지가 글씨에 충전되는듯한 이펙트로" 재검토 결과다. ClickSpark(캔버스
  // 스파크)도 파티클 이음매 브리프(5차)에서 걷어냈다 — "스파크 안 보임"
  // 피드백에 스파크 자체를 고치는 대신 걷어내고, 클릭 시 아래 boot-start-flash
  // (호버와 같은 filter drop-shadow 충전 언어)를 강화하는 쪽을 택했다.
  const startButton = (
    <button
      ref={startRef}
      data-testid="boot-start"
      type="button"
      onClick={handleStartClick}
      className="boot-start relative inline-flex min-h-11 items-center text-t3 sm:text-t2 md:text-t1 uppercase tracking-[0.2em] text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]"
    >
      {/* 아이들 광휘를 제거했다(3차 실기기 피드백). 버튼 크기의 220%라
          START 위로 크게 삐져나와 이름과 START 사이에 정체불명의 얼룩으로
          보였다 — 무엇을 위한 빛인지 읽히지 않으면 장식 노이즈이고, 2차
          감사가 지적한 AI slop 6번(장식용 블롭)에 오히려 가까워진다.
          START의 생동감은 밑줄 draw·호흡과 hover·click 반응이 맡는다. */}
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
            같은 원칙. 파티클 이음매 브리프(5차)가 이 키프레임에 filter
            (drop-shadow) 스텝을 더해 호버 충전과 같은 언어로 강화했다 —
            ClickSpark를 대신한다. key 리마운트만으로 재생되므로 hover
            상태와 무관하다(모바일에서도 그대로 발동한다). */}
        <span
          key={flashKey}
          data-testid="boot-start-text"
          className={flashKey > 0 && !reducedMotion ? 'boot-start-flash' : undefined}
        >
          START
        </span>
      </span>
    </button>
  );

  return (
    <>
      {/* 이름 파티클 형성 — 순수 장식(aria-hidden·pointer-events-none)이고
          워드마크 DOM과 별개의 독립된 오버레이다. low tier·reducedMotion·
          기기 등급 미확정(tier===null)에서는 아예 렌더하지 않는다 — 그동안
          이름은 wordmarkEl의 opacity 트윈(단순 페이드)만으로 보인다. */}
      {particleTier && !reducedMotion ? (
        <ParticleText
          ref={particleRef}
          wordmarkRef={wordmarkRef}
          tier={particleTier}
          durationMs={NAME_HANDOFF_AT_MS}
          seamMs={SEAM_OVERLAP_MS}
        />
      ) : null}
      {/* 워드마크(Navigation)와 같은 뷰포트 50% 기준점을 쓴다 — margin-top의
          --boot-caption-gap 하나가 간격의 유일한 출처다(design-tokens.css).
          bottom 값을 여기서 미세조정하지 않는다. */}
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
          className="boot-role block text-t7 sm:text-t6 md:text-t5 uppercase tracking-[0.1em] text-[var(--color-text-secondary)]"
        >
          FRONTEND DEVELOPER
        </span>
        {/* START — 행동 유도. 역할 라벨의 1.36배뿐이던 위계를 깨고 모바일
            t5/태블릿 t3/데스크톱 t2로 역할 라벨(t8 고정)과 항상 2배 이상
            벌어지게 한다 — "속삭임 → 행동"이 성립하는 최소 비율. 화살표·
            목적지 표기 없이 텍스트만 남긴다(3라운드 사용자 판단). 마크업
            자체는 위 startButton에서 정의한다. */}
        {startButton}
      </div>
    </>
  );
}
