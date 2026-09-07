// components/blocks/ProjectModal/index.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button, Icon, Skeleton } from '@/components/atoms';
import Modal from '@/components/atoms/Modal';
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
      <div className="w-1 h-4 rounded-full bg-[var(--color-cyan-core)] flex-shrink-0" />
      <h3 className="text-[13px] font-bold tracking-[0.12em] uppercase text-[var(--color-text-primary)]">
        {children}
      </h3>
    </div>
  );
}


function ResultBlock({ metrics }: { metrics: KeyMetric[] }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[var(--color-hairline)] text-[11px]">
      {/* 항목 목록 */}
      <div className="divide-y divide-[rgb(255_255_255_/_0.07)]">
        {metrics.map((m, i) => (
          <div key={i} className="px-3.5 py-3">
            <span className="text-[11px] font-bold text-[var(--color-text-primary)]">{m.label}</span>

            {/* 이전 → 이후. 값이 짧으면 한 줄, 길면 자연히 접힌다 */}
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {m.before && (
                <span className="text-[11px] text-[rgb(255_255_255_/_0.42)] leading-snug">
                  <RichText text={m.before} className="line-through" />
                  <span className="ml-2 text-[rgb(255_255_255_/_0.35)] no-underline">→</span>
                </span>
              )}
              <span className="text-[12px] font-semibold text-[var(--color-text-primary)] leading-snug">
                <RichText text={m.after} />
                {m.delta && (
                  <span className="ml-2 text-[11px] font-bold text-[var(--color-cyan-hi)]">({m.delta})</span>
                )}
              </span>
            </div>

            {/* 어떤 지표로 검증했는가 */}
            {m.measuredBy && (
              <div className="mt-1.5 flex items-start gap-1.5">
                <span className="text-[10px] font-bold text-[rgb(255_255_255_/_0.35)] shrink-0">측정 ·</span>
                <RichText text={m.measuredBy} className="text-[10px] text-[rgb(255_255_255_/_0.42)] leading-snug" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeOffBlock({ items }: { items: string[] }) {
  return (
    <div className="rounded-lg border border-[rgb(255_255_255_/_0.08)] overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[rgb(255_255_255_/_0.04)] border-b border-[rgb(255_255_255_/_0.08)]">
        <span className="text-[rgb(255_255_255_/_0.42)] text-[14px] leading-none select-none">⚖</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-primary)]">트레이드오프</span>
      </div>

      {/* 항목 목록 */}
      <div className="divide-y divide-[rgb(255_255_255_/_0.07)]">
        {items.map((t, i) => (
          <div key={i} className="grid grid-cols-[20px_1fr] gap-2 px-3 py-2.5 items-start">
            <span className="text-[11px] font-bold text-[rgb(255_255_255_/_0.3)] tabular-nums mt-px select-none">
              {String(i + 1).padStart(2, '0')}
            </span>
            <RichText text={t} className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed" />
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
          <span className="absolute -top-1 -left-0.5 text-[32px] leading-none text-[rgb(3_179_195_/_0.28)] font-serif select-none" aria-hidden>
            &ldquo;
          </span>
          <div className="pl-5 pr-2 pt-1">
            <RichText text={project.motivation} className="text-[13px] text-[var(--color-text-secondary)] leading-[1.75]" />
          </div>
        </div>
      )}

      {/* 성과 카드 그리드 */}
      {learnedMetrics.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-3">이 프로젝트에서 배운 것</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {learnedMetrics.map((m, i) => (
              <div key={i} className="rounded-lg bg-[rgb(255_255_255_/_0.04)] border border-[rgb(255_255_255_/_0.08)] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-primary)]">{m.label}</span>
                {/* 수치: before→after 또는 after만 인라인 표시 */}
                {m.before ? (
                  <p className="mt-1 mb-2.5 text-[11px] leading-snug">
                    <span className="text-[rgb(255_255_255_/_0.42)] line-through">{m.before}</span>
                    <span className="mx-1.5 text-[rgb(255_255_255_/_0.35)]">→</span>
                    <span className="font-bold text-[var(--color-cyan-hi)]">{m.after}</span>
                  </p>
                ) : (
                  <p className="mt-1 mb-2.5 text-[11px] font-bold text-[var(--color-cyan-hi)] leading-snug">{m.after}</p>
                )}
                {/* 배운 점 — 주인공 */}
                {m.learned && <RichText text={m.learned} className="text-[12px] text-[var(--color-text-secondary)] leading-[1.65]" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 데이터는 "**머리**: 본문" 꼴로 들어온다. 제목 줄과 근거 줄로 갈라야
// 훑는 사람은 제목만 읽고, 파고드는 사람은 아래를 읽는다.
function splitHead(text: string): { head: string; body: string } {
  const m = text.match(/^\*\*([^*]+)\*\*\s*:\s*([\s\S]*)$/);
  return m ? { head: m[1].trim(), body: m[2].trim() } : { head: '', body: text };
}

// **진단으로 시작하면 진단, **선택지N으로 시작하면 선택지 항목으로 파싱
function parseAnalysis(items: string[]) {
  const diagnosis: string[] = [];
  const choices: { head: string; body: string; chosen: boolean }[] = [];

  for (const item of items) {
    const stripped = item.replace(/^\*\*/, '');
    if (stripped.startsWith('선택지') || stripped.startsWith('전체 도구')) {
      const chosen = item.includes('(선택)');
      const { head, body } = splitHead(item.replace(/\s*\(선택\)/g, ''));
      // 번호는 왼쪽 배지가 달고 있으니 머리에서 뺀다.
      choices.push({ head: head.replace(/^선택지\s*\d+\s*[^\s]?\s*/, ''), body, chosen });
    } else {
      diagnosis.push(item);
    }
  }
  return { diagnosis, choices };
}

function AnalysisBlock({ items }: { items: string[] }) {
  const { diagnosis, choices } = parseAnalysis(items);

  return (
    <div className="space-y-4">
      {diagnosis.map((a, i) => {
        const { head, body } = splitHead(a);
        return (
          <div key={i}>
            {head && (
              <p className="text-[13px] font-bold text-[var(--color-text-primary)] leading-snug mb-1">{head}</p>
            )}
            <RichText text={body} className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed" />
          </div>
        );
      })}

      {choices.length > 0 && (
        <ul className="space-y-2">
          {choices.map((c, i) => (
            <li key={i} className={cn(
              'rounded-md px-3.5 py-3',
              c.chosen
                ? 'bg-[rgb(3_179_195_/_0.10)] border border-[var(--color-hairline)]'
                : 'border border-[rgb(255_255_255_/_0.12)]'
            )}>
              {/* 제목 줄 — 훑는 사람은 여기까지만 읽는다 */}
              <div className="flex items-start gap-2.5 mb-1.5">
                <span className={cn(
                  'mt-[3px] flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold w-4 h-4',
                  c.chosen
                    ? 'bg-[var(--color-cyan-core)] text-[rgb(2_6_8)]'
                    : 'ring-1 ring-[rgb(255_255_255_/_0.2)] text-[rgb(255_255_255_/_0.42)]'
                )}>
                  {i + 1}
                </span>
                <RichText
                  text={c.head}
                  className={cn('text-[12.5px] font-semibold leading-snug', c.chosen ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]')}
                />
                {c.chosen && (
                  <span className="ml-auto mt-[2px] flex-shrink-0 rounded-full bg-[var(--color-cyan-core)] px-2 py-0.5 text-[9px] font-bold tracking-wider text-[rgb(2_6_8)]">
                    선택
                  </span>
                )}
              </div>
              {/* 근거 줄 — 인라인에 padding을 주면 첫 줄만 밀리니 블록으로 감싼다 */}
              <div className="pl-[26px]">
                <RichText
                  text={c.body}
                  className={cn('text-[11.5px] leading-relaxed', c.chosen ? 'text-[var(--color-text-secondary)]' : 'text-[rgb(255_255_255_/_0.42)]')}
                />
              </div>
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
    <div className="border-t border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.03)] px-4 py-3 space-y-3">
      {tech.selectionCriteria && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-1">선택 기준</p>
          <RichText text={tech.selectionCriteria} className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed" />
        </div>
      )}
      {tech.alternatives && tech.alternatives.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-1.5">검토한 대안</p>
          <ul className="space-y-1">
            {tech.alternatives.map((alt, i) => (
              <li key={i} className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                <span className="font-semibold text-[var(--color-text-primary)]">{alt.name}</span>
                <span className="text-[rgb(255_255_255_/_0.42)] mr-1.5">:</span>
                {alt.rejectedBecause}
              </li>
            ))}
          </ul>
        </div>
      )}
      {tech.action && tech.action.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-1.5">실행</p>
          <ul className="space-y-1">
            {tech.action.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[5px] w-1 h-1 rounded-full bg-[rgb(255_255_255_/_0.25)] flex-shrink-0" />
                <RichText text={a} className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {tech.tradeOffs && tech.tradeOffs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-1.5">트레이드오프</p>
          <ul className="space-y-1">
            {tech.tradeOffs.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[5px] w-1 h-1 rounded-full bg-[rgb(255_255_255_/_0.25)] flex-shrink-0" />
                <RichText text={t} className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed" />
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
    <div className="mt-8 pt-5 border-t border-[rgb(255_255_255_/_0.08)]">
      <div className="flex items-stretch gap-3">
        {/* 이전 버튼 */}
        <div className="flex-1">
          {prev && (
            <button
              onClick={() => onNavigate(activeIndex - 1)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.04)] hover:border-[var(--color-hairline)] hover:bg-[rgb(3_179_195_/_0.08)] transition-all duration-200 text-left group"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-[rgb(255_255_255_/_0.42)] group-hover:text-[var(--color-cyan-hi)] transition-colors duration-200">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-0.5">이전 리뷰</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-medium text-[var(--color-text-secondary)] truncate">{prev.title}</p>
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
                  ? 'w-1.5 h-4 bg-[var(--color-cyan-core)]'
                  : 'w-1.5 h-1.5 bg-[rgb(255_255_255_/_0.2)] hover:bg-[rgb(255_255_255_/_0.35)]'
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
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.04)] hover:border-[var(--color-hairline)] hover:bg-[rgb(3_179_195_/_0.08)] transition-all duration-200 text-right group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-0.5">다음 리뷰</p>
                <div className="flex items-center justify-end gap-1.5">
                  <p className="text-[12px] font-medium text-[var(--color-text-secondary)] truncate">{next.title}</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-[rgb(255_255_255_/_0.42)] group-hover:text-[var(--color-cyan-hi)] transition-colors duration-200">
                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            /* 마지막 탭: 리뷰 완료 메시지 */
            <div className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.04)] text-right">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-0.5">완료</p>
                <p className="text-[12px] font-medium text-[rgb(255_255_255_/_0.42)]">모든 리뷰를 확인했습니다</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-[var(--color-cyan-hi)]">
                <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 리뷰 한 편은 상자 다섯 개가 아니라 한 줄기다. 왼쪽 레일이 시간 축이고,
// 무게는 색이 아니라 글자 크기로 준다. 라벨은 발판이라 죽이고 내용을 키운다.
function Stage({ label, note, accent, children }: { label?: string; note?: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative pl-7">
      {/* 축을 뚫고 앉는 마디 */}
      <span className="absolute left-0 top-0.5 w-4 h-4 rounded-full bg-[rgb(6_8_10)] flex items-center justify-center" aria-hidden>
        <span className={cn('rounded-full', accent ? 'w-2 h-2 bg-[var(--color-cyan-core)]' : 'w-1.5 h-1.5 bg-[rgb(255_255_255_/_0.28)]')} />
      </span>
      {label && (
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[rgb(255_255_255_/_0.42)]">{label}</p>
          {note && <span className="text-[10px] text-[rgb(255_255_255_/_0.35)]">· {note}</span>}
        </div>
      )}
      {children}
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
  const choiceCount = review.analysis ? parseAnalysis(review.analysis).choices.length : 0;
  const hasStages = !!(
    review.problem ||
    review.analysis?.length ||
    review.action?.length ||
    review.result?.length ||
    review.tradeOffs?.length
  );

  return (
    <div className="space-y-5">
      <p className="text-[15px] font-bold text-[var(--color-text-primary)] leading-snug">{review.title}</p>

      {/* 리뷰 이미지 */}
      {review.image && (
        <div className="w-full flex justify-center gap-3">
          {Array.isArray(review.image) ? (
            review.image.map((img, idx) => (
              <div key={idx} className="flex-1 max-w-sm rounded-lg overflow-hidden border border-[rgb(255_255_255_/_0.08)]">
                <Image src={img} alt={`${review.title} - ${idx + 1}`} width={600} height={338} className="w-full" />
              </div>
            ))
          ) : (
            <div className="w-full rounded-lg overflow-hidden border border-[rgb(255_255_255_/_0.08)]">
              <Image src={review.image} alt={review.title} width={650} height={350} className="w-full" />
            </div>
          )}
        </div>
      )}

      {hasStages && (
        <div className="relative space-y-6">
          {/* 시간 축 */}
          <div className="absolute left-2 top-2.5 bottom-2.5 w-px bg-[rgb(255_255_255_/_0.10)]" aria-hidden />

          {review.problem && (
            <Stage label="문제">
              <RichText text={review.problem} className="text-[14px] text-[var(--color-text-primary)] leading-[1.6]" />
            </Stage>
          )}
          {review.analysis && review.analysis.length > 0 && (
            <Stage label="분석" note={choiceCount > 0 ? `검토한 선택지 ${choiceCount}개` : undefined}>
              <AnalysisBlock items={review.analysis} />
            </Stage>
          )}
          {!!(review.action?.length || review.tradeOffs?.length) && (
            <Stage label="실행">
              {review.action && review.action.length > 0 && (
                <ul className="space-y-1.5">
                  {review.action.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-[6px] w-1 h-1 rounded-full bg-[rgb(255_255_255_/_0.25)] flex-shrink-0" />
                      <RichText text={a} className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed" />
                    </li>
                  ))}
                </ul>
              )}
              {review.tradeOffs && review.tradeOffs.length > 0 && (
                <div className="mt-3">
                  <TradeOffBlock items={review.tradeOffs} />
                </div>
              )}
            </Stage>
          )}
          {review.result && review.result.length > 0 && (
            <Stage label="결과" accent>
              <ResultBlock metrics={review.result} />
            </Stage>
          )}
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
  const contentRef                            = useRef<HTMLDivElement>(null);
  const reviewSectionRef                      = useRef<HTMLDivElement>(null);

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

  if (!project) return null;

  const scaleX = originRect
    ? originRect.width / Math.min(window.innerWidth * 0.9, 896)
    : 0.12;
  const scaleY = originRect
    ? originRect.height / Math.min(window.innerHeight * 0.9, 800)
    : 0.08;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="large"
      showCloseButton={false}
      ariaLabelledBy="modal-title"
      className="max-w-none bg-transparent shadow-none max-h-none"
    >
          {/* 백드롭 */}
          {/* 모달 패널 */}
          <motion.div
            className="relative bg-[rgb(6_8_10_/_0.97)] ring-1 ring-[var(--color-hairline)] shadow-[0_30px_90px_rgb(0_0_0_/_0.75)] rounded-2xl w-full max-w-4xl mx-auto flex flex-col max-h-[92vh] overflow-hidden"
            initial={{
              opacity: 0, scaleX, scaleY, borderRadius: '16px',
              translateX: originRect ? originRect.left + originRect.width  / 2 - window.innerWidth  / 2 : 0,
              translateY: originRect ? originRect.top  + originRect.height / 2 - window.innerHeight / 2 : 0,
            }}
            animate={{ opacity: 1, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, borderRadius: '16px' }}
            exit={{ opacity: 0, scale: 0.95, translateY: 12, borderRadius: '16px' }}
            transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* 헤더 */}
            <motion.div
              className="flex items-center justify-between px-6 py-4 border-b border-[rgb(255_255_255_/_0.08)] flex-shrink-0"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-1 h-5 rounded-full bg-[var(--color-cyan-core)] flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h2 id="modal-title" className="text-[17px] font-bold text-[var(--color-text-primary)] truncate">
                    {project.title}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {project.githubUrl && (
                  <Button variant="outline" leftIcon={<Icon name="share" />}
                    className={`border-[rgb(255_255_255_/_0.18)] text-[var(--color-text-primary)] hover:bg-[rgb(255_255_255_/_0.08)] focus-visible:ring-[var(--color-cyan-core)]`}
                    onClick={() => window.open(project.githubUrl, '_blank', 'noopener,noreferrer')}>
                    GitHub
                  </Button>
                )}
                {project.demoUrl && (
                  <Button leftIcon={<Icon name="arrow-right" />}
                    className={`bg-[var(--color-cyan-core)] text-[rgb(2_6_8)] hover:bg-[var(--color-cyan-hi)] focus-visible:ring-[var(--color-cyan-core)]`}
                    onClick={() => window.open(project.demoUrl, '_blank', 'noopener,noreferrer')}>
                    Live
                  </Button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-[rgb(255_255_255_/_0.42)] hover:text-[var(--color-text-primary)] hover:bg-[rgb(255_255_255_/_0.08)] rounded-lg transition-colors duration-150"
                  aria-label="닫기"
                >
                  <Icon name="close" size="medium" />
                </button>
              </div>
            </motion.div>

            {/* 콘텐츠 */}
            <motion.div
              ref={contentRef}
              className="overflow-y-auto flex-1 px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.26, duration: 0.3, ease: 'easeOut' }}
            >
              <div className="space-y-8">

                {/* 프로젝트 이미지 + 메타 */}
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  {/* 썸네일 */}
                  <div className={cn(
                    'relative bg-[rgb(255_255_255_/_0.06)] rounded-lg overflow-hidden flex-shrink-0',
                    project.imageAspect === 'portrait'  ? 'w-32 aspect-[9/16]' :
                    project.imageAspect === 'square'    ? 'w-40 aspect-square'  :
                    'w-full sm:w-64 aspect-video'
                  )}>
                    {imgLoading && (
                      <div className="absolute inset-0"><Skeleton variant="rectangular" className="w-full h-full bg-[rgb(255_255_255_/_0.06)]" /></div>
                    )}
                    {imgError ? (
                      <div className="flex items-center justify-center h-full">
                        <Icon name="image" size="large" className="text-[rgb(255_255_255_/_0.35)]" />
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
                      <p className="text-[13px] font-medium text-[var(--color-cyan-hi)] mb-2 leading-snug">{project.subtitle}</p>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {project.duration && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-0.5">기간</p>
                          <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">{project.duration}</p>
                        </div>
                      )}
                      {project.role && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-0.5">역할</p>
                          <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">{project.role}</p>
                        </div>
                      )}
                      {project.teamSize && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(255_255_255_/_0.42)] mb-0.5">팀</p>
                          <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">{project.teamSize}</p>
                        </div>
                      )}
                    </div>
                    {/* 태그 */}
                    {project.tags && project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {project.tags.map(tag => (
                          <span key={tag}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[rgb(255_255_255_/_0.06)] text-[var(--color-text-secondary)]">
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
                    <div className="border-t border-[rgb(255_255_255_/_0.10)] mb-6" />
                    <SectionLabel>프로젝트 요약</SectionLabel>
                    <OverviewBlock project={project} />
                  </div>
                )}

                {/* 프로젝트 리뷰: 카드 컨테이너로 시각적 격리 */}
                {project.reviews && project.reviews.length > 0 && (
                  <div ref={reviewSectionRef}>
                    <div className="border-t border-[rgb(255_255_255_/_0.10)] mb-6" />
                    <SectionLabel>Project Review</SectionLabel>

                    <div className="rounded-lg border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.04)] overflow-hidden">
                      {/* 탭 바 */}
                      {project.reviews.length > 1 && (
                        <div className="flex gap-1.5 px-5 pt-4 pb-3 overflow-x-auto border-b border-[rgb(255_255_255_/_0.08)] bg-transparent">
                          {project.reviews.map((review, index) => (
                            <button
                              key={review.id}
                              onClick={() => handleReviewTabChange(index)}
                              className={cn(
                                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0',
                                activeReviewTab === index
                                  ? 'bg-[var(--color-cyan-core)] text-[rgb(2_6_8)]'
                                  : 'bg-[rgb(255_255_255_/_0.06)] text-[var(--color-text-secondary)] hover:bg-[rgb(255_255_255_/_0.12)]'
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
                    <div className="border-t border-[rgb(255_255_255_/_0.10)] mb-6" />
                    <SectionLabel>기술 스택 & 선정 이유</SectionLabel>
                    <div className="space-y-2">
                      {project.techReasons.map((tech, index) => (
                        <div key={index} className="rounded-lg border border-[rgb(255_255_255_/_0.08)] overflow-hidden">
                          <div className="px-4 py-2.5 bg-[rgb(255_255_255_/_0.04)] border-b border-[rgb(255_255_255_/_0.08)]">
                            <span className="text-[12px] font-bold text-[var(--color-cyan-hi)]">{tech.name}</span>
                          </div>
                          <ul className="px-4 py-3 space-y-1.5">
                            {tech.reasons.map((reason, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-[5px] w-1 h-1 rounded-full bg-[rgb(255_255_255_/_0.2)] flex-shrink-0" />
                                <RichText text={reason} className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed" />
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
                    <div className="border-t border-[rgb(255_255_255_/_0.10)] mb-6" />
                    <SectionLabel>배운 점</SectionLabel>
                    <ul className="space-y-3">
                      {project.keyLearnings.map((learning, index) => {
                        const colonIdx = learning.indexOf(':');
                        const title   = colonIdx !== -1 ? learning.substring(0, colonIdx).trim() : '';
                        const content = colonIdx !== -1 ? learning.substring(colonIdx + 1).trim() : learning;
                        return (
                          <li key={index} className="flex items-start gap-3">
                            <span className="text-[10px] font-bold text-[var(--color-cyan-core)] mt-0.5 flex-shrink-0">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div>
                              {title && <p className="text-[12px] font-bold text-[var(--color-text-primary)] mb-0.5">{title}</p>}
                              <RichText text={content} className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed" />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* 구현 사항 */}
                {project.implementations && project.implementations.length > 0 && (
                  <div>
                    <div className="border-t border-[rgb(255_255_255_/_0.10)] mb-6" />
                    <SectionLabel>구현 사항</SectionLabel>
                    {/* 테이블형 2열 레이아웃 — 카테고리 라벨(좌) + 아이템(우) */}
                    <div className="rounded-lg border border-[rgb(255_255_255_/_0.08)] overflow-hidden">
                      {project.implementations.map((impl, index) => {
                        const isLast = index === project.implementations!.length - 1;
                        return (
                          <div
                            key={index}
                            className={cn(
                              'grid grid-cols-[6rem_1fr] sm:grid-cols-[8rem_1fr]',
                              !isLast && 'border-b border-[rgb(255_255_255_/_0.08)]'
                            )}
                          >
                            {/* 카테고리 라벨 열 */}
                            <div className="bg-[rgb(255_255_255_/_0.04)] px-3 py-4 flex items-start justify-end border-r border-[rgb(255_255_255_/_0.08)]">
                              <span className="text-[10px] font-bold tracking-wider text-[rgb(255_255_255_/_0.42)] uppercase text-right leading-snug pt-0.5">
                                {impl.category.replace(' 섹션', '')}
                              </span>
                            </div>
                            {/* 아이템 열 */}
                            <div className="px-4 py-3 space-y-2.5 bg-transparent">
                              {impl.items.map((text, itemIdx) => {
                                const isTechItem = text.startsWith('**');
                                return (
                                  <div key={itemIdx}>
                                    {isTechItem ? (
                                      <div className="rounded-md bg-[rgb(3_179_195_/_0.10)] border border-[var(--color-hairline)] px-3 py-2">
                                        <RichText text={text} className="text-[12px] text-[var(--color-text-primary)] leading-relaxed" />
                                      </div>
                                    ) : (
                                      <div className="flex items-start gap-2">
                                        <span className="mt-[6px] w-1 h-1 rounded-full bg-[rgb(255_255_255_/_0.2)] flex-shrink-0" />
                                        <RichText text={text} className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed" />
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

              </div>
            </motion.div>
          </motion.div>
    </Modal>
  );
}
