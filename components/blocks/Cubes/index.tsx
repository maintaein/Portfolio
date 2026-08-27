'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { techStack } from '@/lib/data';

interface Gap {
  row: number;
  col: number;
}
interface Duration {
  enter: number;
  leave: number;
}

export interface CubesProps {
  // WhenVisible 렌더 프롭에서 그대로 받는다. paused가 켜지면 idle 루프의
  // rAF를 걸지 않는다. shouldLoad가 켜져야 GSAP 런타임을 처음 불러온다.
  paused?: boolean;
  shouldLoad?: boolean;
  gridSize?: number;
  cubeSize?: number;
  maxAngle?: number;
  radius?: number;
  easing?: string;
  duration?: Duration;
  cellGap?: number | Gap;
  borderStyle?: string;
  faceColor?: string;
  autoAnimate?: boolean;
  rippleOnClick?: boolean;
  rippleColor?: string;
  rippleSpeed?: number;
  // 포크 시 수정 6. 원본은 래퍼 폭이 'w-1/2 max-md:w-11/12'로 고정돼 있었다.
  // AboutSection의 비주얼 자리는 이미 자기 폭을 갖고 있어(50/50 분할) 그
  // 안에서는 폭을 부모에 맡겨야 한다. 기본값은 원본 값을 그대로 둔다.
  wrapperClassName?: string;
}

// GSAP 런타임의 값 타입만 가져온다. import 문 없이 순수 타입 조회라 런타임
// 비용이 0이다. 실제 값은 아래 effect의 동적 import()로만 얻는다("GSAP
// 지연 로딩. import type만 정적" 규칙).
type GsapInstance = typeof import('@/lib/gsap').gsap;

// 모바일에서는 정지 격자로 간다. 큐브 16개 × 면 6개 = preserve-3d 레이어
// 후보 96개가 Hyperspeed의 WebGL 프레임버퍼와 GPU 메모리를 다툰다. 아이콘은
// 전부 정면 페이스에 있어 idle 시뮬레이션을 꺼도 정보 손실이 없다. lg
// 전환점(1024px)과 같은 값을 쓴다(components/blocks/Navigation/index.tsx의
// centerCompactItem과 동일한 브레이크포인트).
const MOBILE_QUERY = '(max-width: 1023px)';

const Cubes: React.FC<CubesProps> = ({
  paused = false,
  shouldLoad = false,
  gridSize = 10,
  cubeSize,
  maxAngle = 45,
  radius = 3,
  easing = 'power3.out',
  duration = { enter: 0.3, leave: 0.6 },
  cellGap,
  // 포크 시 수정 3. 흰 테두리는 라이트 테마 잔재다. 시안 헤어라인으로.
  borderStyle = '1px solid rgb(3 179 195 / 0.35)',
  // 포크 시 수정 2. '#120F17'은 보라 기운이 도는 색이라 다크 단일 테마의
  // 유일한 강조색(시안) 원칙과 어긋난다. 순검정으로.
  faceColor = '#000000',
  // 원본의 shadow prop(box-shadow)은 옮기지 않았다. Global Constraints가
  // "고도는 테두리 밝기로. box-shadow는 검정 배경에서 안 보인다"고 이미
  // 못박아 뒀고, 기본값이 false라 실제로 쓰인 적도 없다.
  autoAnimate = true,
  rippleOnClick = true,
  // 포크 시 수정 4. 흰 리플은 아이콘 페이스까지 하얗게 세탁했다. 시안으로
  // 바꾸고, 아이콘이 있는 정면 페이스는 아예 리플 대상에서 뺀다(아래 onClick).
  rippleColor = '#03b3c3',
  rippleSpeed = 2,
  wrapperClassName = 'w-1/2 max-md:w-11/12',
}) => {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const cubeElsRef = useRef<HTMLDivElement[]>([]);
  const gsapRef = useRef<GsapInstance | null>(null);
  const [gsapReady, setGsapReady] = useState(false);
  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userActiveRef = useRef(false);
  const simPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const simTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const simRAFRef = useRef<number | null>(null);

  const colGap =
    typeof cellGap === 'number'
      ? `${cellGap}px`
      : (cellGap as Gap)?.col !== undefined
        ? `${(cellGap as Gap).col}px`
        : '5%';
  const rowGap =
    typeof cellGap === 'number'
      ? `${cellGap}px`
      : (cellGap as Gap)?.row !== undefined
        ? `${(cellGap as Gap).row}px`
        : '5%';

  const enterDur = duration.enter;
  const leaveDur = duration.leave;

  // 포크 시 수정 5. 원본 tiltAt은 프레임마다(idle 루프 + 포인터 이동)
  // querySelectorAll('.cube')를 새로 돌렸다. 큐브는 마운트 뒤 늘거나 줄지
  // 않으므로 한 번만 모아 캐시하고, 이후 tiltAt·resetAll·리플은 이 배열만
  // 순회한다.
  useEffect(() => {
    if (!sceneRef.current) return;
    cubeElsRef.current = Array.from(
      sceneRef.current.querySelectorAll<HTMLDivElement>('.cube')
    );
  }, [gridSize]);

  const tiltAt = useCallback(
    (rowCenter: number, colCenter: number) => {
      const gsap = gsapRef.current;
      if (!gsap) return;
      cubeElsRef.current.forEach(cube => {
        const r = +cube.dataset.row!;
        const c = +cube.dataset.col!;
        const dist = Math.hypot(r - rowCenter, c - colCenter);
        if (dist <= radius) {
          const pct = 1 - dist / radius;
          const angle = pct * maxAngle;
          gsap.to(cube, {
            duration: enterDur,
            ease: easing,
            overwrite: true,
            rotateX: -angle,
            rotateY: angle
          });
        } else {
          gsap.to(cube, {
            duration: leaveDur,
            ease: 'power3.out',
            overwrite: true,
            rotateX: 0,
            rotateY: 0
          });
        }
      });
    },
    [radius, maxAngle, enterDur, leaveDur, easing]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      userActiveRef.current = true;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      const rect = sceneRef.current!.getBoundingClientRect();
      const cellW = rect.width / gridSize;
      const cellH = rect.height / gridSize;
      const colCenter = (e.clientX - rect.left) / cellW;
      const rowCenter = (e.clientY - rect.top) / cellH;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => tiltAt(rowCenter, colCenter));

      idleTimerRef.current = setTimeout(() => {
        userActiveRef.current = false;
      }, 3000);
    },
    [gridSize, tiltAt]
  );

  const resetAll = useCallback(() => {
    const gsap = gsapRef.current;
    if (!gsap) return;
    cubeElsRef.current.forEach(cube =>
      gsap.to(cube, {
        duration: leaveDur,
        rotateX: 0,
        rotateY: 0,
        ease: 'power3.out'
      })
    );
  }, [leaveDur]);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      userActiveRef.current = true;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      const rect = sceneRef.current!.getBoundingClientRect();
      const cellW = rect.width / gridSize;
      const cellH = rect.height / gridSize;

      const touch = e.touches[0];
      const colCenter = (touch.clientX - rect.left) / cellW;
      const rowCenter = (touch.clientY - rect.top) / cellH;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => tiltAt(rowCenter, colCenter));

      idleTimerRef.current = setTimeout(() => {
        userActiveRef.current = false;
      }, 3000);
    },
    [gridSize, tiltAt]
  );

  const onTouchStart = useCallback(() => {
    userActiveRef.current = true;
  }, []);

  const onTouchEnd = useCallback(() => {
    resetAll();
  }, [resetAll]);

  const onClick = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const gsap = gsapRef.current;
      if (!rippleOnClick || !gsap || !sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const cellW = rect.width / gridSize;
      const cellH = rect.height / gridSize;

      const clientX = (e as MouseEvent).clientX || ((e as TouchEvent).touches && (e as TouchEvent).touches[0].clientX);
      const clientY = (e as MouseEvent).clientY || ((e as TouchEvent).touches && (e as TouchEvent).touches[0].clientY);

      const colHit = Math.floor((clientX - rect.left) / cellW);
      const rowHit = Math.floor((clientY - rect.top) / cellH);

      const baseRingDelay = 0.15;
      const baseAnimDur = 0.3;
      const baseHold = 0.6;

      const spreadDelay = baseRingDelay / rippleSpeed;
      const animDuration = baseAnimDur / rippleSpeed;
      const holdTime = baseHold / rippleSpeed;

      const rings: Record<number, HTMLDivElement[]> = {};
      cubeElsRef.current.forEach(cube => {
        const r = +cube.dataset.row!;
        const c = +cube.dataset.col!;
        const dist = Math.hypot(r - rowHit, c - colHit);
        const ring = Math.round(dist);
        if (!rings[ring]) rings[ring] = [];
        rings[ring].push(cube);
      });

      Object.keys(rings)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(ring => {
          const delay = ring * spreadDelay;
          // 아이콘이 있는 정면 페이스(data-icon-face)는 리플 색 트윈
          // 대상에서 뺀다. 그대로 두면 리플이 지나갈 때마다 아이콘이 잠깐
          // 색으로 덮여 세탁된 것처럼 보인다.
          const faces = rings[ring].flatMap(cube =>
            Array.from(cube.querySelectorAll<HTMLElement>('.cube-face')).filter(
              face => face.dataset.iconFace !== 'true'
            )
          );

          gsap.to(faces, {
            backgroundColor: rippleColor,
            duration: animDuration,
            delay,
            ease: 'power3.out'
          });
          gsap.to(faces, {
            backgroundColor: faceColor,
            duration: animDuration,
            delay: delay + animDuration + holdTime,
            ease: 'power3.out'
          });
        });
    },
    [rippleOnClick, gridSize, faceColor, rippleColor, rippleSpeed]
  );

  // shouldLoad가 열릴 때만 GSAP 런타임을 동적으로 불러온다. About 섹션이
  // 아니거나, 01 상세가 선택되지 않았거나, motion preference가 아직 준비
  // 전이거나, reduced-motion이면 WhenVisible이 shouldLoad를 계속 false로
  // 준다. 한 번 true가 된 뒤로는(선택 유지) 이 effect가 다시 돌지 않으므로
  // 재방문 때 새 import가 일어나지 않고 이미 불러온 gsap 인스턴스를 그대로
  // 쓴다.
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

  // 정지 격자의 유일한 자발적 움직임이다. 아무도 건드리지 않을 때 큐브가 스스로
  // 살짝 기울었다 돌아오는 idle 시뮬레이션. paused면 rAF를 걸지 않고(예약된
  // 프레임은 클린업에서 취소), 모바일 뷰포트에서도 걸지 않는다.
  useEffect(() => {
    if (!gsapReady || paused || !autoAnimate) return;
    if (typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches) return;

    simPosRef.current = {
      x: Math.random() * gridSize,
      y: Math.random() * gridSize
    };
    simTargetRef.current = {
      x: Math.random() * gridSize,
      y: Math.random() * gridSize
    };
    const speed = 0.02;
    const loop = () => {
      if (!userActiveRef.current) {
        const pos = simPosRef.current;
        const tgt = simTargetRef.current;
        pos.x += (tgt.x - pos.x) * speed;
        pos.y += (tgt.y - pos.y) * speed;
        tiltAt(pos.y, pos.x);
        if (Math.hypot(pos.x - tgt.x, pos.y - tgt.y) < 0.1) {
          simTargetRef.current = {
            x: Math.random() * gridSize,
            y: Math.random() * gridSize
          };
        }
      }
      simRAFRef.current = requestAnimationFrame(loop);
    };
    simRAFRef.current = requestAnimationFrame(loop);
    return () => {
      if (simRAFRef.current != null) cancelAnimationFrame(simRAFRef.current);
    };
  }, [gsapReady, paused, autoAnimate, gridSize, tiltAt]);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', resetAll);
    el.addEventListener('click', onClick);

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', resetAll);
      el.removeEventListener('click', onClick);

      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);

      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [onPointerMove, resetAll, onClick, onTouchMove, onTouchStart, onTouchEnd]);

  const cells = Array.from({ length: gridSize });
  const sceneStyle: React.CSSProperties = {
    gridTemplateColumns: cubeSize ? `repeat(${gridSize}, ${cubeSize}px)` : `repeat(${gridSize}, 1fr)`,
    gridTemplateRows: cubeSize ? `repeat(${gridSize}, ${cubeSize}px)` : `repeat(${gridSize}, 1fr)`,
    columnGap: colGap,
    rowGap: rowGap,
    // 포크 시 수정 1. 원본 99999999px는 사실상 정사영이라 3D 기울임이
    // 안 보였다. 실제로 원근이 느껴지는 값으로.
    perspective: '800px',
    gridAutoRows: '1fr'
  };
  const wrapperStyle = {
    '--cube-face-border': borderStyle,
    '--cube-face-bg': faceColor,
    ...(cubeSize
      ? {
          width: `${gridSize * cubeSize}px`,
          height: `${gridSize * cubeSize}px`
        }
      : {})
  } as React.CSSProperties;

  return (
    <div className={`relative aspect-square ${wrapperClassName}`} style={wrapperStyle}>
      {/* 격자는 순전히 장식이다. 기술명은 옆의 sr-only 목록이 텍스트로
          전달하므로, 여기서 또 읽히면 스크린리더에 같은 정보가 두 번(장식
          문맥 없이 아이콘 alt로 한 번, 목록으로 한 번) 들린다. */}
      <div ref={sceneRef} aria-hidden="true" className="grid h-full w-full" style={sceneStyle}>
        {cells.map((_, r) =>
          cells.map((__, c) => {
            const icon = techStack[r * gridSize + c];
            return (
              <div
                key={`${r}-${c}`}
                className="cube relative aspect-square h-full w-full [transform-style:preserve-3d]"
                data-row={r}
                data-col={c}
              >
                <span className="absolute pointer-events-none -inset-9" />

                <div
                  className="cube-face absolute inset-0 flex items-center justify-center"
                  style={{
                    background: 'var(--cube-face-bg)',
                    border: 'var(--cube-face-border)',
                    transform: 'translateY(-50%) rotateX(90deg)'
                  }}
                />
                <div
                  className="cube-face absolute inset-0 flex items-center justify-center"
                  style={{
                    background: 'var(--cube-face-bg)',
                    border: 'var(--cube-face-border)',
                    transform: 'translateY(50%) rotateX(-90deg)'
                  }}
                />
                <div
                  className="cube-face absolute inset-0 flex items-center justify-center"
                  style={{
                    background: 'var(--cube-face-bg)',
                    border: 'var(--cube-face-border)',
                    transform: 'translateX(-50%) rotateY(-90deg)'
                  }}
                />
                <div
                  className="cube-face absolute inset-0 flex items-center justify-center"
                  style={{
                    background: 'var(--cube-face-bg)',
                    border: 'var(--cube-face-border)',
                    transform: 'translateX(50%) rotateY(90deg)'
                  }}
                />
                {/* 정면 페이스. 아이콘은 전부 여기 하나에만 얹는다. 나머지
                    5면은 원본처럼 빈 채로 둔다(정보 손실 0, 레이어 6개 유지). */}
                <div
                  data-icon-face={icon ? 'true' : undefined}
                  className="cube-face absolute inset-0 flex items-center justify-center"
                  style={{
                    background: 'var(--cube-face-bg)',
                    border: 'var(--cube-face-border)',
                    transform: 'rotateY(-90deg) translateX(50%) rotateY(90deg)'
                  }}
                >
                  {icon && (
                    <Image
                      src={icon.path}
                      alt=""
                      width={32}
                      height={32}
                      className="h-1/2 w-1/2 object-contain"
                    />
                  )}
                </div>
                <div
                  className="cube-face absolute inset-0 flex items-center justify-center"
                  style={{
                    background: 'var(--cube-face-bg)',
                    border: 'var(--cube-face-border)',
                    transform: 'rotateY(90deg) translateX(-50%) rotateY(-90deg)'
                  }}
                />
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default Cubes;
