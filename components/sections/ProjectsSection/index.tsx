'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  calcGeometry,
  slotTransform,
  bandLineRects,
  DECK_SLOT_BORDER,
  DECK_SLOT_DIM,
  DECK_TRANSITION_MS,
  DECK_EASE,
  DECK_HEADER_H,
  DECK_META_H,
  type DeckGeometry,
} from '@/lib/utils/deckGeometry';
import { isProjectModalReady } from '@/lib/utils/projectContract';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import type { Project } from '@/types/index';
import { setProjectModalObscured } from '@/hooks/useProjectModalObscured';
import { useSectionActivity } from '@/components/common/SectionActivityContext';

const ProjectModal = dynamic(
  () => import('@/components/blocks/ProjectModal'),
  { ssr: false }
);

const N = projects.length;

// history.state에서 projectModalId 키만 걷어내고 나머지 필드(Next.js가
// 쓰는 것 포함)는 그대로 둔다. state가 객체가 아니면 빈 객체로 시작한다
function stripProjectModalId(state: unknown): Record<string, unknown> {
  const base: Record<string, unknown> =
    state && typeof state === 'object' ? { ...(state as Record<string, unknown>) } : {};
  delete base.projectModalId;
  return base;
}

// mount와 popstate가 공용하는 순수 판정. history를 읽지도 쓰지도 않고
// 인자만 본다 — 두 경로가 갈리면 새로고침 복구와 뒤로가기 복구가
// 다르게 동작한다(계획 5 T2 Task 9)
export function reconcileProjectModal(historyState: unknown): string | null {
  if (!historyState || typeof historyState !== 'object') return null;
  const id = (historyState as Record<string, unknown>).projectModalId;
  if (typeof id !== 'string') return null;
  const project = projects.find((p) => p.title === id);
  if (!project || !isProjectModalReady(project)) return null;
  return id;
}

// 카드 4개(또는 그 미만)만 재사용하고 슬롯 k -> projects[(active + k) % N]로
// 내용만 갈아 끼운다. 정본은 .claude/designRefactoring/2026-09-09-t2-implementation-spec.md §4
const LINE = 'rgb(255 255 255 / 0.08)';
const LINE_STRONG = 'rgb(255 255 255 / 0.14)';
const MUTED = 'rgb(255 255 255 / 0.62)';

// 카드 썸네일 영상 순환 주기. 정본은 스펙 §4.6
const CYCLE_MS = 3000;

export default function ProjectsSection() {
  const { active, pageVisible, motionReady, reducedMotion } = useSectionActivity();
  // SSR에는 window가 없어 기본값 1440x900으로 첫 렌더를 잡고 마운트 뒤 실측으로 덮는다
  const [geo, setGeo] = useState<DeckGeometry>(() => calcGeometry(N, 1440, 900));
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const slotRefs = useRef<(HTMLElement | null)[]>([]);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);
  const prevActiveRef = useRef(activeIndex);
  // 지금 열린 모달이 우리가 pushState한 항목인지 기억한다. 새로고침으로
  // 복구된 모달(우리가 push한 적 없는 항목)을 history.back()으로 닫으면
  // 직전 항목이 우리 사이트가 아닐 수 있어 페이지를 떠난다 — 그래서
  // pushedRef가 false일 때는 back() 대신 replaceState로 키만 지운다
  const pushedRef = useRef(false);

  const activeProject = projects[activeIndex];
  const videoList = useMemo(
    () =>
      (activeProject.implementations ?? [])
        .map((impl) => impl.video)
        .filter((v): v is string => Boolean(v)),
    [activeProject]
  );
  const hasVideo = videoList.length > 0;

  // 정지 조건은 하나로 모은다. 정본은 스펙 §4.6
  const playable =
    active === SECTION_IDS.PROJECTS &&
    !modalOpen &&
    pageVisible &&
    motionReady &&
    !reducedMotion;

  const [cycleIndex, setCycleIndex] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const currentSrc = hasVideo ? (videoList[cycleIndex] ?? null) : null;

  // 실제로 그릴 src. playable일 때만 currentSrc를 따라가고, 아니면 멈춘 자리를
  // 그대로 둔다. src를 놓는 것은 활성 카드가 바뀔 때(goTo가 cycleIndex를
  // 0으로 되돌릴 때)뿐이다
  const [committedSrc, setCommittedSrc] = useState<string | null>(null);
  useEffect(() => {
    if (playable) setCommittedSrc(currentSrc);
  }, [playable, currentSrc]);

  useEffect(() => {
    setMediaError(false);
  }, [activeIndex]);

  useEffect(() => {
    const video = videoElRef.current;
    if (!video) return;
    if (!playable) {
      video.pause();
      return;
    }
    // jsdom의 play()는 Promise를 돌려주지 않는다. 실제 브라우저의 거절만 조용히 삼킨다
    const playResult = video.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {});
    }
  }, [playable, committedSrc]);

  // 영상이 하나뿐이면 순환하지 않는다. onEnded가 3초를 기다리지 않고 다음으로 넘긴다
  useEffect(() => {
    if (!playable || videoList.length < 2) return;
    const timeout = setTimeout(() => {
      setCycleIndex((i) => (i + 1) % videoList.length);
    }, CYCLE_MS);
    return () => clearTimeout(timeout);
  }, [playable, videoList.length, cycleIndex]);

  const handleVideoEnded = useCallback(() => {
    setCycleIndex((i) => (videoList.length > 0 ? (i + 1) % videoList.length : 0));
  }, [videoList.length]);

  const handleMediaError = useCallback(() => {
    setMediaError(true);
  }, []);

  useEffect(() => {
    const measure = () => setGeo(calcGeometry(N, window.innerWidth, window.innerHeight));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    setProjectModalObscured(modalOpen);
  }, [modalOpen]);

  // 모달을 닫으면 Modal atom이 포커스를 opener로 돌려주려 하지만, 그 정리가
  // 도는 시점에는 셸의 격리 속성이 아직 안 벗겨졌다. 바로 위 effect가 그보다
  // 뒤에 돌기 때문이다. 그래서 atom은 opener가 갇혀 있다고 보고 포기하고,
  // 포커스는 사라진 닫기 버튼과 함께 문서 바닥으로 떨어진다. 한 프레임 뒤
  // 격리가 걷힌 다음 여기서 직접 돌려준다.
  // wasOpenRef가 없으면 첫 mount에서도 돌아 페이지를 열자마자 Projects
  // 카드로 포커스를 훔쳐 간다
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (modalOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;

    const raf = requestAnimationFrame(() => {
      const opener = slotRefs.current[0];
      const usable =
        !!opener?.isConnected && !opener.closest('[inert], [aria-hidden="true"]');
      const fallback = sectionRef.current?.closest<HTMLElement>('[data-section]') ?? null;
      (usable ? opener : fallback)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [modalOpen]);

  // modal-only History. mount와 단일 popstate 구독이 같은 함수
  // (applyReconciliation)를 쓴다 — 새로고침 복구와 뒤로가기 복구가 갈리지
  // 않게 하는 것이 이 배선의 요점이다. 유효한 id면 그 프로젝트로
  // activeIndex를 맞추고 모달을 열 뿐 push도 replace도 하지 않는다.
  // 무효한 id는 그 키만 replaceState로 지운다
  useEffect(() => {
    const applyReconciliation = () => {
      const state = window.history.state;
      const id = reconcileProjectModal(state);
      if (id) {
        const idx = projects.findIndex((p) => p.title === id);
        if (idx !== -1) setActiveIndex(idx);
        setModalOpen(true);
      } else {
        setModalOpen(false);
        if (state && typeof state === 'object' && 'projectModalId' in (state as object)) {
          window.history.replaceState(stripProjectModalId(state), '', window.location.hash);
        }
      }
      pushedRef.current = false;
    };

    applyReconciliation();
    window.addEventListener('popstate', applyReconciliation);
    return () => window.removeEventListener('popstate', applyReconciliation);
  }, []);

  // 슬롯 k의 목표 위치는 활성 카드가 바뀌어도 그대로다(위치는 slot에만 매인다).
  // 그래서 CSS transition만으로는 안 움직인다. 팬텀(한 칸 뒤) 위치로 순간 이동시킨
  // 뒤 목표로 되돌려 보내야 "한 칸 밀려온" 것처럼 보인다. geo만 바뀐 리렌더(리사이즈)는
  // prevActiveRef로 걸러 건드리지 않는다. 즉시 재배치는 렌더의 transition:none이 맡는다
  useLayoutEffect(() => {
    const prevActive = prevActiveRef.current;
    prevActiveRef.current = activeIndex;
    if (prevActive === activeIndex) return;
    if (!geo.isDeck || reducedMotion) return;

    const renderCount = Math.min(4, N);
    const els = slotRefs.current.slice(0, renderCount);

    els.forEach((el, k) => {
      if (!el) return;
      el.style.transition = 'none';
      el.style.transform = slotTransform(Math.min(k + 1, 4), geo.cardW, geo.cardH);
      el.style.opacity = k === 3 ? '0' : '1';
    });

    // 강제 리플로우. 위 팬텀 위치를 트랜지션 없이 먼저 그리게 한다
    void els[0]?.offsetHeight;

    const raf = requestAnimationFrame(() => {
      els.forEach((el, k) => {
        if (!el) return;
        el.style.transition = `transform ${DECK_TRANSITION_MS}ms ${DECK_EASE}, opacity ${DECK_TRANSITION_MS}ms ${DECK_EASE}`;
        el.style.transform = slotTransform(k, geo.cardW, geo.cardH);
        el.style.opacity = '1';
      });
    });

    const timeout = setTimeout(() => {
      els.forEach((el) => {
        if (!el) return;
        el.style.transition = 'none';
      });
    }, DECK_TRANSITION_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [activeIndex, geo, reducedMotion]);

  const openModal = useCallback(() => {
    // 기존 state를 펼쳐 담는다 — Next.js가 쓰는 필드를 날리면 안 된다
    window.history.pushState(
      { ...window.history.state, projectModalId: activeProject.title },
      '',
      window.location.hash
    );
    pushedRef.current = true;
    setModalOpen(true);
  }, [activeProject]);

  const closeModal = useCallback(() => {
    if (pushedRef.current) {
      // 우리가 push한 항목이다 — 그 앞 항목은 항상 우리 사이트다
      window.history.back();
    } else {
      // 새로고침으로 복구된 모달이다. 앞 항목이 우리 사이트가 아닐 수
      // 있으므로 back() 대신 키만 지운다
      window.history.replaceState(
        stripProjectModalId(window.history.state),
        '',
        window.location.hash
      );
    }
    pushedRef.current = false;
    setModalOpen(false);
  }, []);

  const goTo = useCallback((next: number) => {
    setActiveIndex(next);
    setCycleIndex(0);
    chipRefs.current[next]?.focus();
  }, []);

  const handleIndexKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      let next: number | null = null;
      if (event.key === 'ArrowLeft') next = (activeIndex - 1 + N) % N;
      else if (event.key === 'ArrowRight') next = (activeIndex + 1) % N;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = N - 1;

      if (next === null) return;
      event.preventDefault();
      goTo(next);
    },
    [activeIndex, goTo]
  );

  const renderCount = geo.isDeck ? Math.min(4, N) : Math.min(1, N);
  const bandRects = geo.isDeck ? bandLineRects(geo) : [];

  return (
    <section
      ref={sectionRef}
      id={SECTION_IDS.PROJECTS}
      className="py-20 px-10 flex flex-col items-center"
    >
      <h2 className="sr-only">Projects</h2>

      <div
        className="relative mx-auto"
        style={{ width: Math.round(geo.cardW), marginBottom: 24 }}
      >
        {geo.bandLines > 0 && (
          <div
            data-part="band"
            className="relative mx-auto"
            style={{ width: Math.round(geo.cardW), height: geo.bandHeight }}
          >
            {bandRects.map((rect, j) => (
              <div
                key={j}
                data-band={j}
                className="absolute h-px"
                style={{
                  left: rect.left,
                  width: rect.width,
                  bottom: rect.bottom,
                  background: LINE_STRONG,
                }}
              />
            ))}
          </div>
        )}

        <div
          data-part="deck"
          className="relative"
          style={{
            width: Math.round(geo.cardW),
            height: Math.round(geo.cardH),
            marginTop: geo.isDeck ? 132 : 0,
            perspective: geo.isDeck ? 900 : undefined,
          }}
        >
          {Array.from({ length: renderCount }, (_, k) => {
            const globalIndex = (activeIndex + k) % N;
            const project = projects[globalIndex];
            return (
              <DeckCard
                key={k}
                slot={k}
                globalIndex={globalIndex}
                project={project}
                geo={geo}
                cardRef={(el) => {
                  slotRefs.current[k] = el;
                }}
                onOpen={k === 0 ? openModal : undefined}
                onSelect={k > 0 ? goTo : undefined}
                media={
                  k === 0
                    ? {
                        hasVideo,
                        videoSrc: committedSrc,
                        mediaError,
                        onVideoEnded: handleVideoEnded,
                        onMediaError: handleMediaError,
                        setVideoEl: (el) => {
                          videoElRef.current = el;
                        },
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      <nav
        data-part="index"
        role="tablist"
        aria-label="프로젝트 목록"
        className="self-stretch flex flex-wrap gap-3 pt-3"
        style={{ borderTop: `1px solid ${LINE_STRONG}` }}
        onKeyDown={handleIndexKeyDown}
      >
        {projects.map((project, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={project.title}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              data-chip={i}
              aria-selected={isActive}
              aria-label={project.title}
              tabIndex={isActive ? 0 : -1}
              onClick={() => goTo(i)}
              className={`relative w-11 h-11 shrink-0 bg-transparent border-0 text-[13px] tabular-nums flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-core)] ${
                isActive
                  ? "text-[var(--color-text-primary)] after:content-[''] after:absolute after:left-2 after:right-2 after:bottom-1 after:h-0.5 after:bg-[var(--color-cyan-core)]"
                  : ''
              }`}
              style={{ color: isActive ? undefined : MUTED }}
            >
              {String(i + 1).padStart(2, '0')}
            </button>
          );
        })}
      </nav>

      <ProjectModal isOpen={modalOpen} onClose={closeModal} project={modalOpen ? activeProject : null} />
    </section>
  );
}

interface DeckCardMedia {
  hasVideo: boolean;
  videoSrc: string | null;
  mediaError: boolean;
  onVideoEnded: () => void;
  onMediaError: () => void;
  setVideoEl: (el: HTMLVideoElement | null) => void;
}

interface DeckCardProps {
  slot: number;
  globalIndex: number;
  project: Project;
  geo: DeckGeometry;
  cardRef: (el: HTMLElement | null) => void;
  onOpen?: () => void;
  onSelect?: (globalIndex: number) => void;
  media?: DeckCardMedia;
}

function DeckCard({ slot, globalIndex, project, geo, cardRef, onOpen, onSelect, media }: DeckCardProps) {
  const isFeatured = slot === 0;
  const ready = isFeatured && isProjectModalReady(project);
  // 카드는 <button>이라 내용이 기본 세로 중앙 정렬된다. flex-col + items-stretch가
  // 없으면 프리뷰가 405px이어야 할 자리에서 17px로 무너진다
  const className = 'absolute inset-0 bg-[#0a0a0a] border overflow-hidden text-left flex flex-col items-stretch';
  // 렌더가 세팅하는 transform은 항상 목표 위치다. transition은 기본 none이라
  // geo만 바뀌는 리사이즈는 트랜지션 없이 그 자리로 즉시 스냅한다. 인덱스 전환
  // 애니메이션은 부모의 useLayoutEffect가 이 스타일을 일시적으로 덮어써서 만든다
  const style: React.CSSProperties = {
    borderColor: DECK_SLOT_BORDER[slot],
    filter: `brightness(${DECK_SLOT_DIM[slot]})`,
    transition: 'none',
    transform: geo.isDeck ? slotTransform(slot, geo.cardW, geo.cardH) : undefined,
    opacity: 1,
    zIndex: 4 - slot,
  };

  const content = (
    <>
      <div
        data-part="header"
        className="shrink-0 flex items-center gap-2.5 px-4"
        style={{ height: DECK_HEADER_H, borderBottom: `1px solid ${LINE}` }}
      >
        <span className="text-[13px] tabular-nums" style={{ color: MUTED }}>
          {String(globalIndex + 1).padStart(2, '0')}
        </span>
        <span
          className={`font-semibold whitespace-nowrap overflow-hidden text-ellipsis text-[var(--color-text-primary)] ${isFeatured ? 'text-[17px]' : 'text-[15px]'}`}
        >
          {project.title}
        </span>
      </div>

      {isFeatured && media && (
        <>
          <div
            data-part="preview"
            aria-hidden="true"
            className="relative"
            style={{ flex: '1 1 auto', minHeight: 0, background: 'rgb(255 255 255 / 0.06)' }}
          >
            {media.mediaError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-4">
                <span className="text-[13px] tabular-nums" style={{ color: MUTED }}>
                  {String(globalIndex + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                  {project.title}
                </span>
                <span className="text-[11px]" style={{ color: MUTED }}>
                  MEDIA UNAVAILABLE
                </span>
              </div>
            ) : media.hasVideo ? (
              <video
                ref={media.setVideoEl}
                data-part="preview-video"
                aria-hidden="true"
                muted
                playsInline
                poster={project.image}
                src={media.videoSrc ?? undefined}
                onEnded={media.onVideoEnded}
                onError={media.onMediaError}
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
              />
            ) : (
              <Image
                data-part="preview-image"
                src={project.image}
                alt={project.title}
                fill
                sizes="(max-width: 1024px) 100vw, 520px"
                className="object-cover pointer-events-none"
                onError={media.onMediaError}
              />
            )}
          </div>
          <div
            data-part="meta"
            className="shrink-0 flex flex-col justify-center gap-2 px-4"
            style={{ height: DECK_META_H }}
          >
            <div className="text-[13px]" style={{ color: MUTED }}>
              {[project.duration, project.role, project.teamSize].filter(Boolean).join(' · ')}
            </div>
            <div className="flex flex-wrap gap-2">
              {project.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[11px]"
                  style={{
                    padding: '3px 8px',
                    border: `1px solid ${LINE_STRONG}`,
                    borderRadius: 3,
                    color: 'rgb(255 255 255 / 0.7)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  if (isFeatured && ready) {
    return (
      <button
        ref={(el) => cardRef(el)}
        type="button"
        data-slot={slot}
        data-global-index={globalIndex}
        aria-label={project.title}
        className={className}
        style={style}
        onClick={onOpen}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      ref={(el) => cardRef(el)}
      data-slot={slot}
      data-global-index={globalIndex}
      aria-hidden={!isFeatured || undefined}
      tabIndex={-1}
      onClick={onSelect ? () => onSelect(globalIndex) : undefined}
      className={className}
      style={style}
    >
      {content}
    </div>
  );
}
