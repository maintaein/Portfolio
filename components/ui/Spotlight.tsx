'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SpotlightProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  size?: number;
}

export function Spotlight({
  children,
  className,
  spotlightColor = 'rgba(255, 255, 255, 0.15)',
  size = 600
}: SpotlightProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 마우스 움직임 핸들러 - useCallback으로 메모이제이션
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  // 마우스 진입 핸들러
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  // 마우스 퇴장 핸들러
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  // 이벤트 리스너 등록/해제
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseEnter, handleMouseLeave]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
    >
      {/* Spotlight 효과 */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0,
        }}
      >
        <div
          className="absolute rounded-full blur-3xl transition-all duration-200 ease-out"
          style={{
            left: mousePosition.x - size / 2,
            top: mousePosition.y - size / 2,
            width: size,
            height: size,
            background: `radial-gradient(circle, ${spotlightColor} 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* 컨텐츠 */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
