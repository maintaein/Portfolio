'use client';

import { useEffect, useRef, useState, type MouseEvent, type Ref } from 'react';
import type { NavId } from '@/hooks/useSectionNav';
import type { NavigationItem } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

interface NavigationProps {
  items: readonly NavigationItem[];
  active: NavId;
  onNavigate: (id: NavId, options?: { focus?: boolean; behavior?: 'auto' | 'smooth' }) => void;
  reducedMotion?: boolean;
  headerRef?: Ref<HTMLElement>;
  className?: string;
}
export default function Navigation({ items, active, onNavigate, reducedMotion = false, headerRef, className }: NavigationProps) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // 키보드로 누른 클릭(detail 0)은 smooth 없이 바로 이동한다.
  const navigate = (id: NavId, event: MouseEvent) => { setOpen(false); onNavigate(id, { focus: true, behavior: reducedMotion || event.detail === 0 ? 'auto' : 'smooth' }); };
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // 포커스가 nav 안에 있을 때만 토글로 돌린다. 바깥 포커스는 빼앗지 않는다.
      if (toggleRef.current?.closest('nav')?.contains(document.activeElement)) toggleRef.current.focus();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return (
    <nav ref={headerRef} data-scroll-header aria-label="메인 네비게이션"
      className={cn('fixed inset-x-0 top-0 z-50 bg-[var(--color-ink)] px-6 py-4', className)}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 lg:gap-8">
        {/* 이름 버튼은 Hero에 산다. 서버 HTML부터 Hero 자리여야 해서다. 경계(motion.ts)가 지점을 넘으면 이 앵커 위로 옮긴다. */}
        <div data-motion-anchor="nav-name" className="min-h-11 shrink-0" />
        <button ref={toggleRef} type="button" aria-expanded={open} aria-controls="navigation-items" onClick={() => setOpen(!open)} className="min-h-11 min-w-11 lg:hidden">메뉴</button>
        <div id="navigation-items" data-testid="nav-strip" className={cn('absolute inset-x-0 top-full w-full flex-col gap-2 bg-[var(--color-ink)] px-6 pb-4 lg:static lg:flex lg:w-auto lg:flex-row lg:gap-6 lg:p-0', open ? 'flex' : 'hidden')}>
          {items.map(item => <button key={item.id} onClick={event => navigate(item.id, event)} aria-current={active === item.id ? 'page' : undefined}
            className={cn('min-h-11 px-2 text-left text-t7 uppercase tracking-widest', active === item.id ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-cyan-core)]')}>{item.label}</button>)}
        </div>
      </div>
    </nav>
  );
}
