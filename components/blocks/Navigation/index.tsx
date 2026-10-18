'use client';

import { useState, type Ref } from 'react';
import type { NavId } from '@/hooks/useSectionNav';
import { PERSONAL_INFO, type NavigationItem } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

interface NavigationProps {
  items: readonly NavigationItem[];
  active: NavId;
  onNavigate: (id: NavId, options?: { focus?: boolean; behavior?: 'auto' | 'smooth' }) => void;
  reducedMotion?: boolean;
  wordmarkRef?: Ref<HTMLButtonElement>;
  wordmarkScaleRef?: Ref<HTMLDivElement>;
  headerRef?: Ref<HTMLElement>;
  className?: string;
}
export default function Navigation({ items, active, onNavigate, reducedMotion = false, wordmarkRef, wordmarkScaleRef, headerRef, className }: NavigationProps) {
  const [open, setOpen] = useState(false);
  const navigate = (id: NavId) => { setOpen(false); onNavigate(id, { focus: true, behavior: reducedMotion ? 'auto' : 'smooth' }); };
  return (
    <nav ref={headerRef} data-scroll-header aria-label="메인 네비게이션"
      onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.querySelector<HTMLButtonElement>('[aria-controls]')?.focus(); } }}
      className={cn('fixed inset-x-0 top-0 z-50 bg-[var(--color-ink)] px-6 py-4', className)}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 lg:gap-8">
        <div ref={wordmarkScaleRef} data-motion-anchor="nav-name" className="shrink-0"><button ref={wordmarkRef} data-flip-id="site-wordmark" data-testid="wordmark" data-wordmark-mode="compact" onClick={() => navigate('overview')}
          aria-label="개요로 이동" className="min-h-11 text-left text-t6 font-bold tracking-widest">{PERSONAL_INFO.NAME_EN}</button></div>
        <button type="button" aria-expanded={open} aria-controls="navigation-items" onClick={() => setOpen(!open)} className="min-h-11 min-w-11 lg:hidden">메뉴</button>
        <div id="navigation-items" data-testid="nav-strip" className={cn('absolute inset-x-0 top-full w-full flex-col gap-2 bg-[var(--color-ink)] px-6 pb-4 lg:static lg:flex lg:w-auto lg:flex-row lg:gap-6 lg:p-0', open ? 'flex' : 'hidden')}>
          {items.map(item => <button key={item.id} onClick={() => navigate(item.id)} aria-current={active === item.id ? 'page' : undefined}
            className={cn('min-h-11 px-2 text-left text-t7 uppercase tracking-widest', active === item.id ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-cyan-core)]')}>{item.label}</button>)}
        </div>
      </div>
    </nav>
  );
}
