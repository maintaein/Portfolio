'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EyeIcon, CursorArrowRaysIcon, HandRaisedIcon } from '@heroicons/react/24/outline';

export interface OrbitProps {
  // WhenVisible 렌더 프롭에서 그대로 받는다. paused가 켜지면 궤도 tween을
  // 하나도 만들지 않는다. shouldLoad가 켜져야 GSAP 런타임을 처음 불러온다.
  paused?: boolean;
  shouldLoad?: boolean;
  // Cubes와 같은 이름의 prop이다(components/blocks/Cubes/index.tsx). 비주얼
  // 자리가 이미 자기 폭을 갖고 있어(50/50 분할) 그 안에서는 폭을 부모에
  // 맡겨야 한다.
  wrapperClassName?: string;
}

// GSAP 런타임의 값 타입만 가져온다. import 문 없이 순수 타입 조회라 런타임
// 비용이 0이다. 실제 값은 아래 effect의 동적 import()로만 얻는다("GSAP
// 지연 로딩. import type만 정적" 규칙).
type GsapInstance = typeof import('@/lib/gsap').gsap;
type GsapTween = { kill: () => void };

// 계획 문서 "코드에서 읽은 값" 표. 포크 원본(.claude/designRefactoring/Orbit/
// OrbitImages.tsx) :154-156. radiusX:radiusY = 700:170 = 4.1:1, baseWidth
// 1400이 중심(700,700)을 잡는다.
const DESKTOP = { baseWidth: 1400, radiusX: 700, radiusY: 170, itemSize: 64 };

// 모바일은 2.5:1로 완화한다. 4.1:1을 그대로 쓰면 327px 컨테이너에서 링
// 세로가 80px뿐이라, 읽히는 크기의 아이콘이 링 높이의 절반을 차지해 뭉쳐
// 보인다(계획 문서 "모바일" 절). 327×131px 링, 아이콘 30px(링 높이의 23%)이
// 나오는 값이다.
const MOBILE = { baseWidth: 600, radiusX: 300, radiusY: 120, itemSize: 56 };

// Cubes와 같은 lg 전환점(1024px). components/blocks/Navigation/index.tsx의
// centerCompactItem과도 같은 값을 쓴다.
const MOBILE_QUERY = '(max-width: 1023px)';

// 포크 원본 :160. 링만 기울고 아이콘은 반대로 되돌려 항상 똑바로 선다.
const ROTATION = -8;
// 흐린 보조 링의 기울기. primary와 6deg 벌려 동심원이되 겹쳐 보이지
// 않는다("기울기가 살짝 다른 흐린 링을 하나 더 동심으로").
const SECONDARY_ROTATION = -14;
// 포크 원본 :161. 40초에 한 바퀴, 등속(linear).
const DURATION = 40;

// EmpathyRadar:31-38의 Heroicons 8개 중 셋만 남긴다. Heart·Star·Smile·
// LightBulb·CheckCircle은 분위기일 뿐 "사용자의 눈과 마음으로"의 증거가
// 아니다. Eye(관점)·CursorArrowRays(인터랙션)·HandRaised(접근성) 셋만
// 남긴다.
const ICONS = [EyeIcon, CursorArrowRaysIcon, HandRaisedIcon];

function generateEllipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const Orbit: React.FC<OrbitProps> = ({
  paused = false,
  shouldLoad = false,
  wrapperClassName = 'h-full w-full',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemElsRef = useRef<Array<HTMLDivElement | null>>([]);
  const gsapRef = useRef<GsapInstance | null>(null);
  const tweensRef = useRef<GsapTween[]>([]);
  const [gsapReady, setGsapReady] = useState(false);
  const [scale, setScale] = useState<number | null>(null);

  // Orbit은 dynamic({ ssr: false })로만 마운트되므로 최초 렌더부터 항상
  // 클라이언트다. lazy state 초기값으로 한 번만 읽는다(Navigation·Cubes와
  // 같은 관례다. 실시간 리사이즈 구독은 하지 않는다).
  const [isMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const config = isMobile ? MOBILE : DESKTOP;
  const path = generateEllipsePath(
    config.baseWidth / 2,
    config.baseWidth / 2,
    config.radiusX,
    config.radiusY
  );

  // 포크 원본의 responsive 스케일링(:209-219)을 그대로 옮긴다. 컨테이너의
  // 실제 렌더 폭을 재서 baseWidth 기준 디자인을 그 비율로 축소한다.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const updateScale = () => {
      if (!containerRef.current) return;
      setScale(containerRef.current.clientWidth / config.baseWidth);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [config.baseWidth]);

  // shouldLoad가 열릴 때만 GSAP 런타임을 동적으로 불러온다. Cubes와 같은
  // 패턴이다(components/blocks/Cubes/index.tsx 참고).
  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    import('@/lib/gsap').then(({ gsap, registerGsap }) => {
      if (cancelled) return;
      registerGsap();
      gsapRef.current = gsap;
      setGsapReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [shouldLoad]);

  // 궤도 tween 셋(아이콘당 하나). MotionPathPlugin의 motionPath로 타원
  // 경로를 따라 이동시키고, 같은 tween의 onUpdate에서 그 프레임의 경로상
  // 위치(sin θ)로 scale·opacity·zIndex를 매 프레임 다시 계산한다. 이
  // 셋이 "납작해 보이는 진짜 원인" 중 크기·가림 문제를 없앤다. paused면
  // tween을 아예 만들지 않고, 만들어져 있던 것은 클린업에서 kill한다.
  useEffect(() => {
    const gsap = gsapRef.current;
    if (!gsapReady || !gsap || paused) return;

    const items = itemElsRef.current;
    const total = items.length;

    const tweens = items.reduce<GsapTween[]>((acc, el, index) => {
      if (!el) return acc;
      // fill=true와 같은 등간격 배치. 3개 → 0 / 33.3 / 66.7% = 120° 간격.
      const phase = index / total;
      // 경로 좌표계 위에 아이콘 중심을 맞춘다(원본의 offsetAnchor: 'center
      // center'와 같은 역할). motionPath는 x/y만 옮기므로 -50%는 별도로
      // 고정해 둔다.
      gsap.set(el, { xPercent: -50, yPercent: -50 });

      const tween = gsap.to(el, {
        motionPath: {
          path,
          start: phase,
          end: phase + 1,
          autoRotate: false,
        },
        duration: DURATION,
        ease: 'none',
        repeat: -1,
        onUpdate(this: { progress: () => number }) {
          const localProgress = this.progress();
          const frac = (((phase + localProgress) % 1) + 1) % 1;
          const theta = frac * Math.PI * 2;
          const sinTheta = Math.sin(theta);
          const proximity = (sinTheta + 1) / 2;
          gsap.set(el, {
            scale: lerp(0.55, 1.2, proximity),
            opacity: lerp(0.35, 1, proximity),
            // 가까운(타원 하단) 아이콘은 링 선(zIndex 10)을 덮고, 먼
            // 아이콘은 링 선에 잘린다.
            zIndex: sinTheta > 0 ? 20 : 5,
          });
        },
      });
      acc.push(tween);
      return acc;
    }, []);

    tweensRef.current = tweens;

    return () => {
      tweensRef.current.forEach((tween) => tween.kill());
      tweensRef.current = [];
    };
  }, [gsapReady, paused, path]);

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto aspect-square ${wrapperClassName}`}
      // 궤도는 순전히 장식이다. "Flat ↔ Compound"와 설명 문단이 이미 이
      // 상세의 증거를 텍스트로 낸다. 아이콘 셋(눈·커서·손)은 그 증거를
      // 대신하는 고유명사가 아니라 은유일 뿐이라 sr-only 목록이 필요
      // 없다(Cubes의 기술 스택 15개와 다른 지점이다. 그건 대체 불가능한
      // 고유명사였다).
      aria-hidden="true"
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: config.baseWidth,
          height: config.baseWidth,
          transform: scale !== null ? `translate(-50%, -50%) scale(${scale})` : undefined,
          visibility: scale === null ? 'hidden' : undefined,
          transformOrigin: 'center center',
        }}
      >
        {/* 보조 링. 기울기만 살짝 다른 흐린 동심원. 움직이지 않는 배경
            장식이라 tween 대상이 아니다. */}
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${config.baseWidth} ${config.baseWidth}`}
          className="pointer-events-none absolute inset-0"
          style={{ transform: `rotate(${SECONDARY_ROTATION}deg)`, transformOrigin: 'center center' }}
        >
          <path d={path} fill="none" stroke="var(--color-elevation-far)" strokeWidth={1} />
        </svg>

        <div
          className="relative h-full w-full"
          style={{ transform: `rotate(${ROTATION}deg)`, transformOrigin: 'center center' }}
        >
          {/* 원인 1 수정: 링 선을 실제로 그린다. 원본은 showPath=false였고
              색도 검정 배경에서 안 보이는 rgba(0,0,0,0.1)이었다. 시안
              헤어라인, 1px. zIndex를 아이템의 5/20 사이(10)에 둬 근경
              아이콘은 이 선을 덮고 원경 아이콘은 이 선에 잘리게 한다
              (원인 2 수정). */}
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${config.baseWidth} ${config.baseWidth}`}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 10 }}
          >
            <path d={path} fill="none" stroke="var(--color-hairline)" strokeWidth={1} />
          </svg>

          {ICONS.map((Icon, index) => (
            <div
              key={index}
              ref={(el) => {
                itemElsRef.current[index] = el;
              }}
              data-orbit-item={index}
              className="absolute top-0 left-0 will-change-transform"
              style={{ width: config.itemSize, height: config.itemSize }}
            >
              {/* 링(부모)만 기울고 아이콘은 반대로 되돌려 항상 똑바로 선다. */}
              <div style={{ transform: `rotate(${-ROTATION}deg)` }}>
                <Icon className="h-full w-full text-[var(--color-cyan-hi)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Orbit;
