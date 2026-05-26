// components/blocks/ProjectModal/index.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Icon, Skeleton } from '@/components/atoms';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import { RichText } from '@/lib/utils';
import { Project } from '@/types';
import type { ProjectReview, KeyMetric, TechReason } from '@/types';

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
      <h3 className="text-[13px] font-bold tracking-[0.12em] uppercase text-grey-800">
        {children}
      </h3>
    </div>
  );
}


function ResultBlock({ metrics }: { metrics: KeyMetric[] }) {
  return (
    <div className="rounded-md overflow-hidden border border-emerald-100 text-[11px]">
      {/* 상단 바 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border-b border-emerald-100">
        <span className="w-2 h-2 rounded-full bg-emerald-300" />
        <span className="w-2 h-2 rounded-full bg-emerald-200" />
        <span className="w-2 h-2 rounded-full bg-emerald-100" />
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
          결과
        </span>
      </div>

      {/* 항목 목록 */}
      <div className="bg-white divide-y divide-emerald-50">
        {metrics.map((m, i) => (
          <div key={i} className="px-3 py-3 space-y-1.5">
            {/* 레이블 */}
            <span className="text-[11px] font-bold text-grey-700">{m.label}</span>

            {/* before 줄 */}
            {m.before && (
              <div className="flex items-start gap-2 pl-1">
                <span className="text-red-400 select-none mt-px font-bold shrink-0">−</span>
                <RichText text={m.before} className="text-grey-400 line-through leading-snug text-[11px]" />
              </div>
            )}

            {/* after 줄 — delta가 있으면 줄 끝에 인라인으로 표시 */}
            <div className="flex items-start gap-2 pl-1">
              <span className="text-emerald-500 select-none font-bold mt-px shrink-0">+</span>
              <span className="text-emerald-700 font-semibold leading-snug text-[11px]">
                <RichText text={m.after} />
                {m.delta && (
                  <span className="ml-2 text-[10px] font-bold text-emerald-500">({m.delta})</span>
                )}
              </span>
            </div>

            {/* measuredBy */}
            <div className="flex items-center gap-1.5 pl-1 pt-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-grey-300 shrink-0">측정</span>
              <RichText text={m.measuredBy ?? ''} className="text-[10px] text-grey-400 leading-snug" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeOffBlock({ items }: { items: string[] }) {
  return (
    <div className="rounded-lg border border-purple-100 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border-b border-purple-100">
        <span className="text-purple-400 text-[14px] leading-none select-none">⚖</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-purple-500">트레이드오프</span>
      </div>

      {/* 항목 목록 */}
      <div className="divide-y divide-purple-50 bg-white">
        {items.map((t, i) => (
          <div key={i} className="grid grid-cols-[20px_1fr] gap-2 px-3 py-2.5 items-start">
            <span className="text-[11px] font-bold text-purple-300 tabular-nums mt-px select-none">
              {String(i + 1).padStart(2, '0')}
            </span>
            <RichText text={t} className="text-[12px] text-grey-600 leading-relaxed" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 프로젝트 요약 — 만든 이유(P) + 성과(R) 2블록
function OverviewBlock({ project }: { project: NonNullable<Parameters<typeof ProjectModal>[0]['project']> }) {
  const hasOverview = !!(project.motivation || project.keyMetrics?.length);
  if (!hasOverview) return null;

  // learned 있는 항목만 성과 카드로 표시
  const learnedMetrics = project.keyMetrics?.filter(m => m.learned && m.after !== 'N') ?? [];

  return (
    <div className="space-y-5">
      {/* 만든 이유 */}
      {project.motivation && (
        <div className="relative">
          {/* 큰 따옴표 장식 */}
          <span className="absolute -top-1 -left-0.5 text-[32px] leading-none text-blue-200 font-serif select-none" aria-hidden>
            &ldquo;
          </span>
          <div className="pl-5 pr-2 pt-1">
            <RichText text={project.motivation} className="text-[13px] text-grey-700 leading-[1.75]" />
          </div>
        </div>
      )}

      {/* 성과 카드 그리드 */}
      {learnedMetrics.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-grey-700 mb-3">이 프로젝트에서 배운 것</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {learnedMetrics.map((m, i) => (
              <div key={i} className="rounded-xl bg-grey-50 border border-grey-100 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-grey-800">{m.label}</span>
                {/* 수치: before→after 또는 after만 인라인 표시 */}
                {m.before ? (
                  <p className="mt-1 mb-2.5 text-[11px] leading-snug">
                    <span className="text-grey-400 line-through">{m.before}</span>
                    <span className="mx-1.5 text-grey-300">→</span>
                    <span className="font-bold text-blue-600">{m.after}</span>
                  </p>
                ) : (
                  <p className="mt-1 mb-2.5 text-[11px] font-bold text-blue-600 leading-snug">{m.after}</p>
                )}
                {/* 배운 점 — 주인공 */}
                {m.learned && <RichText text={m.learned} className="text-[12px] text-grey-700 leading-[1.65]" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 분석 블록 — **진단 —** 으로 시작하면 진단, **선택지N으로 시작하면 선택지 항목으로 파싱
function AnalysisBlock({ items }: { items: string[] }) {
  const diagnosisItems: string[] = [];
  const choiceItems: { text: string; chosen: boolean }[] = [];

  for (const item of items) {
    const stripped = item.replace(/^\*\*/, '');
    if (stripped.startsWith('진단')) {
      diagnosisItems.push(item);
    } else if (stripped.startsWith('선택지') || stripped.startsWith('전체 도구')) {
      const chosen = item.includes('(선택)');
      const cleaned = item.replace(/\s*\(선택\)/g, '');
      choiceItems.push({ text: cleaned, chosen });
    } else {
      diagnosisItems.push(item);
    }
  }

  return (
    <div className="space-y-3">
      {diagnosisItems.length > 0 && (
        <ul className="space-y-2">
          {diagnosisItems.map((a, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <RichText text={a} className="text-[12px] text-grey-700 leading-relaxed" />
            </li>
          ))}
        </ul>
      )}

      {choiceItems.length > 0 && (
        <ul className="space-y-2">
          {choiceItems.map((c, i) => (
            <li key={i} className={cn(
              'rounded-lg px-3 py-2.5 flex items-start gap-2.5',
              c.chosen
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-white border border-grey-100'
            )}>
              <span className={cn(
                'mt-[5px] flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold w-4 h-4',
                c.chosen ? 'bg-blue-500 text-white' : 'bg-grey-200 text-grey-500'
              )}>
                {i + 1}
              </span>
              <RichText
                text={c.text}
                className={cn('text-[12px] leading-relaxed', c.chosen ? 'text-blue-900' : 'text-grey-600')}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// TechReason 카드 하단 확장 — selectionCriteria / alternatives / tradeOffs
function TechReasonExpand({ tech }: { tech: TechReason }) {
  const hasExpand = !!(tech.selectionCriteria || tech.alternatives?.length || tech.tradeOffs?.length || tech.action?.length);
  if (!hasExpand) return null;
  return (
    <div className="border-t border-grey-100 bg-grey-50/60 px-4 py-3 space-y-3">
      {tech.selectionCriteria && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-grey-500 mb-1">선택 기준</p>
          <RichText text={tech.selectionCriteria} className="text-[11px] text-grey-700 leading-relaxed" />
        </div>
      )}
      {tech.alternatives && tech.alternatives.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1.5">검토한 대안</p>
          <ul className="space-y-1">
            {tech.alternatives.map((alt, i) => (
              <li key={i} className="text-[11px] text-grey-700 leading-relaxed">
                <span className="font-semibold text-grey-800">{alt.name}</span>
                <span className="text-grey-400 mx-1.5">—</span>
                {alt.rejectedBecause}
              </li>
            ))}
          </ul>
        </div>
      )}
      {tech.action && tech.action.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1.5">실행</p>
          <ul className="space-y-1">
            {tech.action.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[5px] w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                <RichText text={a} className="text-[11px] text-grey-700 leading-relaxed" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {tech.tradeOffs && tech.tradeOffs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1.5">트레이드오프</p>
          <ul className="space-y-1">
            {tech.tradeOffs.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[5px] w-1 h-1 rounded-full bg-purple-400 flex-shrink-0" />
                <RichText text={t} className="text-[11px] text-grey-700 leading-relaxed" />
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
              <Image src={review.image} alt={review.title} width={650} height={350} className="w-full" />
            </div>
          )}
        </div>
      )}

      {review.problem && (
        <div className="rounded-lg border-l-4 border-red-400 bg-red-50/60 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-500 mb-1.5">문제</p>
          <RichText text={review.problem} className="text-[12px] text-grey-700 leading-relaxed" />
        </div>
      )}
      {review.analysis && review.analysis.length > 0 && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50/60 px-4 py-3">
          <p className="text-[12px] font-bold uppercase tracking-wider text-amber-600 mb-3">분석</p>
          <AnalysisBlock items={review.analysis} />
        </div>
      )}
      {review.action && review.action.length > 0 && (
        <div className="rounded-lg border-l-4 border-blue-400 bg-blue-50/60 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-2">실행</p>
          <ul className="space-y-1.5">
            {review.action.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[6px] w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                <RichText text={a} className="text-[12px] text-grey-700 leading-relaxed" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {review.result && review.result.length > 0 && (
        <ResultBlock metrics={review.result} />
      )}
      {review.tradeOffs && review.tradeOffs.length > 0 && (
        <TradeOffBlock items={review.tradeOffs} />
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
            {/* 헤더 */}
            <motion.div
              className="flex items-center justify-between px-6 py-4 border-b border-grey-100 flex-shrink-0"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-1 h-5 rounded-full bg-blue-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h2 id="modal-title" className="text-[17px] font-bold text-grey-900 truncate">
                    {project.title}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {project.githubUrl && (
                  <Button variant="outline" leftIcon={<Icon name="share" />}
                    onClick={() => window.open(project.githubUrl, '_blank', 'noopener,noreferrer')}>
                    GitHub
                  </Button>
                )}
                {project.demoUrl && (
                  <Button leftIcon={<Icon name="arrow-right" />}
                    onClick={() => window.open(project.demoUrl, '_blank', 'noopener,noreferrer')}>
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

            {/* 콘텐츠 */}
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

                {/* 프로젝트 요약: 만든 이유(P) + 성과·배움(R) */}
                {(project.motivation || project.keyMetrics?.length) && (
                  <div>
                    <div className="border-t-2 border-grey-200 mb-6" />
                    <SectionLabel>프로젝트 요약</SectionLabel>
                    <OverviewBlock project={project} />
                  </div>
                )}

                {/* 구현 사항 */}
                {project.implementations && project.implementations.length > 0 && (
                  <div>
                    <SectionLabel>구현 사항</SectionLabel>
                    {/* 테이블형 2열 레이아웃 — 카테고리 라벨(좌) + 아이템(우) */}
                    <div className="rounded-xl border border-grey-100 overflow-hidden">
                      {project.implementations.map((impl, index) => {
                        const isLast = index === project.implementations!.length - 1;
                        return (
                          <div
                            key={index}
                            className={cn(
                              'grid grid-cols-[6rem_1fr] sm:grid-cols-[8rem_1fr]',
                              !isLast && 'border-b border-grey-100'
                            )}
                          >
                            {/* 카테고리 라벨 열 */}
                            <div className="bg-grey-50 px-3 py-4 flex items-start justify-end border-r border-grey-100">
                              <span className="text-[10px] font-bold tracking-wider text-grey-500 uppercase text-right leading-snug pt-0.5">
                                {impl.category.replace(' 섹션', '')}
                              </span>
                            </div>
                            {/* 아이템 열 */}
                            <div className="px-4 py-3 space-y-2.5 bg-white">
                              {impl.items.map((text, itemIdx) => {
                                const isTechItem = text.startsWith('**');
                                return (
                                  <div key={itemIdx}>
                                    {isTechItem ? (
                                      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                                        <RichText text={text} className="text-[12px] text-blue-900 leading-relaxed" />
                                      </div>
                                    ) : (
                                      <div className="flex items-start gap-2">
                                        <span className="mt-[6px] w-1 h-1 rounded-full bg-grey-300 flex-shrink-0" />
                                        <RichText text={text} className="text-[12px] text-grey-600 leading-relaxed" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {impl.video && (
                                <video src={impl.video} controls className="w-full rounded-lg mt-1" preload="metadata" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 프로젝트 리뷰: 카드 컨테이너로 시각적 격리 */}
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

                {/* 기술 스택 & 선정 이유 */}
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
                          <TechReasonExpand tech={tech} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 배운 점 */}
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
                              <RichText text={content} className="text-[12px] text-grey-600 leading-relaxed" />
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
