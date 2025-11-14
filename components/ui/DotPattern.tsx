'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DotPatternProps {
  children?: ReactNode;
  className?: string;
  dotSize?: number;
  dotColor?: string;
  gap?: number;
  fade?: boolean;
}

export function DotPattern({
  children,
  className,
  dotSize = 1,
  dotColor = 'rgba(0, 0, 0, 0.1)',
  gap = 20,
  fade = true
}: DotPatternProps) {
  // SVG 패턴을 위한 고유 ID 생성
  const patternId = `dot-pattern-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={cn('relative', className)}>
      {/* SVG 패턴 정의 */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width={gap}
            height={gap}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={gap / 2}
              cy={gap / 2}
              r={dotSize}
              fill={dotColor}
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
        />

        {/* Fade 효과 (선택적) */}
        {fade && (
          <defs>
            <linearGradient id={`${patternId}-fade`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="50%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id={`${patternId}-mask`}>
              <rect width="100%" height="100%" fill={`url(#${patternId}-fade)`} />
            </mask>
          </defs>
        )}
      </svg>

      {/* 컨텐츠 */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
