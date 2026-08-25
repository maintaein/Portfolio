'use client';

// react-bits Magnet을 이 저장소의 START 버튼 호버 반응으로 들여왔다.
// 원본: https://github.com/davidhdev/react-bits
//       src/ts-tailwind/Animations/Magnet/Magnet.tsx
//
// 변경점(원본 대비):
// - 이동 범위에 상한(maxOffsetPx)을 새로 추가했다. 원본은 (마우스 오프셋 /
//   magnetStrength)를 그대로 쓰는데, 트리거 영역(padding)이 넓을수록 버튼이
//   화면을 가로질러 쫓아오는 것처럼 보여 "장난스럽다"는 이 브리프의 절제
//   요구를 어긴다. START는 부팅 캡션 정렬·겹침 방지 계약 위에 있으므로
//   움직임이 커지면 그 계약을 시각적으로 위협한다 — 그래서 실제 이동량을
//   항상 이 상한 안으로 자른다.
// - padding·magnetStrength 기본값을 원본(100·2)보다 훨씬 보수적으로 낮췄다
//   (아래 BootSequence 호출부에서 실제로 넘기는 값 참고).
// - disabled일 때 mousemove 리스너 자체를 달지 않는 원본 동작을 그대로
//   유지한다 — reducedMotion 게이팅을 이 prop 하나로 받는다.
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

interface MagnetProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  maxOffsetPx?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  wrapperClassName?: string;
  innerClassName?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function Magnet({
  children,
  padding = 20,
  disabled = false,
  magnetStrength = 6,
  maxOffsetPx = 8,
  activeTransition = 'transform 0.3s ease-out',
  inactiveTransition = 'transform 0.5s ease-in-out',
  wrapperClassName = '',
  innerClassName = '',
  ...props
}: MagnetProps) {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const magnetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) {
      setPosition({ x: 0, y: 0 });
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const el = magnetRef.current;
      if (!el) return;

      const { left, top, width, height } = el.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;

      const distX = Math.abs(centerX - e.clientX);
      const distY = Math.abs(centerY - e.clientY);

      if (distX < width / 2 + padding && distY < height / 2 + padding) {
        setIsActive(true);
        const offsetX = clamp((e.clientX - centerX) / magnetStrength, -maxOffsetPx, maxOffsetPx);
        const offsetY = clamp((e.clientY - centerY) / magnetStrength, -maxOffsetPx, maxOffsetPx);
        setPosition({ x: offsetX, y: offsetY });
      } else {
        setIsActive(false);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [padding, disabled, magnetStrength, maxOffsetPx]);

  const transitionStyle = isActive ? activeTransition : inactiveTransition;

  return (
    <div
      ref={magnetRef}
      className={wrapperClassName}
      style={{ position: 'relative', display: 'inline-block' }}
      {...props}
    >
      <div
        className={innerClassName}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: transitionStyle,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
