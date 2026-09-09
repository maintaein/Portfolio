// components/blocks/ProjectModal/index.tsx
'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import Image from 'next/image';
import Modal from '@/components/atoms/Modal';
import Icon from '@/components/atoms/Icon';
import { cn } from '@/lib/utils/cn';
import { RichText } from '@/lib/utils/richText';
import { parseAnalysisEntry, selectFeaturedReview } from '@/lib/utils/projectContract';
import type { AnalysisEntry } from '@/lib/utils/projectContract';
import type { Project } from '@/types/project';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  // 펼침 stage가 DOM에 박히거나 빠지는 순간을 부모에게 알린다. 부모가 이 시점에
  // GSAP Flip을 태운다. 모달이 지연 로드라 부모의 layout effect로는 못 잡는다
  onStageMount?: (el: HTMLDivElement | null) => void;
}

// 색은 세 단만 쓴다. T1이 가장 밝고, T3가 검정 판 위에서 7.76:1을 지키는
// 하한이다(0.42 -> 0.50 -> 0.62로 두 번 올렸다). 시안은 글자색으로 쓰지 않는다.
const T1 = 'text-[var(--color-text-primary)]';
const T2 = 'text-[var(--color-text-secondary)]';
const T3 = 'text-[rgb(255_255_255_/_0.62)]';
const LINE = 'border-[rgb(255_255_255_/_0.08)]';
const LINE_STRONG = 'border-[rgb(255_255_255_/_0.12)]';

// 동기부여 글의 첫 문장이 주장(h3), 나머지가 본문이다. 데이터에 문장 분리
// 마커를 두지 않았으므로 마침표/물음표/느낌표로 가른다.
function splitFirstSentence(text: string): { claim: string; body: string } {
  const match = text.match(/^(.+?[.!?])\s*([\s\S]*)$/);
  if (!match) return { claim: text, body: '' };
  return { claim: match[1], body: match[2] };
}

// 판 2의 축선 위에만 구슬 표식이 박힌다(시안 .axis .sub-step::before).
// 판 1의 '구현 기능'은 축 밖이라 표식이 없다. before 의사요소로 그려
// outline으로 판 배경색 테를 둘러 축선을 끊는다.
function SubStep({ children, axis = false }: { children: React.ReactNode; axis?: boolean }) {
  return (
    <h4
      className={cn(
        'relative mt-[34px] text-t7 font-bold tracking-[0.02em]',
        axis &&
          cn(
            'pm-substep-dot',
            'before:absolute before:left-[-22px] before:top-[7px] before:h-[5px] before:w-[5px]',
            'before:rounded-full before:content-[""]',
            // LINE_STRONG(border-[rgb(255_255_255_/_0.12)])과 같은 색을 배경으로 쓴다.
            // Tailwind는 소스를 바이트로 훑으므로 리터럴로 적어야 규칙이 생성된다.
            'before:bg-[rgb(255_255_255_/_0.12)]',
            'before:[outline:3px_solid_rgb(6_8_10_/_0.97)]'
          ),
        T1
      )}
    >
      {children}
    </h4>
  );
}

// 1100px 아래에서 두 판을 한 열로 접는다. .scroll과 판 1의 상자를
// contents 값으로 열어 자식을 #pm-shell의 직계 flex 항목으로 올리고
// 순서값으로 다시 세운다. 순서값 없이 남는 자식은 맨 앞으로 튀므로
// 전부 감추고 살릴 것만 골라 순서를 붙인다. 상자를 여는 쪽은 padding을
// 못 만들어 자식이 나눠 든다. evidence는 최소 높이를 0으로 물고 있어
// 줄어들지 않게 막아야 영상이 짜부라지지 않는다. 색은 판 배경과 같은
// 불투명 검정으로 덮어 스크롤되는 내용이 비치지 않게 한다(흐림 효과는
// 대비를 부순다).
const NARROW_PANEL_CSS = `
@media (max-width: 1100px) {
  /* Modal 아톰은 다른 모달도 쓰므로 못 고친다. 좁은 판에서만 바깥 여백을
     걷어내고, role=dialog부터 #pm-shell까지 height:100%로 확정 높이
     사슬을 세운다. #pm-shell은 id라 :has() 명시도가 Tailwind 단일
     클래스를 이긴다. 셋 다 #pm-shell을 조상으로 두는 것만 잡아 다른
     모달에는 번지지 않는다 */
  div:has(> [role="dialog"] > div > #pm-shell) {
    padding: 0;
  }
  [role="dialog"]:has(> div > #pm-shell) {
    height: 100%;
  }
  [role="dialog"]:has(> div > #pm-shell) > div:has(> #pm-shell) {
    height: 100%;
  }

  #pm-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-radius: 0;
    outline: 0;
  }
  #pm-shell [data-modal-part="scroll"] { display: contents; }
  #pm-shell [data-modal-part="scroll"] > div { display: none; }

  #pm-shell [data-modal-part="head"] {
    order: 1;
    flex: none;
    position: sticky;
    top: 0;
    z-index: 3;
    background: rgb(6 8 10);
    padding-left: calc(max(0px, (100% - 700px) / 2) + 20px);
    padding-right: calc(max(0px, (100% - 700px) / 2) + 12px);
  }

  #pm-shell [data-modal-panel="1"] { display: contents; }
  #pm-shell [data-modal-panel="1"] > * { display: none; }
  #pm-shell [data-modal-panel="1"] > [data-modal-field="sub"],
  #pm-shell [data-modal-panel="1"] > [data-modal-field="meta"] {
    display: block;
    order: 2;
    flex: none;
    max-width: 700px;
    margin-inline: auto;
    width: 100%;
  }
  #pm-shell [data-modal-panel="1"] > [data-modal-field="sub"] { padding: 20px 20px 0; }
  #pm-shell [data-modal-panel="1"] > [data-modal-field="meta"] { padding: 0 20px 18px; }

  #pm-shell [data-modal-part="evidence"] {
    order: 3;
    flex: none;
    display: block;
    padding: 0;
    border-right: 0;
    background: none;
    max-width: 700px;
    margin-inline: auto;
    width: 100%;
  }
  #pm-shell [data-modal-part="stage"] { margin: 0 20px; }
  #pm-shell .pm-vidnav { display: grid; }
  #pm-shell .pm-vidnav::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }
  #pm-shell .pm-axis { left: 20px; }
  #pm-shell .pm-substep-dot::before { left: -18px; }

  #pm-shell [data-modal-part="caption"] {
    padding: 14px 20px 26px;
    margin-top: 0;
    border-top: 0;
    gap: 16px;
  }
  #pm-shell .pm-cap-label { font-size: 13px; }
  #pm-shell .pm-cap-name { font-size: 22px; }
  #pm-shell .pm-vidx { font-size: 13px; margin-top: 2px; }

  #pm-shell [data-modal-panel="1"] > [data-modal-field="chips"] {
    display: flex;
    order: 4;
    flex: none;
    max-width: 700px;
    margin-inline: auto;
    width: 100%;
    padding: 0 20px;
    margin-top: 0;
  }

  #pm-shell [data-modal-panel="2"] {
    order: 5;
    flex: none;
    max-width: 700px;
    margin-inline: auto;
    width: 100%;
    padding: 26px 20px 48px 38px;
  }
}
`;

export default function ProjectModal({ isOpen, onClose, project, onStageMount }: ProjectModalProps) {
  const [feat, setFeat] = useState(0);
  // 자동재생 muted loop 영상의 정지 상태. WCAG 2.2.2가 5초 넘는 자동재생에
  // 정지 수단을 요구한다. 무대를 넘겨도(setFeat) 이 상태는 그대로 간다.
  const [playing, setPlaying] = useState(true);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  // 좁은 판의 스와이프 시작 x좌표. 40px 임계를 넘으면 무대를 넘긴다.
  const touchStartXRef = useRef<number | null>(null);

  // 프로젝트가 바뀔 때마다 무대를 첫 기능으로 되돌리고 재생을 재개한다.
  useEffect(() => {
    setFeat(0);
    setPlaying(true);
  }, [project]);

  // 무대에 올라간 영상만 재생/정지한다. jsdom에서 play()는 undefined를
  // 돌려주므로 Promise 취급하면 깨진다. playing이 꺼져 있으면 무대를
  // 넘겨도(feat 변경) 새 영상이 자동재생되지 않고 정지 상태를 유지한다.
  useEffect(() => {
    const video = videoRefs.current[feat];
    if (!video) return;
    if (!playing) {
      video.pause();
      return;
    }
    const playResult = video.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {});
    }
  }, [feat, project, playing]);

  if (!project) return null;

  const impls = project.implementations ?? [];
  const active = impls[feat] ?? impls[0] ?? null;
  const review = selectFeaturedReview(project);
  const analysisEntries: AnalysisEntry[] = (review?.analysis ?? [])
    .map(parseAnalysisEntry)
    .filter((entry): entry is AnalysisEntry => entry !== null);
  const diagnosis = analysisEntries.find((entry) => entry.kind === 'diagnosis') ?? null;
  const options = analysisEntries.filter((entry) => entry.kind === 'option');
  const metric = review?.result?.[0] ?? null;
  const motivation = splitFirstSentence(project.motivation ?? '');
  const metaLine = [project.duration, project.role, project.teamSize].filter(Boolean);

  // 좁은 판에서 구현 기능 목록이 내려간 자리를 화살표와 스와이프가 대신한다.
  // 넓은 판의 목록과 같은 setFeat을 쓴다. 새 상태를 만들지 않는다.
  const goFeat = (delta: number) => {
    if (impls.length === 0) return;
    setFeat((f) => (f + delta + impls.length) % impls.length);
  };
  const togglePlaying = () => setPlaying((p) => !p);
  const handleStageTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };
  const handleStageTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const x0 = touchStartXRef.current;
    touchStartXRef.current = null;
    if (x0 === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
    if (Math.abs(dx) > 40) goFeat(dx < 0 ? 1 : -1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="large"
      showCloseButton={false}
      ariaLabelledBy="pm-title"
      className="max-w-none max-h-none bg-transparent shadow-none [&>div]:min-h-0 [&>div]:overflow-visible [&>div]:p-0"
    >
      <div
        id="pm-shell"
        className={cn(
          'fixed inset-0 grid',
          'grid-cols-[3fr_2fr] grid-rows-[64px_minmax(0,1fr)]',
          'overflow-hidden bg-[rgb(6_8_10_/_0.97)]',
          // 한국어는 어절 중간에서 끊기면 안 읽힌다. balance만으로는 부족하다.
          '[word-break:keep-all] [overflow-wrap:anywhere] [text-wrap:pretty] [-webkit-font-smoothing:antialiased]'
        )}
      >
        {/* 1100px 아래 재배치는 순수 CSS 미디어 쿼리라 자바스크립트로
            흉내 낼 이유가 없다 */}
        <style>{NARROW_PANEL_CSS}</style>
        {/* 머리. 논증 열 위에서 우측 전체 폭을 쓴다 */}
        <header
          data-modal-part="head"
          className={cn(
            'col-start-2 row-start-1 flex items-center justify-between gap-3',
            'border-b bg-[rgb(255_255_255_/_0.04)] pl-7 pr-5',
            LINE
          )}
        >
          <h2
            id="pm-title"
            data-flip-id={`title-${project.title}`}
            className={cn('truncate text-t3 font-bold tracking-[-0.02em]', T1)}
          >
            {project.title}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'grid h-11 place-items-center rounded-lg border px-3.5 text-t7 font-semibold',
                  'transition-colors hover:bg-[rgb(255_255_255_/_0.06)] hover:text-[var(--color-text-primary)]',
                  'hover:border-[var(--color-cyan-core)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-cyan-hi)]',
                  LINE_STRONG,
                  T2
                )}
              >
                GitHub
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className={cn(
                'grid h-11 w-11 place-items-center rounded-lg transition-colors',
                'hover:bg-[rgb(255_255_255_/_0.06)] hover:text-[var(--color-text-primary)]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-cyan-hi)]',
                T3
              )}
            >
              <Icon name="close" size="medium" />
            </button>
          </div>
        </header>

        {/* 증거. 열 하나를 처음부터 끝까지 차지한다 */}
        <section
          data-modal-part="evidence"
          aria-label="프로젝트 화면"
          className={cn(
            'col-start-1 row-start-1 row-end-[-1] grid content-center overflow-hidden',
            'min-w-0 min-h-0 border-r bg-[rgb(0_0_0_/_0.35)] p-5',
            LINE
          )}
        >
          <div
            data-modal-part="stage"
            data-flip-id={`pv-${project.title}`}
            ref={onStageMount}
            className="relative grid justify-items-center gap-0"
            onTouchStart={handleStageTouchStart}
            onTouchEnd={handleStageTouchEnd}
          >
            {impls.length > 0 ? (
              impls.map((impl, i) => (
                <figure key={i} data-feat={i} hidden={i !== feat} className="w-full">
                  {impl.video ? (
                    <video
                      ref={(el) => {
                        videoRefs.current[i] = el;
                      }}
                      src={impl.video}
                      muted
                      loop
                      playsInline
                      className="block aspect-video w-full rounded-lg border border-[rgb(255_255_255_/_0.08)] bg-[rgb(0_0_0)] object-cover"
                    />
                  ) : (
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-[rgb(255_255_255_/_0.08)] bg-[rgb(0_0_0)]">
                      <Image
                        src={project.image}
                        alt={project.title}
                        fill
                        sizes="(max-width: 1100px) 100vw, 780px"
                        className="object-cover"
                      />
                    </div>
                  )}
                </figure>
              ))
            ) : (
              <figure data-feat={0} className="w-full">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-[rgb(255_255_255_/_0.08)] bg-[rgb(0_0_0)]">
                  <Image
                    src={project.image}
                    alt={project.title}
                    fill
                    sizes="(max-width: 1100px) 100vw, 780px"
                    className="object-cover"
                  />
                </div>
              </figure>
            )}

            {impls.length > 1 && (
              <>
                {/* 좁은 판 전용 손잡이. 구현 기능 목록이 사라진 자리에서
                    무대를 넘긴다. 넓은 판에서는 display:none이다 */}
                <button
                  type="button"
                  onClick={() => goFeat(-1)}
                  aria-label="이전 기능 영상"
                  className={cn(
                    'pm-vidnav absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center',
                    'rounded-full bg-[rgb(0_0_0_/_0.55)]',
                    'hover:bg-[rgb(0_0_0_/_0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-cyan-hi)]',
                    T1
                  )}
                >
                  <Icon name="chevron-left" size="small" />
                </button>
                <button
                  type="button"
                  onClick={() => goFeat(1)}
                  aria-label="다음 기능 영상"
                  className={cn(
                    'pm-vidnav absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center',
                    'rounded-full bg-[rgb(0_0_0_/_0.55)]',
                    'hover:bg-[rgb(0_0_0_/_0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-cyan-hi)]',
                    T1
                  )}
                >
                  <Icon name="chevron-right" size="small" />
                </button>
              </>
            )}

            {active?.video && (
              <button
                type="button"
                onClick={togglePlaying}
                aria-label={playing ? '영상 일시정지' : '영상 재생'}
                className={cn(
                  'absolute bottom-[10px] right-[10px] grid h-9 w-9 place-items-center rounded-full',
                  'after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2',
                  'after:-translate-y-1/2 after:content-[""]',
                  'bg-[rgb(0_0_0_/_0.72)] border',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]',
                  LINE_STRONG,
                  T1
                )}
              >
                <Icon name={playing ? 'pause' : 'play'} size="small" />
              </button>
            )}
          </div>

          {active && (
            <div
              data-modal-part="caption"
              aria-live="polite"
              className={cn('mt-3 flex items-start justify-between gap-6 border-t pt-3', LINE)}
            >
              <div className="min-w-0">
                <p className={cn('pm-cap-label text-t7 font-bold tracking-[0.02em]', T2)}>구현 기능</p>
                <p
                  className={cn(
                    'pm-cap-name mt-0.5 text-t3 font-bold leading-[1.25] tracking-[-0.02em]',
                    T1
                  )}
                >
                  {active.category}
                </p>
                <p className={cn('mt-1 text-t6 leading-[1.55]', T2)}>{active.items[0]}</p>
              </div>
              <p className={cn('pm-vidx flex-none text-t7 font-bold tabular-nums tracking-[0.08em]', T3)}>
                <b className={T2}>{String(feat + 1).padStart(2, '0')}</b> /{' '}
                {String(impls.length).padStart(2, '0')}
              </p>
            </div>
          )}
        </section>

        {/* 논증. 스크롤은 이 상자 하나만 한다 */}
        <div
          data-modal-part="scroll"
          className="col-start-2 row-start-2 min-h-0 overflow-y-auto px-7 pb-14 [&>*]:max-w-[700px]"
        >
          {/* 판 1 · 프로젝트 */}
          <article data-modal-panel="1" className="py-7">
            {project.subtitle && (
              <p
                data-modal-field="sub"
                className={cn('text-t5 font-semibold leading-[1.45] tracking-[-0.01em]', T1)}
              >
                {project.subtitle}
              </p>
            )}
            {metaLine.length > 0 && (
              <p data-modal-field="meta" className={cn('mt-2.5 text-t7 tracking-[0.02em]', T2)}>
                {project.duration}
                {project.role && (
                  <>
                    {' '}
                    · <strong className={cn('font-bold', T1)}>{project.role}</strong>
                  </>
                )}
                {project.teamSize && <> · {project.teamSize}</>}
              </p>
            )}

            <div className={cn('mt-5 border-t', LINE)} />

            <p
              data-modal-field="step"
              className={cn('mb-3.5 mt-5 flex items-center gap-2 text-t6 font-bold tracking-[-0.01em]', T1)}
            >
              <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--color-cyan-core)]" />
              프로젝트
            </p>
            <h3
              data-modal-field="claim"
              className={cn('text-t3 font-bold leading-[1.25] tracking-[-0.02em]', T1)}
            >
              {motivation.claim}
            </h3>
            {motivation.body && (
              <div data-modal-field="body" className={cn('mt-3.5 text-t6 leading-[1.75]', T2)}>
                <RichText text={motivation.body} />
              </div>
            )}

            {impls.length > 0 && (
              <>
                <SubStep>구현 기능</SubStep>
                <div className={cn('mt-4 border-t', LINE)}>
                  {impls.map((impl, i) => {
                    const isActive = i === feat;
                    return (
                      <button
                        key={i}
                        type="button"
                        data-feat={i}
                        aria-current={isActive}
                        onClick={() => setFeat(i)}
                        className={cn(
                          'grid w-full grid-cols-[auto_1fr] items-baseline gap-3.5 border-b border-b-[rgb(255_255_255_/_0.08)]',
                          'py-4 pl-0.5 pr-2 text-left transition-colors hover:bg-[rgb(255_255_255_/_0.04)]',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]'
                        )}
                      >
                        <span
                          className={cn(
                            'text-t7 font-bold tabular-nums tracking-[0.04em]',
                            isActive ? T1 : T3
                          )}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span>
                          <span
                            className={cn('block text-t6 font-semibold leading-[1.45]', isActive ? T1 : T2)}
                          >
                            {impl.category}
                          </span>
                          <span className={cn('mt-1 block text-t6 leading-[1.6]', isActive ? T2 : T3)}>
                            {impl.items[0]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {project.tags.length > 0 && (
              <div data-modal-field="chips" className="mt-6 flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn('rounded-full bg-[rgb(255_255_255_/_0.06)] px-2.5 py-1 text-t8 leading-[1.4]', T2)}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          <div className="border-t border-[rgb(255_255_255_/_0.10)] mb-6" />

          {/* 판 2 · 트러블 슈팅. 진단 -> 선택지 -> 작업 -> 결과 -> 비용 축이 논증을 꿴다 */}
          <article data-modal-panel="2" className="relative py-7 pl-[22px]">
            <div
              aria-hidden
              className="pm-axis absolute bottom-6 left-0 top-1.5 w-px bg-[linear-gradient(180deg,rgb(3_179_195_/_0.55)_0%,rgb(255_255_255_/_0.16)_18%,rgb(255_255_255_/_0.16)_62%,rgb(255_255_255_/_0.02)_100%)]"
            />
            <p
              data-modal-field="step"
              className={cn('mb-3.5 flex items-center gap-2 text-t6 font-bold tracking-[-0.01em]', T1)}
            >
              <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--color-cyan-core)]" />
              트러블 슈팅
            </p>
            {review && (
              <>
                <h3
                  data-modal-field="claim"
                  className={cn('text-t3 font-bold leading-[1.25] tracking-[-0.02em]', T1)}
                >
                  {review.title}
                </h3>
                {review.problem && (
                  <div data-modal-field="body" className={cn('mt-3.5 text-t6 leading-[1.75]', T2)}>
                    <RichText text={review.problem} />
                  </div>
                )}

                {diagnosis && (
                  <>
                    <SubStep axis>진단</SubStep>
                    <div data-modal-field="diagnosis">
                      <p className={cn('mt-4 text-t6 font-semibold leading-[1.5]', T1)}>
                        {diagnosis.name}
                      </p>
                      <div className={cn('mt-1.5 text-t6 leading-[1.7]', T2)}>
                        <RichText text={diagnosis.body} />
                      </div>
                    </div>
                  </>
                )}

                {options.length > 0 && (
                  <>
                    <SubStep axis>검토한 선택지</SubStep>
                    <div
                      data-modal-field="options"
                      className={cn('mt-4 overflow-hidden rounded-lg border', LINE)}
                    >
                      {options.map((option, i) => (
                        <div
                          key={i}
                          data-opt={i}
                          data-opt-chosen={option.chosen ? '' : undefined}
                          className={cn(
                            'grid grid-cols-[auto_1fr] gap-3 border-t p-4 first:border-t-0',
                            LINE,
                            option.chosen && 'bg-[rgb(255_255_255_/_0.04)]'
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'mt-1 h-3.5 w-3.5 flex-none rounded-full border',
                              option.chosen
                                ? 'border-[var(--color-cyan-core)] bg-[var(--color-cyan-core)]'
                                : LINE_STRONG
                            )}
                          />
                          <div>
                            <p
                              className={cn(
                                'text-t6 font-semibold leading-[1.4]',
                                option.chosen ? T1 : T2
                              )}
                            >
                              {option.name}
                              {option.chosen && (
                                <span className={cn('ml-2 text-t8 font-bold tracking-[0.08em]', T1)}>
                                  선택
                                </span>
                              )}
                            </p>
                            {/* RichText는 본문에 글머리가 섞이면 div와 ul을 돌려준다.
                                p로 감싸면 브라우저가 p를 먼저 닫아 줄이 흐트러진다 */}
                            <div
                              className={cn(
                                'mt-1 text-t6 leading-[1.65]',
                                option.chosen ? T2 : T3
                              )}
                            >
                              <RichText text={option.body} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {review.action && review.action.length > 0 && (
                  <>
                    <SubStep axis>작업 사항</SubStep>
                    <ul data-modal-field="did" className={cn('mt-4 space-y-2 text-t6 leading-[1.75]', T2)}>
                      {review.action.map((item, i) => (
                        <li
                          key={i}
                          className="relative pl-3.5 before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-1.5 before:bg-[rgb(255_255_255_/_0.62)]"
                        >
                          <RichText text={item} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {metric && (
                  <>
                    <SubStep axis>결과</SubStep>
                    <div data-modal-field="metric" className="mt-4">
                      <p className={cn('text-t2 font-bold leading-[1.15] tabular-nums tracking-[-0.02em]', T1)}>
                        {metric.after}
                      </p>
                      {metric.measuredBy && (
                        <p className={cn('mt-1.5 text-t6 leading-[1.7]', T2)}>{metric.measuredBy}</p>
                      )}
                    </div>
                  </>
                )}

                {review.tradeOffs && review.tradeOffs.length > 0 && (
                  <>
                    <SubStep axis>트레이드 오프</SubStep>
                    <ul data-modal-field="cost" className={cn('mt-4 space-y-2.5 text-t6 leading-[1.7]', T3)}>
                      {review.tradeOffs.map((item, i) => (
                        <li
                          key={i}
                          className="relative pl-3.5 before:absolute before:left-0 before:top-[0.65em] before:h-px before:w-1.5 before:bg-[rgb(255_255_255_/_0.62)]"
                        >
                          <RichText text={item} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </article>
        </div>
      </div>
    </Modal>
  );
}
