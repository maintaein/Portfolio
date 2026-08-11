// components/blocks/Navigation/index.tsx
'use client';

import { useCallback, useEffect, useRef, type Ref } from 'react';
import type { NavId } from '@/hooks/useSectionNav';
import { PERSONAL_INFO, type NavigationItem } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

interface NavigationProps {
  items: readonly NavigationItem[];
  active: NavId;
  onNavigate: (id: NavId) => void;
  wordmarkRef?: Ref<HTMLButtonElement>;
  className?: string;
}

export default function Navigation({
  items,
  active,
  onNavigate,
  wordmarkRef,
  className,
}: NavigationProps) {
  const itemRefs = useRef(new Map<NavId, HTMLButtonElement>());

  const centerCompactItem = useCallback((id: NavId) => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;

    itemRefs.current.get(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, []);

  useEffect(() => {
    centerCompactItem(active);
  }, [active, centerCompactItem]);

  return (
    <nav
      aria-label="메인 네비게이션"
      className={cn('fixed top-0 left-0 right-0 z-50 px-6 py-4', className)}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 lg:gap-8">
        {/* 이 버튼 하나가 부팅 대형 이름과 compact 네비 워드마크를 겸한다.
            BootSequence는 이름을 복제하지 않고 이 ref만 애니메이션한다. */}
        <button
          ref={wordmarkRef}
          data-testid="wordmark"
          data-flip-id="site-wordmark"
          data-wordmark-mode={active === 'overview' ? 'hero' : 'compact'}
          onClick={() => onNavigate('overview')}
          aria-label="개요로 이동"
          className="min-h-11 shrink-0 text-left leading-tight"
        >
          <span className="block text-t6 font-bold tracking-widest text-[var(--color-text-primary)]">
            {PERSONAL_INFO.NAME_EN}
          </span>
        </button>

        {/* 모바일 무hover 환경에서도 길찾기가 되도록 아이콘 대신 단어를 유지한다. */}
        <div className="relative min-w-0">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-[var(--color-ink)] to-transparent lg:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-[var(--color-ink)] to-transparent lg:hidden"
          />
          <div
            data-testid="nav-strip"
            className="flex items-center gap-2 overflow-x-auto px-5 lg:gap-6 lg:px-0"
          >
            {items.map((item) => {
              const isActive = active === item.id;

              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    if (node) itemRefs.current.set(item.id, node);
                    else itemRefs.current.delete(item.id);
                  }}
                  onClick={() => onNavigate(item.id)}
                  onFocus={() => centerCompactItem(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="group relative min-h-11 shrink-0 px-2 pb-1 text-t7 uppercase tracking-widest lg:px-0"
                >
                  <span
                    className={cn(
                      'transition-colors duration-300',
                      isActive
                        ? 'text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-cyan-core)]'
                    )}
                  >
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      'absolute bottom-0 left-0 h-px bg-[var(--color-cyan-core)]',
                      'transition-all duration-300 ease-out origin-left',
                      isActive ? 'w-full' : 'w-0'
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
