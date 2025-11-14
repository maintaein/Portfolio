'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  tiltMaxAngle?: number;
  scale?: number;
  transitionDuration?: number;
  glareEnable?: boolean;
  glareMaxOpacity?: number;
}

export function TiltCard({
  children,
  className,
  tiltMaxAngle = 15,
  scale = 1.05,
  transitionDuration = 300,
  glareEnable = true,
  glareMaxOpacity = 0.2
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>('');
  const [glare, setGlare] = useState<CSSProperties>({});
  const [isHovering, setIsHovering] = useState(false);

  // 마우스 무브 핸들러 - useCallback으로 메모이제이션
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!cardRef.current) return;

      const card = cardRef.current;
      const rect = card.getBoundingClientRect();

      // 카드 중심을 기준으로 마우스 위치 계산 (-1 ~ 1)
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // 중심점으로부터의 상대 위치 (-1 ~ 1)
      const centerX = x - 0.5;
      const centerY = y - 0.5;

      // 회전 각도 계산
      const rotateX = -centerY * tiltMaxAngle;
      const rotateY = centerX * tiltMaxAngle;

      // Transform 적용
      setTransform(
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`
      );

      // Glare 효과
      if (glareEnable) {
        const glareX = x * 100;
        const glareY = y * 100;

        setGlare({
          background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, ${glareMaxOpacity}) 0%, transparent 50%)`,
          opacity: 1
        });
      }
    },
    [tiltMaxAngle, scale, glareEnable, glareMaxOpacity]
  );

  // 마우스 엔터 핸들러
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  // 마우스 리브 핸들러
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)');
    setGlare({});
  }, []);

  // 이벤트 리스너 등록/해제
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseEnter, handleMouseLeave]);

  return (
    <div
      ref={cardRef}
      className={cn('relative transform-gpu', className)}
      style={{
        transform: transform || 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)',
        transition: isHovering
          ? `transform ${transitionDuration}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`
          : `transform ${transitionDuration}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`,
        transformStyle: 'preserve-3d',
        willChange: 'transform'
      }}
    >
      {/* 카드 컨텐츠 */}
      <div className="relative z-10" style={{ transformStyle: 'preserve-3d' }}>
        {children}
      </div>

      {/* Glare 효과 */}
      {glareEnable && (
        <div
          className="absolute inset-0 pointer-events-none z-20 rounded-[inherit] transition-opacity duration-300"
          style={{
            ...glare,
            opacity: isHovering && glare.opacity ? glare.opacity : 0
          }}
        />
      )}
    </div>
  );
}
