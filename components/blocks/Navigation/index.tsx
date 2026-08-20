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
  reducedMotion?: boolean;
  wordmarkRef?: Ref<HTMLButtonElement>;
  className?: string;
}

export default function Navigation({
  items,
  active,
  onNavigate,
  reducedMotion = false,
  wordmarkRef,
  className,
}: NavigationProps) {
  const itemRefs = useRef(new Map<NavId, HTMLButtonElement>());

  const centerCompactItem = useCallback((id: NavId) => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;

    itemRefs.current.get(id)?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [reducedMotion]);

  useEffect(() => {
    centerCompactItem(active);
  }, [active, centerCompactItem]);

  return (
    <nav
      aria-label="메인 네비게이션"
      className={cn('fixed top-0 left-0 right-0 z-50 px-6 py-4', className)}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-2 lg:gap-8">
        {/* 이 버튼 하나가 부팅 대형 이름과 compact 네비 워드마크를 겸한다.
            BootSequence는 이름을 복제하지 않고 이 ref만 애니메이션한다.
            hero/compact 사이의 실제 이동은 HomeClient의 FLIP 브리지가
            Flip.from()으로 담당하므로, 여기서는 최종 위치만 Tailwind
            클래스로 정의한다 — 애니메이션 자체를 여기 넣지 않는다.
            워드마크(FLIP 대상) 자신은 position이나 transform을 갖지 않는다
            — GSAP Flip이 이 노드에 inline transform을 걸고 absolute:true로
            잠깐 position:absolute까지 주는데, 여기 CSS로 position:fixed나
            transform 유틸까지 얹으면 실기기에서 비행 뒤 워드마크가 화면
            밖에 남는 버그가 났다(3라운드 — GSAP Flip 소스도 "fixed 포지션 +
            Flip" 버그를 알려진 문제로 캐시 무효화 워크어라운드까지 둘
            정도다). 대신 바깥 wrapper 하나가 hero에서만 fixed로 위치를
            잡고(bottom-1/2 = 뷰포트 50% 선에 이름 자신의 바닥을 붙임,
            inset-x-0 + flex justify-center = 수평 중앙), compact에서는
            display:contents로 스스로 사라져 워드마크를 nav 행의 평범한 flex
            자식으로 되돌린다 — transform 없이도 -translate-y-full과 같은
            "브레이크포인트별 폰트 크기가 달라져도 바닥이 항상 50%에
            닿는다"는 겹침 방지 계약을 유지한다. */}
        <div
          className={
            active === 'overview'
              ? 'fixed inset-x-0 bottom-1/2 z-40 flex justify-center'
              : 'contents'
          }
        >
          <button
            ref={wordmarkRef}
            data-testid="wordmark"
            data-flip-id="site-wordmark"
            data-wordmark-mode={active === 'overview' ? 'hero' : 'compact'}
            onClick={() => onNavigate('overview')}
            aria-label="개요로 이동"
            className={cn(
              'min-h-11 text-left leading-tight',
              active !== 'overview' && 'shrink-0'
            )}
          >
            <span
              className={cn(
                'block font-bold tracking-widest text-[var(--color-text-primary)]',
                active === 'overview' ? 'text-5xl sm:text-7xl md:text-8xl' : 'text-t6'
              )}
            >
              {PERSONAL_INFO.NAME_EN}
            </span>
          </button>
        </div>

        {/* 모바일 무hover 환경에서도 길찾기가 되도록 아이콘 대신 단어를 유지한다.
            justify-between 대신 ml-auto로 오른쪽에 붙인다 — GSAP Flip의
            absolute:true가 hero↔compact 전환 0.5초 동안 워드마크를 문서
            흐름에서 빼내는데, justify-between인 채로 워드마크만 사라지면
            남은 자식(이 div) 하나가 flex-start(왼쪽)로 쏠린다(3라운드
            실기기 버그 — 워드마크가 없어져도 네비 항목이 왼쪽으로
            붙었다). ml-auto는 형제가 몇 개 남든 스스로 오른쪽 끝까지
            밀어내므로 워드마크의 흐름 이탈과 무관하게 자리를 지킨다. */}
        <div className="relative ml-auto min-w-0">
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
            // overview는 포스터다 — 부팅 중에는 길찾기 스트립을 숨긴다(사용자
            // 지시). START를 누르면(active가 overview를 벗어나면) 나타난다.
            // 워드마크는 이 조건과 무관하게 항상 보인다 — LCP 요소라 절대
            // 숨기지 않는다. 숨김·복귀는 design-tokens.css의 nav-strip-hidden/
            // visible이 visibility:hidden으로 처리한다 — 그래서 aria-hidden·
            // inert를 여기서 따로 붙이지 않아도 탭 순서·접근성 트리에서
            // 자연히 제외된다.
            className={cn(
              'flex items-center gap-2 overflow-x-auto px-5 lg:gap-6 lg:px-0',
              active === 'overview' ? 'nav-strip-hidden' : 'nav-strip-visible'
            )}
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
