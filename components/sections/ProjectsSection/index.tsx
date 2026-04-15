'use client';

import {
  useState, useRef, useCallback,
} from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import ProjectModal from '@/components/blocks/ProjectModal';
import { SectionHeader } from '@/components/blocks';
import { Project } from '@/types/index';
import { projects } from '@/lib/data';

const CARD_H          = 420;
const CARD_W_DEFAULT  = 200;
const CARD_W_FEATURED = 540;
const CARD_GAP        = 14;

export default function ProjectsSection() {
  const [featuredIdx,  setFeaturedIdx]  = useState<number | null>(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalOrigin,  setModalOrigin]  = useState<DOMRect | null>(null);

  const scrollRef   = useRef<HTMLDivElement>(null);
  const cardRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const dragStartX  = useRef(0);
  const dragScrollL = useRef(0);
  const didDrag     = useRef(false);   // mouseup 시점에 드래그 여부 기록
  const [showHint, setShowHint] = useState(true);

  const scrollToCenter = useCallback((idx: number) => {
    const card = cardRefs.current[idx];
    const container = scrollRef.current;
    if (!card || !container) return;
    setTimeout(() => {
      const containerW  = container.clientWidth;
      const scrollW     = container.scrollWidth;
      const cardLeft    = card.offsetLeft;
      const cardCenter  = cardLeft + CARD_W_FEATURED / 2;
      // 중앙 정렬 기준 scrollLeft
      const targetCenter = cardCenter - containerW / 2;
      // 카드 오른쪽 끝이 잘리지 않도록: 카드 right가 container 안에 들어올 최솟값
      const minToShowRight = cardLeft + CARD_W_FEATURED - containerW;
      // 최종값: 두 조건 중 큰 값(더 오른쪽), 단 scrollWidth 초과 방지
      const scrollLeft = Math.min(
        Math.max(0, targetCenter, minToShowRight),
        scrollW - containerW
      );
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }, 30);
  }, []);

  /* 카드 클릭 — didDrag가 true면(드래그였으면) 무시 */
  const handleCardClick = useCallback((idx: number) => {
    if (didDrag.current) return;
    setFeaturedIdx(prev => {
      if (prev === idx) {
        // 이미 featured → 두 번 클릭 = 모달 (카드 위치 캡처)
        const cardEl = cardRefs.current[idx];
        if (cardEl) setModalOrigin(cardEl.getBoundingClientRect());
        setModalOpen(true);
        return prev;
      }
      scrollToCenter(idx);
      return idx;
    });
    setShowHint(false);
  }, [scrollToCenter]);

  /* 드래그 스크롤 — window 리스너 방식, 자식 onClick 간섭 없음 */
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    didDrag.current   = false;
    dragStartX.current  = e.clientX;
    dragScrollL.current = scrollRef.current?.scrollLeft ?? 0;

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - dragStartX.current;
      if (Math.abs(dx) > 8) didDrag.current = true;
      if (scrollRef.current) scrollRef.current.scrollLeft = dragScrollL.current - dx;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // click 이벤트는 mouseup 직후 동기 실행 → didDrag를 그 다음 tick에 리셋
      setTimeout(() => { didDrag.current = false; }, 10);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /* 섹션 내 카드 트랙 외부 클릭 → featured 닫기 */
  const handleSectionClick = (e: React.MouseEvent<HTMLElement>) => {
    if (featuredIdx === null) return;
    if (modalOpen) return;
    if (scrollRef.current && scrollRef.current.contains(e.target as Node)) return;
    setFeaturedIdx(null);
  };

  const featuredProject = featuredIdx !== null ? projects[featuredIdx] : null;

  return (
    <section
      id="projects"
      className="py-12 sm:py-16 lg:py-20 overflow-hidden bg-white relative"
      onClick={handleSectionClick}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden style={{
        backgroundImage: 'radial-gradient(circle, rgba(49,130,246,0.03) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader
          title="PROJECTS"
          subtitle="직접 기획하고 개발한 프로젝트들입니다"
        />

        <div className="relative">
          {/* 좌우 페이드 그라디언트 — 가로 스크롤 힌트 */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10" style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.95) 0%, transparent 100%)'
          }} />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10" style={{
            background: 'linear-gradient(270deg, rgba(255,255,255,0.95) 0%, transparent 100%)'
          }} />

          {/* 가로 스크롤 힌트 화살표 — 첫 진입 시 */}
          <AnimatePresence>
            {showHint && (
              <motion.div
                className="pointer-events-none absolute right-14 top-1/2 -translate-y-1/2 z-20
                           flex items-center gap-1"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: [0, 1, 1, 0], x: [8, 0, 0, 8] }}
                transition={{ duration: 2.2, delay: 0.8, times: [0, 0.2, 0.8, 1] }}
                onAnimationComplete={() => setShowHint(false)}
              >
                <span className="text-[11px] text-grey-400 tracking-wider">scroll</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10h12M12 6l4 4-4 4" stroke="#b0b8c1" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 스크롤 컨테이너 */}
          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            className="flex overflow-x-auto pb-4 cursor-grab active:cursor-grabbing select-none"
            style={{
              gap: CARD_GAP,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* 좌측 여백 */}
            <div className="shrink-0 w-8" />

            {projects.map((project, idx) => {
              const isFeatured = featuredIdx === idx;
              const isOther    = featuredIdx !== null && !isFeatured;

              return (
                <motion.div
                  key={project.title}
                  ref={el => { cardRefs.current[idx] = el; }}
                  animate={{
                    width:  isFeatured ? CARD_W_FEATURED : isOther ? CARD_W_DEFAULT - 16 : CARD_W_DEFAULT,
                    opacity: isOther ? 0.45 : 1,
                    scale:   isOther ? 0.96 : 1,
                  }}
                  transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => handleCardClick(idx)}
                  className="relative shrink-0 rounded-2xl overflow-hidden cursor-pointer"
                  style={{ height: CARD_H, minWidth: CARD_W_DEFAULT - 16 }}
                  whileHover={!isFeatured ? {
                    scale: 1.03,
                    transition: { duration: 0.2 },
                  } : {}}
                >
                  <ProjectCard
                    project={project}
                    isFeatured={isFeatured}
                    onOpenModal={() => setModalOpen(true)}
                  />
                </motion.div>
              );
            })}

            {/* 우측 여백 */}
            <div className="shrink-0 w-8" />
          </div>
        </div>

        {/* 클릭 안내 텍스트 */}
        <p className="mt-3 text-center text-[11px] tracking-widest text-grey-300 uppercase select-none">
          {featuredIdx !== null
            ? 'click again for detail · click elsewhere to close'
            : 'drag · click card to expand'}
        </p>
      </div>

      {/* 모달 */}
      <ProjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        project={featuredProject}
        originRect={modalOrigin}
      />
    </section>
  );
}

interface ProjectCardProps {
  project: Project;
  isFeatured: boolean;
  onOpenModal: () => void;
}

function ProjectCard({ project, isFeatured }: ProjectCardProps) {
  return (
    <div className="w-full h-full relative flex overflow-hidden">
      {/* 배경 이미지 */}
      <div className="absolute inset-0">
        <Image
          src={project.image}
          alt={project.title}
          fill
          className="object-cover transition-transform duration-700"
          style={{ transform: isFeatured ? 'scale(1.04)' : 'scale(1)' }}
          sizes="(max-width: 768px) 100vw, 560px"
          draggable={false}
        />
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            background: isFeatured
              ? 'linear-gradient(90deg, rgba(8,12,24,0.88) 0%, rgba(8,12,24,0.82) 36%, rgba(8,12,24,0.28) 62%, rgba(8,12,24,0.06) 100%)'
              : 'linear-gradient(180deg, rgba(8,12,24,0.08) 0%, rgba(8,12,24,0.40) 62%, rgba(8,12,24,0.82) 100%)',
          }}
        />
      </div>

      {/* 기본 상태 — 하단 타이틀 */}
      <AnimatePresence>
        {!isFeatured && (
          <motion.div
            className="absolute bottom-0 inset-x-0 p-4 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="w-7 h-[2px] mb-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-300" />
            <p className="text-white font-bold text-[14px] leading-snug mb-1.5 drop-shadow">
              {project.title}
            </p>
            <div className="flex flex-wrap gap-1">
              {project.tags.slice(0, 2).map(tag => (
                <span key={tag}
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    background: 'rgba(49,130,246,0.2)',
                    color: 'rgba(147,197,253,0.9)',
                    border: '1px solid rgba(49,130,246,0.25)',
                  }}>
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Featured 상태 — 좌측 상세 패널 */}
      <AnimatePresence>
        {isFeatured && (
          <motion.div
            className="absolute inset-y-0 left-0 z-10 flex flex-col justify-between"
            style={{ width: 300, padding: '28px 24px' }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            {/* 상단 */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-[2px] rounded-full bg-gradient-to-r from-blue-500 to-blue-300" />
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-blue-400">
                  Featured
                </span>
              </div>

              <h3 className="text-[22px] font-bold text-white leading-tight mb-2 drop-shadow-md">
                {project.title}
              </h3>

              {project.subtitle && (
                <p className="text-[12px] mb-3 leading-relaxed font-medium"
                  style={{ color: 'rgba(200,220,255,0.95)' }}>
                  {project.subtitle}
                </p>
              )}

              <p className="text-[12px] leading-relaxed line-clamp-4"
                style={{ color: 'rgba(210,225,245,0.90)' }}>
                {project.description}
              </p>
            </div>

            {/* 하단 — 메타 + 태그 + 클릭 힌트 */}
            <div>
              {project.duration && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-px w-3.5 rounded-full bg-blue-500/40" />
                  <span className="text-[10px] font-medium" style={{ color: 'rgba(190,215,255,0.85)' }}>
                    {project.duration}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mb-4">
                {project.tags.slice(0, 4).map(tag => (
                  <span key={tag}
                    className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
                    style={{
                      background: 'rgba(49,130,246,0.28)',
                      color: 'rgba(190,220,255,1)',
                      border: '1px solid rgba(49,130,246,0.45)',
                    }}>
                    {tag}
                  </span>
                ))}
                {project.tags.length > 4 && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-medium"
                    style={{
                      background: 'rgba(255,255,255,0.10)',
                      color: 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}>
                    +{project.tags.length - 4}
                  </span>
                )}
              </div>

              {/* 다시 클릭 힌트 */}
              <div className="flex items-center gap-1.5"
                style={{ color: 'rgba(190,220,255,0.80)' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6 4v4M4 6h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span className="text-[10px] tracking-wide font-medium">클릭하여 상세 보기</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
