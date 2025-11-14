'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AuroraProps {
  children?: ReactNode;
  className?: string;
  showRadialGradient?: boolean;
}

export function Aurora({
  children,
  className,
  showRadialGradient = true
}: AuroraProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Aurora 배경 효과 */}
      <div className="absolute inset-0">
        {/* 첫 번째 그라데이션 레이어 */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%,
                rgba(120, 119, 198, 0.3),
                transparent
              )
            `,
            animation: 'aurora-1 20s ease-in-out infinite',
          }}
        />

        {/* 두 번째 그라데이션 레이어 */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%,
                rgba(156, 136, 255, 0.3),
                transparent
              )
            `,
            animation: 'aurora-2 25s ease-in-out infinite',
          }}
        />

        {/* 세 번째 그라데이션 레이어 */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%,
                rgba(196, 181, 253, 0.3),
                transparent
              )
            `,
            animation: 'aurora-3 30s ease-in-out infinite',
          }}
        />

        {/* Radial Gradient 오버레이 */}
        {showRadialGradient && (
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background: `
                radial-gradient(circle at 50% 50%,
                  transparent 40%,
                  rgba(17, 24, 39, 0.6) 100%
                )
              `,
            }}
          />
        )}
      </div>

      {/* 컨텐츠 */}
      <div className="relative z-10">{children}</div>

      <style jsx>{`
        @keyframes aurora-1 {
          0%, 100% {
            transform: translate(0%, 0%) scale(1);
            opacity: 0.5;
          }
          33% {
            transform: translate(30%, -10%) scale(1.1);
            opacity: 0.6;
          }
          66% {
            transform: translate(-20%, 10%) scale(0.9);
            opacity: 0.4;
          }
        }

        @keyframes aurora-2 {
          0%, 100% {
            transform: translate(0%, 0%) scale(1);
            opacity: 0.5;
          }
          33% {
            transform: translate(-30%, 10%) scale(1.05);
            opacity: 0.4;
          }
          66% {
            transform: translate(20%, -10%) scale(0.95);
            opacity: 0.6;
          }
        }

        @keyframes aurora-3 {
          0%, 100% {
            transform: translate(0%, 0%) scale(1);
            opacity: 0.5;
          }
          50% {
            transform: translate(10%, -5%) scale(1.08);
            opacity: 0.55;
          }
        }
      `}</style>
    </div>
  );
}
