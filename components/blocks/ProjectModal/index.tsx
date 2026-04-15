// components/blocks/ProjectModal/index.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Icon, Skeleton } from '@/components/atoms';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import { RichText } from '@/lib/utils';
import { Project, ImplementationItem, ImplementationGroup } from '@/types';
import type { ProjectReview, TroubleShooting } from '@/types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  originRect?: DOMRect | null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-4 rounded-full bg-blue-500 flex-shrink-0" />
      <h3 className="text-[13px] font-bold tracking-[0.12em] uppercase text-grey-500">
        {children}
      </h3>
    </div>
  );
}

const STEPS = [
  { key: 'problem',     label: '문제',    color: 'bg-red-500',    textColor: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100'    },
  { key: 'analysis',    label: '원인',    color: 'bg-amber-500',  textColor: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100'  },
  { key: 'solution',    label: '해결',    color: 'bg-blue-500',   textColor: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  { key: 'results',     label: '결과',    color: 'bg-emerald-500',textColor: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-100'},
] as const;

function TroubleShootingCard({ ts }: { ts: TroubleShooting }) {
  return (
    <div className="rounded-xl overflow-hidden border border-grey-200 shadow-sm">
      {/* 타이틀 바 */}
      <div className="px-5 py-4 bg-grey-900 flex items-start gap-3">
        <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <p className="text-[13px] font-semibold text-white leading-snug">{ts.title}</p>
      </div>

      {/* 초기 구현 */}
      {ts.initialImpl && (
        <div className="px-5 py-4 bg-grey-50 border-b border-grey-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-grey-400 mb-2">초기 구현</p>
          <RichText text={ts.initialImpl} className="text-[12px] text-grey-600 leading-relaxed" />
        </div>
      )}

      {/* 스텝 */}
      <div className="divide-y divide-grey-200">
        {STEPS.map(({ key, label, color, textColor, bg }) => {
          const value = ts[key as keyof TroubleShooting];
          if (!value) return null;
          const items = Array.isArray(value) ? value : [value as string];
          return (
            <div key={key} className={cn('px-5 py-4', bg)}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', color)} />
                <span className={cn('text-[11px] font-bold uppercase tracking-wider', textColor)}>{label}</span>
              </div>
              <ul className="space-y-2 pl-0.5">
                {items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className={cn('mt-[6px] w-1.5 h-1.5 rounded-full flex-shrink-0', color)} />
                    <RichText text={item} className="text-[12px] text-grey-700 leading-relaxed" />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* 코드 블록 */}
      {ts.solutionCode && (
        <div className="border-t border-grey-200">
          <pre className="bg-grey-900 text-grey-200 px-5 py-4 overflow-x-auto text-[11px] leading-relaxed font-mono">
            <code>{ts.solutionCode}</code>
          </pre>
        </div>
      )}

      {/* 배운 점 */}
      {ts.lessons && ts.lessons.length > 0 && (
        <div className="px-5 py-4 border-t border-grey-200 bg-blue-50/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-3">배운 점</p>
          <ul className="space-y-2">
            {ts.lessons.map((l, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold text-blue-400 mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <RichText text={l} className="text-[12px] text-grey-700 leading-relaxed" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ReviewNavProps {
  reviews: ProjectReview[];
  activeIndex: number;
  onNavigate: (index: number) => void;
}

function ReviewNav({ reviews, activeIndex, onNavigate }: ReviewNavProps) {
  const prev = activeIndex > 0 ? reviews[activeIndex - 1] : null;
  const next = activeIndex < reviews.length - 1 ? reviews[activeIndex + 1] : null;

  return (
    <div className="mt-8 pt-5 border-t border-grey-200">
      <div className="flex items-stretch gap-3">
        {/* 이전 버튼 */}
        <div className="flex-1">
          {prev && (
            <button
              onClick={() => onNavigate(activeIndex - 1)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-grey-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 transition-all duration-200 text-left group"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-grey-400 group-hover:text-blue-500 transition-colors duration-200">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-grey-400 mb-0.5">이전 리뷰</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-medium text-grey-700 truncate">{prev.title}</p>
                  {prev.troubleShooting && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                </div>
              </div>
            </button>
          )}
        </div>

        {/* 현재 위치 인디케이터 */}
        <div className="flex flex-col items-center justify-center gap-1.5 px-2 flex-shrink-0">
          {reviews.map((_, i) => (
            <button
              key={i}
              onClick={() => onNavigate(i)}
              className={cn(
                'rounded-full transition-all duration-200',
                i === activeIndex
                  ? 'w-1.5 h-4 bg-blue-500'
                  : 'w-1.5 h-1.5 bg-grey-300 hover:bg-grey-400'
              )}
              aria-label={reviews[i].title}
            />
          ))}
        </div>

        {/* 다음 버튼 */}
        <div className="flex-1">
          {next ? (
            <button
              onClick={() => onNavigate(activeIndex + 1)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-grey-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 transition-all duration-200 text-right group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-grey-400 mb-0.5">다음 리뷰</p>
                <div className="flex items-center justify-end gap-1.5">
                  <p className="text-[12px] font-medium text-grey-700 truncate">{next.title}</p>
                  {next.troubleShooting && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-grey-400 group-hover:text-blue-500 transition-colors duration-200">
                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            /* 마지막 탭: 리뷰 완료 메시지 */
            <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-grey-100 bg-grey-50 text-right">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-grey-400 mb-0.5">완료</p>
                <p className="text-[12px] font-medium text-grey-500">모든 리뷰를 확인했습니다</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-emerald-400">
                <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ReviewContentProps {
  review: ProjectReview;
  reviews: ProjectReview[];
  activeIndex: number;
  onNavigate: (index: number) => void;
}

function ReviewContent({ review, reviews, activeIndex, onNavigate }: ReviewContentProps) {
  return (
    <div className="space-y-5">
      {/* 리뷰 이미지 */}
      {review.image && (
        <div className="w-full flex justify-center gap-3">
          {Array.isArray(review.image) ? (
            review.image.map((img, idx) => (
              <div key={idx} className="flex-1 max-w-sm rounded-lg overflow-hidden border border-grey-100">
                <Image src={img} alt={`${review.title} - ${idx + 1}`} width={600} height={338} className="w-full" />
              </div>
            ))
          ) : (
            <div className="w-full rounded-lg overflow-hidden border border-grey-100">
              <Image src={review.image} alt={review.title} width={800} height={450} className="w-full" />
            </div>
          )}
        </div>
      )}

      {/* 기획 의도 */}
      {review.intent && (
        <div className="rounded-lg border-l-2 border-blue-300 bg-blue-50/50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400 mb-1.5">기획 의도</p>
          <RichText text={review.intent} className="text-[12px] text-grey-700 leading-relaxed" />
        </div>
      )}

      {/* 주요 기능 */}
      {review.features && review.features.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-grey-400 mb-2.5">주요 기능</p>
          <ul className="space-y-1.5">
            {review.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                <RichText text={f} className="text-[12px] text-grey-700" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 트러블슈팅 */}
      {review.troubleShooting && (
        <div>
          {/* 트러블슈팅 진입 헤더 */}
          <div className="relative flex items-center gap-4 mb-5">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-grey-200 to-transparent" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-grey-900">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                <path d="M7 1L1 13h12L7 1z" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                <path d="M7 5.5v3M7 10.5v.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-grey-300">
                Trouble Shooting
              </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-grey-200 to-transparent" />
          </div>
          <TroubleShootingCard ts={review.troubleShooting} />
        </div>
      )}

      {/* 리뷰 하단 네비게이션 */}
      {reviews.length > 1 && (
        <ReviewNav
          reviews={reviews}
          activeIndex={activeIndex}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}


export default function ProjectModal({ isOpen, onClose, project, originRect }: ProjectModalProps) {
  const [activeReviewTab, setActiveReviewTab] = useState(0);
  const [imgLoading, setImgLoading]           = useState(true);
  const [imgError, setImgError]               = useState(false);
  const [mounted, setMounted]                 = useState(false);
  const contentRef                            = useRef<HTMLDivElement>(null);
  const reviewSectionRef                      = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      setImgLoading(true);
      setImgError(false);
      setActiveReviewTab(0);
      if (contentRef.current) contentRef.current.scrollTop = 0;
    }
  }, [isOpen, project]);

  // 탭 전환 시 리뷰 섹션 상단으로 스크롤
  const handleReviewTabChange = (index: number) => {
    setActiveReviewTab(index);
    if (!contentRef.current || !reviewSectionRef.current) return;
    const containerTop = contentRef.current.getBoundingClientRect().top;
    const sectionTop   = reviewSectionRef.current.getBoundingClientRect().top;
    const offset       = sectionTop - containerTop + contentRef.current.scrollTop - 16;
    contentRef.current.scrollTo({ top: offset, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!mounted || !project) return null;

  const scaleX = originRect ? originRect.width  / Math.min(window.innerWidth  * 0.9, 896) : 0.12;
  const scaleY = originRect ? originRect.height / Math.min(window.innerHeight * 0.9, 800) : 0.08;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4">
          {/* 백드롭 */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(8,12,24,0.72)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* 모달 패널 */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden"
            initial={{
              opacity: 0, scaleX, scaleY, borderRadius: '16px',
              translateX: originRect ? originRect.left + originRect.width  / 2 - window.innerWidth  / 2 : 0,
              translateY: originRect ? originRect.top  + originRect.height / 2 - window.innerHeight / 2 : 0,
            }}
            animate={{ opacity: 1, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, borderRadius: '16px' }}
            exit={{ opacity: 0, scale: 0.95, translateY: 12, borderRadius: '16px' }}
            transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
            role="dialog" aria-modal="true" aria-labelledby="modal-title"
          >
            {/* ── 헤더 ── */}
            <motion.div
              className="flex items-center justify-between px-6 py-4 border-b border-grey-100 flex-shrink-0"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-1 h-5 rounded-full bg-blue-500 flex-shrink-0" />
                <h2 id="modal-title" className="text-[17px] font-bold text-grey-900 truncate">
                  {project.title}
                </h2>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {project.githubUrl && (
                  <Button variant="outline" leftIcon={<Icon name="share" />}
                    onClick={() => window.open(project.githubUrl, '_blank')}>
                    GitHub
                  </Button>
                )}
                {project.demoUrl && (
                  <Button leftIcon={<Icon name="arrow-right" />}
                    onClick={() => window.open(project.demoUrl, '_blank')}>
                    Live
                  </Button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-grey-400 hover:text-grey-700 hover:bg-grey-100 rounded-lg transition-colors duration-150"
                  aria-label="닫기"
                >
                  <Icon name="close" size="medium" />
                </button>
              </div>
            </motion.div>

            {/* ── 콘텐츠 ── */}
            <motion.div
              ref={contentRef}
              className="overflow-y-auto flex-1 px-6 py-6"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.26, duration: 0.3, ease: 'easeOut' }}
            >
              <div className="space-y-8">

                {/* 프로젝트 이미지 + 메타 */}
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  {/* 썸네일 */}
                  <div className={cn(
                    'relative bg-grey-100 rounded-xl overflow-hidden flex-shrink-0',
                    project.imageAspect === 'portrait'  ? 'w-32 aspect-[9/16]' :
                    project.imageAspect === 'square'    ? 'w-40 aspect-square'  :
                    'w-full sm:w-64 aspect-video'
                  )}>
                    {imgLoading && (
                      <div className="absolute inset-0"><Skeleton variant="rectangular" className="w-full h-full" /></div>
                    )}
                    {imgError ? (
                      <div className="flex items-center justify-center h-full">
                        <Icon name="image" size="large" className="text-grey-300" />
                      </div>
                    ) : (
                      <Image src={project.image} alt={project.title} fill
                        className={cn('object-cover transition-opacity duration-300', imgLoading ? 'opacity-0' : 'opacity-100')}
                        onLoadingComplete={() => setImgLoading(false)}
                        onError={() => { setImgLoading(false); setImgError(true); }}
                        sizes="(max-width: 640px) 100vw, 256px"
                      />
                    )}
                  </div>

                  {/* 메타 정보 */}
                  <div className="flex-1 min-w-0">
                    {project.subtitle && (
                      <p className="text-[13px] font-medium text-blue-600 mb-2 leading-snug">{project.subtitle}</p>
                    )}
                    {project.longDescription && (
                      <p className="text-[12px] text-grey-600 leading-relaxed mb-4">{project.longDescription}</p>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {project.duration && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-grey-400 mb-0.5">기간</p>
                          <p className="text-[12px] font-semibold text-grey-800">{project.duration}</p>
                        </div>
                      )}
                      {project.role && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-grey-400 mb-0.5">역할</p>
                          <p className="text-[12px] font-semibold text-grey-800">{project.role}</p>
                        </div>
                      )}
                      {project.teamSize && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-grey-400 mb-0.5">팀</p>
                          <p className="text-[12px] font-semibold text-grey-800">{project.teamSize}</p>
                        </div>
                      )}
                    </div>
                    {/* 태그 */}
                    {project.tags && project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {project.tags.map(tag => (
                          <span key={tag}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-grey-100 text-grey-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 구현 사항 ── */}
                {project.implementations && project.implementations.length > 0 && (
                  <div>
                    <SectionLabel>구현 사항</SectionLabel>
                    <div className="space-y-4">
                      {project.implementations.map((impl, index) => {
                        const isGroup = typeof impl === 'object' && impl !== null && 'category' in impl;
                        if (isGroup) {
                          const group = impl as ImplementationGroup;
                          return (
                            <div key={index}>
                              <p className="text-[12px] font-bold text-grey-700 border-l-2 border-blue-400 pl-3 mb-2">
                                {group.category}
                              </p>
                              <ul className="space-y-2 pl-2">
                                {group.items.map((item, itemIdx) => {
                                  const isObj = typeof item === 'object' && item !== null;
                                  const text  = isObj ? (item as ImplementationItem).text : item;
                                  const video = isObj ? (item as ImplementationItem).video : null;
                                  const image = isObj ? (item as ImplementationItem).image : null;
                                  return (
                                    <li key={itemIdx} className="space-y-2">
                                      <div className="flex items-start gap-2">
                                        <span className="mt-[5px] w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                                        <RichText text={text as string} className="text-[12px] text-grey-700 leading-relaxed" />
                                      </div>
                                      {video && <video src={video} controls className="w-full rounded-lg" preload="metadata" />}
                                      {image && <Image src={image} alt={text} width={800} height={450} className="w-full rounded-lg" />}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        }
                        const isObj = typeof impl === 'object' && impl !== null;
                        const text  = isObj ? (impl as ImplementationItem).text : impl;
                        const video = isObj ? (impl as ImplementationItem).video : null;
                        const image = isObj ? (impl as ImplementationItem).image : null;
                        return (
                          <div key={index} className="space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="mt-[5px] w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                              <RichText text={text as string} className="text-[12px] text-grey-700 leading-relaxed" />
                            </div>
                            {video && <video src={video} controls className="w-full rounded-lg" preload="metadata" />}
                            {image && <Image src={image} alt={text} width={800} height={450} className="w-full rounded-lg" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── 프로젝트 리뷰 — 카드 컨테이너로 시각적 격리 ── */}
                {project.reviews && project.reviews.length > 0 && (
                  <div ref={reviewSectionRef}>
                    <div className="border-t-2 border-grey-200 mb-6" />
                    <SectionLabel>Project Review</SectionLabel>

                    <div className="rounded-xl border border-grey-200 bg-grey-50 overflow-hidden">
                      {/* 탭 바 */}
                      {project.reviews.length > 1 && (
                        <div className="flex gap-1.5 px-5 pt-4 pb-3 overflow-x-auto border-b border-grey-200 bg-white">
                          {project.reviews.map((review, index) => (
                            <button
                              key={review.id}
                              onClick={() => handleReviewTabChange(index)}
                              className={cn(
                                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0',
                                activeReviewTab === index
                                  ? 'bg-blue-500 text-white shadow-sm'
                                  : 'bg-grey-100 text-grey-600 hover:bg-grey-200'
                              )}
                            >
                              {review.title}
                              {review.troubleShooting && (
                                <span className={cn(
                                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                  activeReviewTab === index ? 'bg-amber-300' : 'bg-amber-400'
                                )} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 리뷰 콘텐츠 */}
                      <div className="p-5">
                        <ReviewContent
                          review={project.reviews[activeReviewTab] ?? project.reviews[0]}
                          reviews={project.reviews}
                          activeIndex={activeReviewTab}
                          onNavigate={handleReviewTabChange}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 기술 스택 & 선정 이유 ── */}
                {project.techReasons && project.techReasons.length > 0 && (
                  <div>
                    <div className="border-t-2 border-grey-200 mb-6" />
                    <SectionLabel>기술 스택 & 선정 이유</SectionLabel>
                    <div className="space-y-2">
                      {project.techReasons.map((tech, index) => (
                        <div key={index} className="rounded-xl border border-grey-100 overflow-hidden">
                          <div className="px-4 py-2.5 bg-grey-50 border-b border-grey-100">
                            <span className="text-[12px] font-bold text-blue-600">{tech.name}</span>
                          </div>
                          <ul className="px-4 py-3 space-y-1.5">
                            {tech.reasons.map((reason, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-[5px] w-1 h-1 rounded-full bg-grey-300 flex-shrink-0" />
                                <RichText text={reason} className="text-[12px] text-grey-600 leading-relaxed" />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── 배운 점 ── */}
                {project.keyLearnings && project.keyLearnings.length > 0 && (
                  <div>
                    <div className="border-t-2 border-grey-200 mb-6" />
                    <SectionLabel>배운 점</SectionLabel>
                    <ul className="space-y-3">
                      {project.keyLearnings.map((learning, index) => {
                        const colonIdx = learning.indexOf(':');
                        const title   = colonIdx !== -1 ? learning.substring(0, colonIdx).trim() : '';
                        const content = colonIdx !== -1 ? learning.substring(colonIdx + 1).trim() : learning;
                        return (
                          <li key={index} className="flex items-start gap-3">
                            <span className="text-[10px] font-bold text-amber-400 mt-0.5 flex-shrink-0">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div>
                              {title && <p className="text-[12px] font-bold text-grey-800 mb-0.5">{title}</p>}
                              <p className="text-[12px] text-grey-600 leading-relaxed">{content}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
