'use client';

// react-bits ParticleText를 이 저장소의 부팅 안무 전용으로 크게 줄이고
// 고쳤다. 원본은 상시 인터랙션 위젯(hover/click 트리거, idle drift, 포인터
// 반발, 2색 보간, 자체 aria-label)이지만 여기서는 부팅 중 GSAP 타임라인이
// 지정한 시각에 딱 한 번 재생되는 1회성 연출이다.
// 원본: https://github.com/davidhdev/react-bits
//       src/ts-tailwind/TextAnimations/ParticleText/ParticleText.tsx
//
// 변경점(원본 대비):
// - hover/click trigger, idle drift, 포인터 반발(pointerRepel), glow
//   (shadowBlur), highlightColor 보간을 전부 제거했다 — 전부 부팅 연출과
//   무관하고 상시 rAF를 만드는 원인이었다.
// - 자체 aria-label·sr-only span을 제거했다. 이 캔버스는 순수 장식이고
//   접근성 이름은 DOM 워드마크(wordmarkRef) 하나가 이미 갖고 있다 — 여기서
//   또 하나의 접근 가능한 이름을 만들면 이름이 접근성 트리에 둘로 노출된다.
// - 폰트·크기·자간·색을 하드코딩하지 않고 wordmarkRef가 가리키는 실제 DOM
//   노드에서 getComputedStyle로 읽어온다. 뭉쳐진 파티클의 최종 위치·크기·
//   자간이 DOM과 픽셀 단위로 어긋나면 형성 완료 뒤 DOM으로 전환되는 순간
//   글자가 튄다.
// - 글리프 샘플링(getImageData)은 마운트 시 1회만 한다 — 원본은
//   ResizeObserver로 리사이즈마다 다시 샘플링하는데, 부팅 중에는 크기가
//   바뀌지 않으므로 필요 없다.
// - 파티클 수 상한·캔버스 DPR·샘플 간격을 기기 등급(QualityTier)별로
//   강제한다 — 모바일 실측 여유가 16.5ms뿐이고 그 위에 Hyperspeed WebGL이
//   이미 돈다(부팅 안무 최적화 요구).
// - play() 호출 후 durationMs가 지나면 rAF를 즉시 멈추고 캔버스를 비운다.
//   원본은 idle drift 때문에 rAF가 영원히 돈다.
// - 캔버스는 워드마크 DOM과 별개의 독립된 position:fixed 오버레이다(버튼
//   자신의 자식이 아니다) — 워드마크 버튼은 FLIP 대상이라 position이나
//   transform을 가지면 안 되므로(Navigation/index.tsx 계약), 캔버스를 그
//   버튼 안에 겹쳐 넣는 대신 뷰포트 좌표(getBoundingClientRect)로 버튼
//   위치를 읽어와 스스로 자리를 잡는다.
// - 파티클 이음매 브리프(5차). 반지름을 sampleStep에 비례시키고 수렴하며
//   커지게 했다(DIAMETER_TO_STEP_RATIO·START_RADIUS_RATIO). seamMs prop을
//   받으면 형성 마지막 그 ms 동안 캔버스가 흐려지며 페이드아웃한다. DOM
//   이름의 페이드인과 짧게 겹쳐 "툭 끊기는" 대신 흐림 뒤로 이음매를 감춘다.
// - 파티클 잔소음 브리프(6차). 이음매 구간 진입 시 캔버스를 마지막으로 한
//   번만 그리고 rAF를 멈춘다. 사라지는 연출(opacity·filter)은 더 이상 매
//   프레임 인라인 스타일로 다시 계산하지 않고 CSS transition 한 번으로
//   맡긴다. scatterPx도 넓히면서 캔버스 여백을 최대 산포 거리에서 유도하고
//   뷰포트 상한을 뒀다(아래 SCATTER_DISTANCE_* 주석).
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react';
import type { QualityTier } from '@/lib/deviceQuality';

export interface ParticleTextHandle {
  play: () => void;
}

export type ParticleTextTier = Extract<QualityTier, 'high' | 'medium'>;

interface ParticleTextProps {
  // 폰트·크기·자간·색과 위치를 읽어올 실제 DOM 워드마크 버튼.
  wordmarkRef: RefObject<HTMLElement | null>;
  tier: ParticleTextTier;
  durationMs: number;
  // 이음매 완화(파티클 이음매 브리프) — 형성 마지막 seamMs 동안 캔버스
  // 요소가 흐려지며 페이드아웃한다. BootSequence가 자신의 SEAM_OVERLAP_MS
  // (단일 출처, 상한 150ms)를 그대로 내려준다. 기본값 0 — 넘기지 않으면
  // 기존처럼 형성 완료 시 한 프레임 하드 스왑이다(회귀 없음).
  seamMs?: number;
}

interface TierConfig {
  maxParticles: number;
  sampleStep: number;
  dprCap: number;
  scatterPx: number;
}

// 모바일(medium)에서도 파티클을 돌리기로 한 근거와 각 수치의 출처는
// particle-name-report.md 참고. high는 여유가 있는 기기(레티나 데스크톱 등)
// 기준, medium은 실측 기준 기기(고밀도 터치 — deviceQuality.ts 주석의
// Galaxy S25급)를 겨눈 보수적인 값이다.
// scatterPx는 파티클 잔소음 브리프 2절에서 약 40% 넓혔다(64→90, 40→56).
// "조금 더 넓게 퍼져있다가 뭉쳤으면" 요청에 대한 값이다. 파티클 수는 그대로
// 두고 여백만 아래 SCATTER_DISTANCE_* 공식으로 함께 유도한다(잘림 방지).
const TIER_CONFIG: Record<ParticleTextTier, TierConfig> = {
  high: { maxParticles: 480, sampleStep: 2, dprCap: 1.5, scatterPx: 90 },
  medium: { maxParticles: 220, sampleStep: 4, dprCap: 1, scatterPx: 56 },
};

interface Particle {
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  delay: number;
}

// 파티클 반지름 — sampleStep(이웃 간격)에 비례시킨다(파티클 이음매 브리프).
// 고정 반지름(예전 1.6px)은 medium(간격 4px)에서 지름(3.2px)이 간격보다
// 작아 점 사이가 벌어졌다 — "점으로 근사한 글자"와 "안티앨리어싱된 실제
// 글자"가 애초에 다른 그림이라 뭉친 순간 툭 끊겨 보였다. 지름을 간격의
// DIAMETER_TO_STEP_RATIO배로 잡으면 이웃과 겹쳐 면이 찬다(1.3~1.5 권장 —
// 이 값은 그 중간).
const DIAMETER_TO_STEP_RATIO = 1.4;
// 수렴 시작 시점의 반지름 비율 — 이미 계산돼 있는 eased(수렴 진행도)를
// 그대로 재사용해 작게 시작해 최종 반지름까지 커진다. 처음부터 최대
// 크기면 "조각이 모여 덩어리가 된다"는 수렴 과정 자체가 안 보인다.
const START_RADIUS_RATIO = 0.4;
// 형성 마지막(seamMs) 동안 캔버스 요소에 거는 최대 흐림 — 값이 크면 글자
// 형태 자체가 뭉개진다.
const SEAM_BLUR_PX = 3;
const ALPHA_THRESHOLD = 60;
// 산포 거리 공식(아래 particlesRef.current 계산부)의 두 계수다. distance =
// scatterPx * (BASE + seed * RANGE), 최댓값은 seed→1일 때 BASE + RANGE다.
// 캔버스 여백(아래 margin)을 이 최댓값으로 유도한다. 두 곳이 각자 다른
// 숫자를 들고 있으면 scatterPx를 넓힐 때마다 다시 어긋난다(파티클 잔소음
// 브리프 2절, 예전엔 margin = scatterPx + 상수라 여유가 2px도 안 됐다).
const SCATTER_DISTANCE_BASE_FACTOR = 0.4;
const SCATTER_DISTANCE_RANGE_FACTOR = 0.8;

const ParticleText = forwardRef<ParticleTextHandle, ParticleTextProps>(
  function ParticleText({ wordmarkRef, tier, durationMs, seamMs = 0 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const particlesRef = useRef<Particle[] | null>(null);
    const colorRef = useRef('#eef4f5');
    const boxRef = useRef<{ width: number; height: number } | null>(null);
    const rafRef = useRef<number | null>(null);
    // 파티클의 최종(수렴 완료) 반지름 — tier의 sampleStep에서 마운트 시
    // 1회 계산해 둔다(위 DIAMETER_TO_STEP_RATIO).
    const targetRadiusRef = useRef(0);

    // 글리프를 마운트 시 1회만 샘플링한다(위 주석 — 매 프레임 getImageData를
    // 부르지 않는다). useLayoutEffect다. 부모(BootSequence)가 tier로
    // 게이트를 연 뒤에야 이 컴포넌트를 마운트하므로, 같은 커밋 안에서
    // 자식인 이 effect가 부모의 타임라인 생성 effect(같은 layout effect
    // 종류)보다 먼저 돈다. 여기가 passive useEffect였다면 부모가 t=0에
    // particleRef.current.play()를 부르는 시점에 particlesRef.current가
    // 아직 null일 수 있었다. 두 번째 경합이다(particle-race-brief.md
    // (다)).
    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      const buttonEl = wordmarkRef.current;
      if (!canvas || !buttonEl) return;

      // 실제로 페인트되는 텍스트 노드(span)에서 폰트 값을 읽는다 — 버튼
      // 자신은 폰트 크기·자간을 지정하지 않는 경우가 있어(이 값들은 자식
      // span의 클래스가 소유한다) 버튼 자신의 computed style로는 잘못된
      // 값을 읽을 수 있다. span이 없으면(테스트 하네스처럼 버튼에 텍스트가
      // 직접 있는 경우) 버튼 자신으로 안전하게 폴백한다.
      const source = buttonEl.querySelector('span') ?? buttonEl;
      const rect = source.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const config = TIER_CONFIG[tier];
      const targetRadius = (config.sampleStep * DIAMETER_TO_STEP_RATIO) / 2;
      targetRadiusRef.current = targetRadius;

      // 여백. 최대 산포 거리(위 SCATTER_DISTANCE_* 공식의 최댓값, distance
      // 계산과 정확히 같은 값)에 파티클 반지름을 더해서 유도한다. 파티클이
      // 궤적 어디에 있든 "목표에서 먼 지점일수록 반지름이 작다"(아래 play()의
      // eased 보간)라 이 합이 실제로 필요한 것보다 넉넉하다. 안전 쪽으로
      // 여유를 둔 상한이다.
      const maxScatterDistance =
        config.scatterPx * (SCATTER_DISTANCE_BASE_FACTOR + SCATTER_DISTANCE_RANGE_FACTOR);
      const desiredMargin = maxScatterDistance + targetRadius;
      // 캔버스가 뷰포트를 넘지 않게 상한을 둔다. 좁은 화면에서 이름 rect가
      // 이미 뷰포트에 가까우면 이 여백을 더한 캔버스가 뷰포트 밖으로 크게
      // 삐져나가 보이지도 않는 영역을 그리느라 낭비한다. 뷰포트와 rect 사이의
      // 여유(폭·높이 각각)의 절반을 넘지 않게 자른다.
      const maxMarginX = Math.max(0, (window.innerWidth - rect.width) / 2);
      const maxMarginY = Math.max(0, (window.innerHeight - rect.height) / 2);
      const margin = Math.min(desiredMargin, maxMarginX, maxMarginY);
      const boxLeft = rect.left - margin;
      const boxTop = rect.top - margin;
      const boxWidth = rect.width + margin * 2;
      const boxHeight = rect.height + margin * 2;
      boxRef.current = { width: boxWidth, height: boxHeight };

      const dpr = Math.min(window.devicePixelRatio || 1, config.dprCap);
      canvas.style.left = `${boxLeft}px`;
      canvas.style.top = `${boxTop}px`;
      canvas.style.width = `${boxWidth}px`;
      canvas.style.height = `${boxHeight}px`;
      canvas.width = Math.max(1, Math.round(boxWidth * dpr));
      canvas.height = Math.max(1, Math.round(boxHeight * dpr));

      const ctx = canvas.getContext('2d');
      if (!ctx) return; // 캔버스 미지원 — 조용히 포기한다. DOM 워드마크의
      // opacity 트윈은 BootSequence 타임라인에서 이 컴포넌트와 무관하게
      // 독립적으로 진행되므로, 여기서 포기해도 "이름이 안 보이는" 사고로
      // 이어지지 않는다.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;

      const computed = window.getComputedStyle(source);
      colorRef.current = computed.color;
      const font = `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
      const letterSpacingPx = Number.parseFloat(computed.letterSpacing) || 0;
      const text = source.textContent ?? '';

      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.ceil(rect.width));
      off.height = Math.max(1, Math.ceil(rect.height));
      const offCtxRaw = off.getContext('2d', { willReadFrequently: true });
      if (!offCtxRaw) return;
      // letterSpacing은 최신 Canvas2D 명세의 프로퍼티라 lib.dom.d.ts에 아직
      // 없다 — 캐스팅한 참조 하나로 이 블록 전체를 다룬다(offCtx를 직접
      // 'in'으로 좁히면 TS가 else 분기에서 타입을 never로 좁혀버린다).
      const offCtx = offCtxRaw as CanvasRenderingContext2D & {
        letterSpacing?: string;
      };

      offCtx.font = font;
      offCtx.textBaseline = 'alphabetic';
      offCtx.fillStyle = '#fff';

      const supportsLetterSpacing = typeof offCtx.letterSpacing === 'string';
      if (supportsLetterSpacing) {
        offCtx.letterSpacing = computed.letterSpacing;
      }

      const metrics = offCtx.measureText(text);
      const fontSizePx = Number.parseFloat(computed.fontSize) || off.height;
      // fontBoundingBox* — 폰트 자체의 메트릭 박스(브라우저가 줄 상자 안에
      // 텍스트를 앉히는 기준). actualBoundingBox*(잉크 박스)를 썼던 예전
      // 코드는 KIM TAEIN처럼 디센더 없는 대문자에서 descent가 합법적으로
      // 정확히 0이 되는 경우가 있어, 그 뒤의 `||` 폴백이 오작동해(0을 "값이
      // 없다"로 오인) descent를 24px로 부풀렸다 — 이것이 Y 점프의 진짜 원인
      // (세 이음매 후속 브리프). fontBoundingBox*는 실제 폰트라면 결코 0이
      // 될 수 없으므로(글꼴에 ascent/descent가 없을 수 없다) 같은 `||`가
      // 여기서는 안전하다 — 아래 폴백은 fontBoundingBox* 자체가 없는 환경
      // (jsdom) 전용이다.
      const fontAscent = metrics.fontBoundingBoxAscent || fontSizePx * 0.95;
      const fontDescent = metrics.fontBoundingBoxDescent || fontSizePx * 0.25;

      // 베이스라인 — 브라우저가 줄 상자에 베이스라인을 앉히는 공식을 그대로
      // 재현한다(세 이음매 후속 브리프). CSS 인라인 레이아웃에서 콘텐츠
      // 영역 높이는 폰트 메트릭 ascent+descent이고, half-leading =
      // (line-height − 그 높이) / 2, 베이스라인은 줄 상자 top에서 half-leading
      // + ascent다. source(span)가 inline이면 off.height(= rect.height)가 곧
      // ascent+descent라 이 식이 fontAscent로 자연히 수렴하고, block/
      // inline-block이면 line-height가 들어와 half-leading이 살아난다 — 두
      // 경우 모두 이 한 식으로 맞는다.
      const baselineY = (off.height - (fontAscent + fontDescent)) / 2 + fontAscent;

      if (supportsLetterSpacing) {
        offCtx.fillText(text, 0, baselineY);
      } else {
        // letterSpacing 미지원 브라우저 대비 — 글자를 하나씩 수동으로
        // 이어붙여 CSS letter-spacing과 같은 자간을 흉내낸다.
        let cursor = 0;
        for (const ch of text) {
          offCtx.fillText(ch, cursor, baselineY);
          cursor += offCtx.measureText(ch).width + letterSpacingPx;
        }
      }

      let imageData: ImageData;
      try {
        imageData = offCtx.getImageData(0, 0, off.width, off.height);
      } catch {
        return; // 캔버스 오염 등 — 여기서도 DOM opacity는 독립적으로 계속된다.
      }

      // 파티클 수 상한(위 TIER_CONFIG) — 96px 이름을 촘촘한 간격으로 뜨면
      // 수천 개가 나온다. sampleStep으로 후보를 성기게 고른 뒤, 그래도
      // 상한을 넘으면 stride로 한 번 더 골라낸다.
      const step = config.sampleStep;
      const candidates: { x: number; y: number }[] = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          const alpha = imageData.data[(y * off.width + x) * 4 + 3];
          if (alpha > ALPHA_THRESHOLD) candidates.push({ x, y });
        }
      }

      const stride = Math.max(1, Math.ceil(candidates.length / config.maxParticles));
      const targets = candidates.filter((_, i) => i % stride === 0);

      particlesRef.current = targets.map((t, i) => {
        const seed = ((i * 9301 + 49297) % 233280) / 233280;
        const angle = seed * Math.PI * 2;
        const distance =
          config.scatterPx * (SCATTER_DISTANCE_BASE_FACTOR + seed * SCATTER_DISTANCE_RANGE_FACTOR);
        const targetX = t.x + margin;
        const targetY = t.y + margin;
        return {
          targetX,
          targetY,
          startX: targetX + Math.cos(angle) * distance,
          startY: targetY + Math.sin(angle) * distance,
          // 파티클마다 출발을 살짝 늦춰(최대 durationMs의 25%) 한꺼번에
          // 같은 속도로 몰려오지 않고 흩어진 조각이 저마다 뭉치는 리듬을 준다.
          delay: seed * durationMs * 0.25,
        };
      });
    }, [wordmarkRef, tier, durationMs]);

    useImperativeHandle(
      ref,
      () => ({
        play() {
          const ctx = ctxRef.current;
          const canvas = canvasRef.current;
          const particles = particlesRef.current;
          const box = boxRef.current;
          if (!ctx || !canvas || !particles || !box || particles.length === 0) return;
          if (rafRef.current !== null) return; // 1회성 계약 — 재생 중 재호출은 무시한다.

          const start = performance.now();
          const color = colorRef.current;
          // 이음매 완화. 형성 마지막 seamMs 동안 캔버스가 흐려지며
          // 페이드아웃한다. BootSequence의 wordmarkEl 페이드인이 같은
          // [seamStart, durationMs] 창에서 겹친다("아주 짧은 교차").
          // seamMs<=0이면(기본값) 기존과 같은 한 프레임 하드 스왑이다.
          //
          // 파티클 잔소음 브리프 1절. 예전엔 이 구간 매 프레임 canvas.style.
          // filter를 새 값으로 다시 쓰고 수백 개 arc()도 계속 그렸다. 진입
          // 시점(seamStart)이면 가장 늦게 출발한 파티클도 이미 eased 기준
          // 99% 이상 수렴해 있어(durationMs·delay 계산상 상한), 남은 각
          // 프레임의 위치·반지름 차이는 1px에도 못 미친다(계산 근거는
          // 리포트 참고). 그 미세한 차이를 매 프레임 다시 그리는 대신, 이
          // 프레임에서 목표 위치·최종 반지름으로 한 번만 그리고 rAF를
          // 멈춘 뒤, 사라지는 연출은 CSS transition에 맡긴다. 캔버스
          // 내용이 더 이상 안 바뀌므로 브라우저가 블러 결과를 캐시할 수
          // 있고 opacity는 합성만으로 처리된다.
          const seamStart = seamMs > 0 ? Math.max(0, durationMs - seamMs) : durationMs;

          const frame = (now: number) => {
            const elapsed = now - start;

            if (seamMs > 0 && elapsed >= seamStart) {
              const targetRadius = targetRadiusRef.current;
              ctx.clearRect(0, 0, box.width, box.height);
              ctx.fillStyle = color;
              for (const p of particles) {
                ctx.beginPath();
                ctx.arc(p.targetX, p.targetY, targetRadius, 0, Math.PI * 2);
                ctx.fill();
              }

              rafRef.current = null;
              // linear. 예전 per-frame 갱신이 elapsed에 정비례해 선형으로
              // 움직였다(easing 없음). 같은 곡선을 CSS transition으로 옮겨
              // 시각 결과를 그대로 유지한다.
              canvas.style.transition = `opacity ${seamMs}ms linear, filter ${seamMs}ms linear`;
              canvas.style.opacity = '0';
              canvas.style.filter = `blur(${SEAM_BLUR_PX}px)`;
              return;
            }

            if (elapsed >= durationMs) {
              // 형성 완료(seamMs<=0 경로). 캔버스를 비운 채로 rAF를 더
              // 이상 예약하지 않는다.
              rafRef.current = null;
              ctx.clearRect(0, 0, box.width, box.height);
              return;
            }

            ctx.clearRect(0, 0, box.width, box.height);
            ctx.fillStyle = color;
            const targetRadius = targetRadiusRef.current;
            for (const p of particles) {
              const span = Math.max(1, durationMs - p.delay);
              const local = Math.min(1, Math.max(0, (elapsed - p.delay) / span));
              const eased = 1 - Math.pow(1 - local, 3);
              const x = p.startX + (p.targetX - p.startX) * eased;
              const y = p.startY + (p.targetY - p.startY) * eased;
              // 반지름도 eased를 따라 커진다(파티클 이음매 브리프 (가)) —
              // 작은 조각으로 출발해 수렴할수록 최종 반지름까지 자란다.
              const radius = targetRadius * (START_RADIUS_RATIO + (1 - START_RADIUS_RATIO) * eased);
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fill();
            }

            rafRef.current = requestAnimationFrame(frame);
          };

          rafRef.current = requestAnimationFrame(frame);
        },
      }),
      [durationMs, seamMs]
    );

    useEffect(
      () => () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      },
      []
    );

    return (
      <canvas
        ref={canvasRef}
        data-testid="particle-name-canvas"
        aria-hidden="true"
        className="fixed z-40 pointer-events-none"
      />
    );
  }
);

export default ParticleText;
