'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { isProjectModalReady } from '@/lib/utils/projectContract';
import { projects } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
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

const LINE_STRONG = 'rgb(255 255 255 / 0.14)';
const MUTED = 'rgb(255 255 255 / 0.62)';

// 프로젝트 프리뷰 영상 순환 주기. 정본은 스펙 §4.6
const CYCLE_MS = 3000;

export default function ProjectsSection() {
  const { active, pageVisible, motionReady, reducedMotion } = useSectionActivity();
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const nameRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);
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

  // 정지 조건은 하나로 모은다. 정본은 스펙 §4.6. 호버로 프리뷰가 갈려도
  // 이 식에 호버는 안 들어가므로 계속 재생한다
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
  // 그대로 둔다. src를 놓는 것은 활성 프로젝트가 바뀔 때(goTo가 cycleIndex를
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
    setProjectModalObscured(modalOpen);
  }, [modalOpen]);

  // 모달을 닫으면 Modal atom이 포커스를 opener로 돌려주려 하지만, 그 정리가
  // 도는 시점에는 셸의 격리 속성이 아직 안 벗겨졌다. 바로 위 effect가 그보다
  // 뒤에 돌기 때문이다. 그래서 atom은 opener가 갇혀 있다고 보고 포기하고,
  // 포커스는 사라진 닫기 버튼과 함께 문서 바닥으로 떨어진다. 한 프레임 뒤
  // 격리가 걷힌 다음 여기서 직접 돌려준다.
  // wasOpenRef가 없으면 첫 mount에서도 돌아 페이지를 열자마자 Projects
  // 이름 버튼으로 포커스를 훔쳐 간다
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (modalOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;

    const raf = requestAnimationFrame(() => {
      const opener = nameRefs.current[activeIndex];
      const usable =
        !!opener?.isConnected && !opener.closest('[inert], [aria-hidden="true"]');
      const fallback = sectionRef.current?.closest<HTMLElement>('[data-section]') ?? null;
      (usable ? opener : fallback)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [modalOpen, activeIndex]);

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

  const openModal = useCallback((title: string) => {
    // 기존 state를 펼쳐 담는다 — Next.js가 쓰는 필드를 날리면 안 된다
    window.history.pushState(
      { ...window.history.state, projectModalId: title },
      '',
      window.location.hash
    );
    pushedRef.current = true;
    setModalOpen(true);
  }, []);

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

  // 호버·포커스·키보드가 모두 이 하나로 선택을 옮긴다. focus 옵션은 키보드
  // 경로 전용이다 — 호버가 포커스를 훔치면 방향키 탐색과 스크린리더가 어긋난다
  const goTo = useCallback((next: number, opts?: { focus?: boolean }) => {
    setActiveIndex(next);
    setCycleIndex(0);
    if (opts?.focus) nameRefs.current[next]?.focus();
  }, []);

  // 클릭은 항상 선택을 옮긴다. 계약을 통과한 프로젝트만 추가로 펼침을 연다.
  // 계약 미달 프로젝트도 목록에 서고 프리뷰 전환은 되지만 눌러도 안 펼쳐진다
  const handleNameClick = useCallback(
    (i: number) => {
      goTo(i);
      if (isProjectModalReady(projects[i])) {
        openModal(projects[i].title);
      }
    },
    [goTo, openModal]
  );

  const handleIndexKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      let next: number | null = null;
      if (event.key === 'ArrowUp') next = (activeIndex - 1 + N) % N;
      else if (event.key === 'ArrowDown') next = (activeIndex + 1) % N;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = N - 1;

      if (next === null) return;
      event.preventDefault();
      goTo(next, { focus: true });
    },
    [activeIndex, goTo]
  );

  return (
    <section
      ref={sectionRef}
      id={SECTION_IDS.PROJECTS}
      className="py-6 px-10"
    >
      <h2 className="sr-only">Projects</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr]">
        <div className="flex items-center">
          <div
            data-part="preview"
            aria-hidden="true"
            data-flip-id={`pv-${activeProject.title}`}
            className="w-full lg:w-[60%] aspect-video"
          >
            <div className="relative h-full w-full" style={{ background: 'rgb(255 255 255 / 0.06)' }}>
              {mediaError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-4">
                  <span className="text-[13px] tabular-nums" style={{ color: MUTED }}>
                    {String(activeIndex + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                    {activeProject.title}
                  </span>
                  <span className="text-[11px]" style={{ color: MUTED }}>
                    MEDIA UNAVAILABLE
                  </span>
                </div>
              ) : hasVideo ? (
                <video
                  ref={(el) => {
                    videoElRef.current = el;
                  }}
                  data-part="preview-video"
                  aria-hidden="true"
                  muted
                  playsInline
                  poster={activeProject.image}
                  src={committedSrc ?? undefined}
                  onEnded={handleVideoEnded}
                  onError={handleMediaError}
                  className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                />
              ) : (
                <Image
                  data-part="preview-image"
                  src={activeProject.image}
                  alt={activeProject.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover pointer-events-none"
                  onError={handleMediaError}
                />
              )}
            </div>
          </div>
        </div>

        <div className="lg:pl-10">
          <div className="flex items-center gap-3">
            <span
              className="text-t8 uppercase tracking-[0.2em]"
              style={{ color: MUTED }}
            >
              MY PROJECTS
            </span>
            <span className="flex-1 h-px" style={{ background: LINE_STRONG }} />
          </div>

          <div
            data-part="index"
            role="tablist"
            aria-orientation="vertical"
            aria-label="프로젝트 목록"
            className="mt-6 flex flex-col"
            onKeyDown={handleIndexKeyDown}
          >
            {projects.map((project, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={project.title}
                  ref={(el) => {
                    nameRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  data-name={i}
                  data-flip-id={isActive ? `title-${project.title}` : undefined}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleNameClick(i)}
                  onMouseEnter={() => goTo(i)}
                  onFocus={() => goTo(i)}
                  className={`block w-full text-left text-t1 leading-[1.35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-core)] ${
                    isActive ? 'text-[var(--color-text-primary)]' : ''
                  }`}
                  style={{ color: isActive ? undefined : MUTED }}
                >
                  {project.title}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ProjectModal isOpen={modalOpen} onClose={closeModal} project={modalOpen ? activeProject : null} />
    </section>
  );
}
