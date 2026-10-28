'use client';

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { experiences } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { readingLineY } from '@/lib/utils/scrollGeometry';
import { computeTimelineState, type TimelineLayout } from './timeline';

const kind = (type: string) => type === 'student' ? 'EDUCATION' : 'WORK';
// transform을 뺀 레이아웃 y. 본문의 등장 이동과 sticky rail이 잰 값을 흔들지 않는다(둘 다 같은 조상까지 재서 빼면 sticky 밀림도 지워진다).
const localTop = (element: HTMLElement, ancestor: HTMLElement) => {
  let y = 0;
  for (let node: HTMLElement | null = element; node && node !== ancestor; node = node.offsetParent as HTMLElement | null) y += node.offsetTop;
  return y;
};
const headerHeight = () => document.querySelector('[data-scroll-header]')?.getBoundingClientRect().height ?? 0;
const noSubscribe = () => () => {};

// 좁은 rail(기관·직책)과 실제 높이의 넓은 본문. 선 끝·표식·본문 공개는 같은 읽기선(M1 readingLineY)에서 정한다(M5 Task 1).
// 선 그룹 전체가 data-part="experience-line"이고 data-complete가 마지막 본문을 다 읽었는지다(Skills 경계가 읽는다).
// lineArrived: 프리뷰→선 경계가 첫 세로축에 내려앉았다(HomeClient가 motion.ts에서 받아 넘긴다). 그 끝에서 첫 표식과 FASOO 본문을 공개한다.
export default function ExperienceSection({ lineArrived = false }: { lineArrived?: boolean }) {
  const { reducedMotion, motionReady } = useSectionActivity();
  const { ref, visible } = useSectionVisibility<HTMLElement>();
  const layoutRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const nodesRef = useRef<(HTMLSpanElement | null)[]>([]);
  const labelsRef = useRef<(HTMLElement | null)[]>([]);
  const articlesRef = useRef<(HTMLElement | null)[]>([]);
  // 모션 감소는 선호를 확인한 뒤에만 전체 정적 공개다. 확인 전 기본값(reduced)으로 미래 이력을 한 번 보였다가 숨기지 않는다.
  const staticMode = reducedMotion && motionReady;
  // 점진 공개는 하이드레이션 뒤 JS가 켠다(data-progressive). 서버 HTML과 JS가 없는 방문에서는 모든 본문과 rail이 보인다(수정 1 I2).
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const progressive = hydrated && !staticMode;
  // React 상태는 도달 index와 완료가 바뀔 때만 바꾼다. 선 끝과 자르기는 아래 효과가 요소에 바로 쓴다.
  const [progress, setProgress] = useState({ reached: -1, complete: false });
  // 경계가 내려앉으면 첫 표식과 FASOO까지는 읽기선 전에도 공개한다(수정 1 I1). 그 뒤 노드는 읽기선이 정하고, 경계가 거꾸로 떠나면 이 바닥도 걷힌다.
  const reached = staticMode ? experiences.length - 1 : lineArrived ? Math.max(progress.reached, 0) : progress.reached;
  const complete = staticMode || progress.complete;

  useLayoutEffect(() => {
    const layout = layoutRef.current, line = lineRef.current, path = pathRef.current, tip = tipRef.current;
    if (!layout || !line || !path || !tip) return;
    let geometry: TimelineLayout = { articleTops: [], articleBottoms: [], nodeY: [] };
    let header = 0;
    let pathHeight = 0;
    let frame = 0;
    const measure = () => {
      // 760px 이하는 왼쪽 얇은 선 한 열이라 표식이 각 본문 제목 옆에 선다. 그 위로는 rail의 기관 이름 옆이다.
      const mobile = window.matchMedia?.('(max-width: 760px)').matches ?? false;
      const articles = articlesRef.current.filter((article): article is HTMLElement => !!article);
      const groupTop = localTop(line, layout);
      geometry = {
        articleTops: articles.map(article => localTop(article, layout)),
        articleBottoms: articles.map(article => localTop(article, layout) + article.offsetHeight),
        nodeY: articles.map((article, index) => {
          const anchor = mobile ? article.querySelector('h3') : labelsRef.current[index];
          return anchor ? localTop(anchor, layout) - groupTop + anchor.offsetHeight / 2 : 0;
        }),
      };
      header = headerHeight();
      const first = geometry.nodeY[0] ?? 0;
      path.style.top = `${first}px`;
      pathHeight = Math.max(0, (geometry.nodeY.at(-1) ?? 0) - first);
      path.style.height = `${pathHeight}px`;
      nodesRef.current.forEach((node, index) => { if (node) node.style.top = `${geometry.nodeY[index] ?? 0}px`; });
    };
    const draw = () => {
      frame = 0;
      const nodes = geometry.nodeY;
      const lineY = readingLineY(window.innerHeight, header);
      const state = staticMode
        ? { tipY: nodes.at(-1) ?? 0, reached: nodes.length - 1, complete: true }
        : computeTimelineState(geometry, lineY - layout.getBoundingClientRect().top, window.innerHeight - lineY);
      // 그린 길이 밖은 잘라 숨긴다. 미래 경로의 희미한 바탕선을 남기지 않는다. 좌우는 광휘가 잘리지 않게 넓힌다.
      const first = nodes[0] ?? 0;
      path.style.clipPath = `inset(0px -12px ${Math.max(0, pathHeight - Math.max(0, state.tipY - first))}px -12px)`;
      tip.style.transform = `translateY(${state.tipY}px)`;
      setProgress(previous => previous.reached === state.reached && previous.complete === state.complete
        ? previous : { reached: state.reached, complete: state.complete });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const refit = () => { measure(); draw(); };
    refit();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit);
    resize?.observe(layout);
    window.addEventListener('resize', refit);
    // 보이는 동안만 스크롤마다 다시 그린다.
    if (visible) window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      resize?.disconnect();
      window.removeEventListener('resize', refit);
      window.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
      // 화면을 떠나는 마지막 스크롤이 그리기 전에 끊겼을 수 있다. 떠난 자리(예: 한 번에 Skills로)의 완료 상태로 한 번 더 맞춘다.
      if (visible) draw();
    };
  }, [visible, staticMode]);

  // 드러난 표식은 그 본문으로 돌아가는 이동 지점이다. 본문 위끝을 읽기선에 맞춘다.
  const goTo = (index: number) => {
    const layout = layoutRef.current, article = articlesRef.current[index];
    if (!layout || !article) return;
    const top = layout.getBoundingClientRect().top + window.scrollY + localTop(article, layout) - readingLineY(window.innerHeight, headerHeight());
    window.scrollTo({ top: Math.ceil(top), behavior: reducedMotion ? 'auto' : 'smooth' });
    article.focus({ preventScroll: true });
  };

  return (
    <section ref={ref} id={SECTION_IDS.EXPERIENCE} aria-label="경력" className="experience-timeline" data-progressive={progressive ? '' : undefined}>
      <div ref={layoutRef} className="experience-timeline-layout">
        <div className="experience-timeline-rail">
          <div ref={lineRef} data-part="experience-line" data-complete={complete} className="experience-line">
            <span ref={pathRef} data-part="line-path" className="experience-line-path" aria-hidden="true" />
            <span ref={tipRef} data-part="line-tip" className="experience-line-tip" aria-hidden="true" />
            {experiences.map((experience, index) => (
              <span key={experience.id} ref={(node) => { nodesRef.current[index] = node; }} data-part="line-node"
                data-reached={index <= reached ? '' : undefined} className="experience-line-node" aria-hidden="true" />
            ))}
            <ol className="experience-rail" aria-label="경력 시점">
              {/* 아직 닿지 않은 표식은 자리만 남긴다(선 좌표를 재야 한다). 보이지도, 포커스되지도 않는다. */}
              {experiences.map((experience, index) => (
                <li key={experience.id} data-reached={index <= reached ? '' : undefined} inert={progressive && index > reached}>
                  <button type="button" aria-current={index === reached ? 'step' : undefined} onClick={() => goTo(index)}>
                    <strong ref={(node) => { labelsRef.current[index] = node; }}>{experience.company}</strong>
                    <span>{experience.position}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="experience-bodies">
          {experiences.map((experience, index) => (
            <article
              key={experience.id}
              ref={(node) => { articlesRef.current[index] = node; }}
              className="experience-body"
              data-state={index < reached ? 'past' : index === reached ? 'current' : 'future'}
              tabIndex={-1}
              aria-labelledby={`experience-body-${experience.id}`}
            >
              <p className="experience-body-meta">
                <span>{kind(experience.type)}</span>
                <span>{experience.period}</span>
              </p>
              <h3 id={`experience-body-${experience.id}`}>{experience.company}</h3>
              <p className="experience-body-position">{experience.position}</p>
              <p className="experience-body-description">{experience.description}</p>
              <h4>주요 경험</h4>
              <ul className="experience-body-list">
                {experience.responsibilities.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <ul className="experience-body-skills" aria-label="기술">
                {(experience.skills ?? []).map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
