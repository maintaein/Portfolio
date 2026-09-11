// components/blocks/ProjectModal/index.tsx
'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type TouchEvent,
} from 'react';
import Image from 'next/image';
import Modal from '@/components/atoms/Modal';
import Icon from '@/components/atoms/Icon';
import { gsap, registerGsap, REVEAL_OUT_MS, SITE_EASE } from '@/lib/gsap';
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
  // 내용의 등장·퇴장 소유권. null(또는 미전달)이면 안무가 없고 내용이 처음부터
  // 그냥 보인다. 좁은 화면, reducedMotion, gsap 미준비가 이 경로다.
  // false는 다 감춤(비행 중), 'head'는 머리띠 내용만 보임(비행 중), true는
  // 다 보임(등장 타임라인 한 번)이다
  reveal?: boolean | 'head' | null;
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
  /* 손가락에는 호버가 없다. 좁은 판에서는 넓은 판의 opacity-0 기본값을
     덮어 늘 보이게 한다 */
  #pm-shell .pm-vidnav { display: grid; opacity: 1; }
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

// 감추는 단위는 머리띠와 몸통 둘로 갈린다. 'head' 상태에서 머리띠만
// 보이고 몸통은 아직 감춰져 있어야 하므로 따로 골라낼 수 있어야 한다.
// h2#pm-title과 [data-modal-part="stage"]는 비행 대상이라 여기 들어오지
// 않는다. 비행이 방금 앉혀 놓은 것을 다시 건드리면 튄다.
//
// 감추는 수단은 visibility다. display를 쓰면 레이아웃이 사라져 비행 착지
// 좌표가 어긋나고, opacity 0은 안 보이는 채로 클릭·포커스가 되는 단추를
// 남긴다. visibility는 접근성 트리에서도 같이 빠지므로 비행 500ms 동안
// 아직 오지 않은 내용이 화면에도 스크린 리더에도 없다. Escape는 Modal
// 아톰이 document에 걸어 두므로 이 구간에도 그대로 닫힌다
function headRoots(shell: HTMLElement): HTMLElement[] {
  const head = shell.querySelector('[data-modal-part="head"]');
  return head
    ? (Array.from(head.children).filter((el) => el.id !== 'pm-title') as HTMLElement[])
    : [];
}

function bodyRoots(shell: HTMLElement): HTMLElement[] {
  return [
    shell.querySelector<HTMLElement>('[data-modal-part="scroll"]'),
    shell.querySelector<HTMLElement>('[data-modal-part="caption"]'),
  ].filter((el): el is HTMLElement => el !== null);
}

// 등장 순서. 머리 -> 논증 열 DOM 순서 -> 증거 열 설명. 'head' -> true
// 전이는 머리띠가 이미 나와 있으므로 skipHead로 목록에서 뺀다.
function revealOrder(shell: HTMLElement, opts?: { skipHead?: boolean }): HTMLElement[] {
  const scroll = shell.querySelector('[data-modal-part="scroll"]');
  const caption = shell.querySelector<HTMLElement>('[data-modal-part="caption"]');
  return [
    ...(opts?.skipHead ? [] : headRoots(shell)),
    ...(scroll ? Array.from(scroll.querySelectorAll<HTMLElement>('[data-modal-field], h4')) : []),
    ...(caption ? [caption] : []),
  ];
}

// 등장 예산은 REVEAL_IN_MS(1100ms)다. 요소 간격 60ms를 못박아 위에서
// 아래로 순서대로 뜨게 하고, 통짜 트윈(RISE_S)이 그 뒤로 0.45초를 쓴다.
// 영상 설명이 마지막이라 0.55(ELEM_SPAN) + 0.45(RISE_S) = 1.0초로 예산
// 안에 들어온다
const RISE_S = 0.45;
const ELEM_STEP = 0.06;
const ELEM_SPAN = 0.55;
// 논증 열에는 data-modal-field가 안 붙은 구조 블록(구현 기능 목록, 구분선,
// 축선)이 섞여 있다. 열 자체를 짧게 페이드해 그것들이 t=0에 툭 서지 않게 한다
const SCROLL_FADE_S = 0.3;

// false -> true와 'head' -> true 두 전이가 같은 방식으로 몸통을 등장시킨다.
// 차이는 order에 머리띠가 섞여 있는지뿐이다. 영상 설명은 clip-path로 왼쪽에서
// 오른쪽으로 드러난다. 다른 요소처럼 12px 상승 페이드면 문단인지 영상 설명인지
// 구분이 안 된다. clearProps로 clip-path를 지우는 이유는 남겨 두면 캡션 안
// 글자가 길어졌을 때 잘릴 수 있어서다
function buildRevealTimeline(shell: HTMLElement, order: HTMLElement[]): gsap.core.Timeline {
  const tl = gsap.timeline();
  const scroll = shell.querySelector<HTMLElement>('[data-modal-part="scroll"]');
  if (scroll) {
    tl.fromTo(scroll, { opacity: 0 }, { opacity: 1, duration: SCROLL_FADE_S, ease: SITE_EASE }, 0);
  }

  order.forEach((el, i) => {
    const at = Math.min(i * ELEM_STEP, ELEM_SPAN);

    if (el.getAttribute('data-modal-part') === 'caption') {
      tl.fromTo(
        el,
        { clipPath: 'inset(0 100% 0 0)', opacity: 0 },
        {
          clipPath: 'inset(0 0% 0 0)',
          opacity: 1,
          duration: 0.5,
          ease: SITE_EASE,
          clearProps: 'clipPath',
        },
        at
      );
      return;
    }

    tl.fromTo(el, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: RISE_S, ease: SITE_EASE }, at);
  });

  return tl;
}

export default function ProjectModal({
  isOpen,
  onClose,
  project,
  onStageMount,
  reveal,
}: ProjectModalProps) {
  const [feat, setFeat] = useState(0);
  // 자동재생 muted loop 영상의 정지 상태. WCAG 2.2.2가 5초 넘는 자동재생에
  // 정지 수단을 요구한다. 무대를 넘겨도(setFeat) 이 상태는 그대로 간다.
  const [playing, setPlaying] = useState(true);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  // 좁은 판의 스와이프 시작 x좌표. 40px 임계를 넘으면 무대를 넘긴다.
  const touchStartXRef = useRef<number | null>(null);
  const shellElRef = useRef<HTMLDivElement | null>(null);
  // 콜백 ref는 커밋마다 최신 reveal을 봐야 한다. 렌더마다 갱신한다
  const revealRef = useRef<boolean | 'head' | null | undefined>(reveal);
  revealRef.current = reveal;
  const prevRevealRef = useRef<boolean | 'head' | null | undefined>(undefined);

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

  // 셸은 Modal 아톰이 portal을 세운 다음 커밋에서야 DOM에 박힌다. reveal이
  // false로 바뀌는 커밋과 그 커밋이 다를 수 있어서 layout effect만으로는
  // 감추는 시점을 놓친다 - stage와 같은 방식으로 콜백 ref가 박히는 순간을 잡는다
  const handleShellMount = useCallback((el: HTMLDivElement | null) => {
    shellElRef.current = el;
    if (el && revealRef.current === false) {
      registerGsap();
      gsap.set([...headRoots(el), ...bodyRoots(el)], { visibility: 'hidden' });
    }
  }, []);

  // 내용의 등장·퇴장은 부모가 아니라 여기가 갖는다. 부모가 컨테이너를
  // 되살리는 React 커밋과 자식을 등장 시작 상태로 누르는 순간이 갈리면 그
  // 사이에 한 프레임이 번쩍인다. 같은 layout effect 안에 붙여야 안 샌다
  useLayoutEffect(() => {
    const prev = prevRevealRef.current;
    prevRevealRef.current = reveal;
    const shell = shellElRef.current;
    if (!shell || reveal == null) return;
    registerGsap();
    const head = headRoots(shell);
    const body = bodyRoots(shell);

    if (reveal === false) {
      // 등장한 적이 없으면(비행 시작 전) 그냥 감춘다
      if (prev == null) {
        gsap.set([...head, ...body], { visibility: 'hidden' });
        return;
      }
      // 'head' -> false. 머리띠만 접는다. 몸통은 이미 감춰져 있다
      if (prev === 'head') {
        const out = gsap.to(head, { opacity: 0, y: -6, duration: 0.2, ease: SITE_EASE });
        return () => {
          out.kill();
        };
      }
      // true -> false. 나갈 때까지 글자를 쪼개면 산만하다. 통짜로 접는다
      const out = gsap.to([...head, ...body], {
        opacity: 0,
        y: 10,
        duration: REVEAL_OUT_MS / 1000,
        ease: SITE_EASE,
      });
      return () => {
        out.kill();
      };
    }

    if (reveal === 'head') {
      // false -> 'head'. 머리띠 내용만 보이고 등장한다
      if (prev === false) {
        gsap.set(head, { visibility: 'visible', y: 8, opacity: 0 });
        const tween = gsap.to(head, {
          y: 0,
          opacity: 1,
          duration: 0.4,
          ease: SITE_EASE,
          stagger: 0.04,
        });
        return () => {
          tween.kill();
        };
      }
      // true -> 'head'. 몸통만 접는다. 머리띠는 남는다
      if (prev === true) {
        const out = gsap.to(body, {
          opacity: 0,
          y: 10,
          duration: REVEAL_OUT_MS / 1000,
          ease: SITE_EASE,
        });
        return () => {
          out.kill();
        };
      }
      return;
    }

    // reveal === true
    // 'head' -> true. 몸통이 등장한다. 머리띠는 이미 나와 있으니 다시 건드리지
    // 않는다 - order에서 뺀다
    if (prev === 'head') {
      gsap.set(body, { visibility: 'visible' });
      const tl = buildRevealTimeline(shell, revealOrder(shell, { skipHead: true }));
      return () => {
        tl.kill();
      };
    }

    // false -> true. 비행 없이 바로 여는 경로. 머리띠와 몸통이 한 timeline으로
    // 함께 등장한다
    if (prev === false) {
      gsap.set([...head, ...body], { visibility: 'visible' });
      const tl = buildRevealTimeline(shell, revealOrder(shell));
      return () => {
        tl.kill();
      };
    }

    // 감춰 둔 적이 없으면 등장도 없다. 안무 없이 그냥 보이던 판을 뒤늦게
    // 0에서 끌어올리면 그게 곧 번쩍임이다
    return;
  }, [reveal]);

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
      backdropClassName="bg-transparent"
    >
      <div
        id="pm-shell"
        ref={handleShellMount}
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
            className={cn(
              'truncate text-t3 lg:text-t2 font-bold leading-[1.1] lg:leading-[1.1] tracking-[-0.02em]',
              T1
            )}
          >
            {project.title}
          </h2>
          {/* ml-auto: 비행 중 absolute:true가 #pm-title을 flex 흐름에서
              빼면 자식이 이 묶음 하나만 남는다. justify-between은 자식이
              하나면 flex-start에 두므로 묶음이 제목 착지 자리로 밀려간다.
              자동 좌측 여백이 제목 유무와 무관하게 항상 이 묶음을 오른쪽
              끝으로 민다 */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
            // 모서리는 접힘 프리뷰와 같은 토큰이다. 이 노드가 비행하는
            // 노드라 여기 반경이 없으면 날아가는 동안만 각져 보인다.
            // 자르기를 여기 두는 것은 안전하다 - collectClippedAncestors는
            // 이 노드의 부모부터 걷어내므로 자기 overflow는 안 건드린다
            className="group/stage relative grid justify-items-center gap-0 overflow-hidden rounded-media"
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
                      className="block aspect-video w-full rounded-media border border-[rgb(255_255_255_/_0.08)] bg-[rgb(0_0_0)] object-cover"
                    />
                  ) : (
                    <div className="relative aspect-video w-full overflow-hidden rounded-media border border-[rgb(255_255_255_/_0.08)] bg-[rgb(0_0_0)]">
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
                <div className="relative aspect-video w-full overflow-hidden rounded-media border border-[rgb(255_255_255_/_0.08)] bg-[rgb(0_0_0)]">
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
                {/* 구현 기능 목록이 사라지는 좁은 판에서는 무대를 넘기는 유일한
                    손잡이다. 넓은 판에서는 목록과 짝을 이루는 보조 수단이다 */}
                {/* 넓은 판에서는 무대(group/stage)에 호버하거나, 단추 자신이 키보드
                    포커스를 받을 때만 뜬다. 무대 전체의 group-focus-within은 쓰지
                    않는다. 모달이 열릴 때 포커스가 이 단추에 앉아 무대가 계속
                    포커스를 문 상태가 되기 때문이다. 좁은 판은 NARROW_PANEL_CSS가
                    opacity:1로 되살린다. 손가락에는 호버가 없다 */}
                <button
                  type="button"
                  onClick={() => goFeat(-1)}
                  aria-label="이전 기능 영상"
                  className={cn(
                    'pm-vidnav absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center',
                    'rounded-full bg-[rgb(0_0_0_/_0.55)] opacity-0 transition-opacity',
                    'group-hover/stage:opacity-100 focus-visible:opacity-100',
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
                    'pm-vidnav absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center',
                    'rounded-full bg-[rgb(0_0_0_/_0.55)] opacity-0 transition-opacity',
                    'group-hover/stage:opacity-100 focus-visible:opacity-100',
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
                {/* 목록에서 선택된 줄의 번호와 같은 시안이다. 같은 색 같은 숫자가
                    두 군데 있어야 영상과 목록 줄이 짝으로 읽힌다 */}
                <b className="text-[var(--color-cyan-core)]">{String(feat + 1).padStart(2, '0')}</b> /{' '}
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
                          'group relative grid w-full grid-cols-[auto_1fr_auto] items-baseline gap-3.5',
                          'border-b border-b-[rgb(255_255_255_/_0.08)] py-4 pl-3 pr-2 text-left',
                          'transition-colors hover:bg-[rgb(255_255_255_/_0.04)]',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-cyan-hi)]',
                          // 선택된 줄만 배경과 왼쪽 시안 막대를 얻는다. 배경은 호버보다
                          // 진해야 선택이 다른 줄의 호버에 묻히지 않는다. 막대는
                          // before 의사요소라 레이아웃을 안 밀어낸다
                          isActive &&
                            cn(
                              'bg-[rgb(255_255_255_/_0.05)]',
                              // 선택 배경은 호버보다 진해야 한다. 0.05에서 0.08로 눌렀을 때 더 진해진다
                              'hover:bg-[rgb(255_255_255_/_0.08)]',
                              'before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[2px] before:content-[""] before:bg-[var(--color-cyan-core)]'
                            )
                        )}
                      >
                        <span
                          className={cn(
                            'text-t7 font-bold tabular-nums tracking-[0.04em]',
                            isActive ? 'text-[var(--color-cyan-core)]' : T3
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
                        {/* 호버·키보드 포커스에서만 드러나는 손잡이 신호. 목록이
                            읽을거리가 아니라 누를 수 있는 재생 목록이라는 것을
                            손이 먼저 안다 */}
                        <span
                          aria-hidden
                          className={cn(
                            T3,
                            'self-center opacity-0 transition-opacity',
                            'group-hover:opacity-100 group-focus-visible:opacity-100'
                          )}
                        >
                          <Icon name="chevron-right" size="small" />
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
