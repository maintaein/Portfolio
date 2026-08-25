'use client';

// react-bits ClickSpark를 START 클릭 반응으로 들여왔다. React만 쓰는(캔버스
// + rAF) 경량 구현이라는 원본의 성질을 그대로 유지한다.
// 원본: https://github.com/davidhdev/react-bits
//       src/ts-tailwind/Animations/ClickSpark/ClickSpark.tsx
//
// 변경점(원본 대비):
// - 원본은 스파크가 하나도 없어도 requestAnimationFrame을 영원히 돈다(idle
//   draw loop). 이 저장소는 "연출이 끝나면 rAF를 멈춘다"는 원칙을 파티클
//   이름 형성에도 적용했으므로, 여기서도 스파크 배열이 비면 루프를 멈추고
//   다음 클릭이 올 때만 다시 시작한다 — 상시 루프가 하나 더 느는 것을 막는다.
// - sparkColor는 팔레트 커스텀 프로퍼티(--color-cyan-hi)를 getComputedStyle로
//   읽어 해석한 값을 쓴다 — canvas의 strokeStyle은 `var(...)` 문자열을 직접
//   해석하지 못하므로 하드코딩 대신 DOM에서 실제 값을 읽어온다.
// - 기본값(sparkCount·sparkSize·sparkRadius·duration)을 원본보다 짧고
//   절제되게 낮췄다 — 배경이 이미 팽창하는 광선 터널이라 과하면 노이즈
//   위의 노이즈가 된다(2차 감사가 클릭 링을 반대한 이유와 같다).
import { useCallback, useEffect, useRef, type ReactNode } from 'react';

interface ClickSparkProps {
  sparkColorVar?: string; // 해석할 CSS 커스텀 프로퍼티 이름(예: '--color-cyan-hi')
  sparkColorFallback?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  extraScale?: number;
  className?: string;
  children?: ReactNode;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

function resolveColorVar(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
}

export default function ClickSpark({
  sparkColorVar = '--color-cyan-hi',
  sparkColorFallback = '#7fe3ee',
  sparkSize = 8,
  sparkRadius = 14,
  sparkCount = 5,
  duration = 220,
  easing = 'ease-out',
  extraScale = 1,
  className = '',
  children,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const animationIdRef = useRef<number | null>(null);
  const colorRef = useRef(sparkColorFallback);

  useEffect(() => {
    colorRef.current = resolveColorVar(sparkColorVar, sparkColorFallback);
  }, [sparkColorVar, sparkColorFallback]);

  // 부모(버튼을 감싼 relative wrapper) 크기에 캔버스를 맞춘다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 100);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);
    resizeCanvas();

    return () => {
      ro.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, []);

  const easeFunc = useCallback(
    (t: number) => {
      switch (easing) {
        case 'linear':
          return t;
        case 'ease-in':
          return t * t;
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing]
  );

  // draw 자신을 ref에 담아 둔다 — handleClick(안정적인 identity가 필요 없는
  // 이벤트 핸들러)이 최신 draw 클로저를 곧바로 requestAnimationFrame에 넘길
  // 수 있어야 idle → 클릭 재시작이 별도 상태 없이 성립한다.
  const drawRef = useRef<(timestamp: number) => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (timestamp: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter((spark: Spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;

        const progress = elapsed / duration;
        const eased = easeFunc(progress);
        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        ctx.strokeStyle = colorRef.current;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        return true;
      });

      // 스파크가 남아 있는 동안만 다음 프레임을 예약한다(원본과의 차이,
      // 위 주석). 다 사라지면 루프를 멈추고 idle로 돌아간다.
      animationIdRef.current =
        sparksRef.current.length > 0 ? requestAnimationFrame(draw) : null;
    };

    drawRef.current = draw;

    return () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [sparkSize, sparkRadius, duration, easeFunc, extraScale]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    const newSparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / sparkCount,
      startTime: now,
    }));

    const wasIdle = sparksRef.current.length === 0;
    sparksRef.current.push(...newSparks);

    if (wasIdle) {
      animationIdRef.current = requestAnimationFrame(drawRef.current);
    }
  };

  return (
    <div className={`relative inline-flex ${className}`} onClick={handleClick}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 pointer-events-none" />
      {children}
    </div>
  );
}
