'use client';

import { useState } from 'react';
import { coreValues } from '@/lib/data';
import { SECTION_IDS } from '@/lib/constants';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import AboutRail from './rail';
import { ABOUT_SCRIMS, ABOUT_SCRIMS_MOBILE } from './scrim';

// 문항 전환의 방향과 거리. 클릭 시점에 정해 상태로 들고 있는다. 렌더 중에
// ref로 직전 값과 비교하면 StrictMode 이중 렌더에서 두 번째 렌더의 차가
// 0이 되어 방향이 사라진다. 실제 이동량(배율·투명도)은 CSS의
// [data-about-direction], [data-about-distance] 선택자가 만든다
// (styles/design-tokens.css). 시차(증거가 먼저, 제목·설명이 늦게)도 거기
// animation-delay로만 존재한다. TS 쪽에 같은 값을 상수로 복제하면 CSS가
// 바뀌어도 아무도 모르게 어긋나므로, 그 계약은 CSS 자체를 읽는 테스트로
// 고정한다(__tests__/components/AboutSection.test.tsx).
//
// 같은 방향으로 연속 이동하면(01→02→03) direction/distance 값이 문자열로
// 그대로라 React가 속성을 다시 쓰지 않고 CSS 애니메이션도 재시작하지
// 않는다(최종 리뷰 발견 1). transitionSeq를 클릭마다 늘려 격자의 key로
// 걸면 값이 같아도 매 전환마다 노드를 새로 만들어 애니메이션이 항상
// 재생된다.
type AboutTransition = {
  direction: 'forward' | 'backward' | 'none';
  distance: number;
};

// 증거 블록. 자리는 셋이 같고 내용만 다르다. 콘텐츠가 확정되면 이 배열만
// 바꾼다. 라벨은 t8, 값은 크게 둬서 대충 봐도 값이 먼저 읽힌다.
const EVIDENCE = [
  <div key="basics" className="flex flex-col gap-5">
    <div>
      <div className="text-t8 uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        Tree-shaking
      </div>
      <div className="text-d3 font-bold leading-none text-[var(--color-text-primary)]">91%</div>
    </div>
    <div>
      <div className="text-t8 uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        렌더링 에러
      </div>
      <div className="text-d3 font-bold leading-none text-[var(--color-text-primary)]">0</div>
    </div>
  </div>,
  <div key="ai" className="flex flex-col gap-5 font-mono">
    <div>
      <div className="text-t8 uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        검증한 뒤 반영
      </div>
      <div className="text-t2 leading-tight text-[var(--color-text-primary)]">
        Prompt <span className="text-[var(--color-cyan-core)]">&#8594;</span> Review{' '}
        <span className="text-[var(--color-cyan-core)]">&#8594;</span> Ship
      </div>
    </div>
  </div>,
  <div key="team" className="flex flex-col gap-4 font-mono">
    {[
      ['ROLE', '프론트엔드 리더'],
      ['CONVENTION', 'git · jira'],
      ['ARCHITECTURE', 'FSD · Atomic'],
    ].map(([label, value]) => (
      <div key={label}>
        <div className="text-t8 tracking-[0.2em] text-[var(--color-text-secondary)]">{label}</div>
        <div className="mt-1 text-t3 leading-tight text-[var(--color-text-primary)]">{value}</div>
      </div>
    ))}
  </div>,
];

// Cubes와 Orbit은 폐기했다. 배경이 이미 있는데 별도 도형을 얹으면 경쟁한다.
// 순번 인덱스는 라벨 레일(AboutRail)로 바뀌었다. 상세 내부는 lg부터 12칸
// 6줄 격자를 쓰고, 그 미만에서는 4칸으로 줄여 세로로 쌓는다(Task 7).
export default function AboutSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [transition, setTransition] = useState<AboutTransition>({
    direction: 'none',
    distance: 0,
  });
  const [transitionSeq, setTransitionSeq] = useState(0);
  const { reducedMotion } = useSectionActivity();

  function handleSelect(next: number) {
    const delta = next - activeIndex;
    setTransition({
      direction: reducedMotion ? 'none' : delta > 0 ? 'forward' : delta < 0 ? 'backward' : 'none',
      distance: Math.abs(delta),
    });
    setTransitionSeq((seq) => seq + 1);
    setActiveIndex(next);
  }

  return (
    <section
      id={SECTION_IDS.ABOUT}
      aria-labelledby="about-heading"
      className="flex flex-col lg:h-full lg:flex-row"
    >
      {/* about-heading: 섹션 aria-labelledby가 참조하는 시각적으로 숨긴
          제목. AboutRail은 라벨 레일 자체만 그리므로 여기서 섹션 이름을
          별도로 붙잡아 둔다. */}
      <h2 id="about-heading" className="sr-only">
        About
      </h2>
      <AboutRail activeIndex={activeIndex} onSelect={handleSelect} />

      {/* 상세 3개: 전부 DOM에 상주한다. 활성 하나만 보이고 나머지는 inert.
          .section-hidden과 같은 방식(opacity + pointer-events)으로 감춘다.
          활성 하나만 렌더하면 계획 2가 고친 SEO 조건부 렌더 결함을 이
          레벨에서 재생산한다.

          lg 미만에서는 활성 하나만 흐름 안에 두고 나머지를 absolute로
          빼낸다. 셋 다 absolute로 겹쳐두면(desktop 방식) 부모가 in-flow
          자식을 하나도 못 봐서 자체 높이가 0으로 무너진다(Task 7 조사).
          lg 이상에서는 기존처럼 전부 absolute로 겹쳐 크로스페이드한다. */}
      <div className="relative flex-1 lg:h-full">
        {/* 문항별 배경 스크림. 레일은 이 컨테이너 바깥(별도 flex 자식)이라
            겹치지 않는다. .section-stage(fixed, header/footer만큼 inset)
            안에 있으면 그 여백만큼 배경이 빠져 밝게 남으므로 fixed로 띄워
            뷰포트 전체를 덮는다. fixed는 DOM 순서가 아니라 -z-[1]로
            쌓임을 정한다: 배경(HyperspeedBackground, fixed -z-10)보다는
            위, 상세 콘텐츠(z-index 없음)보다는 아래로 깔린다.
            평평한 검은 막이 아니라 그라데이션을 써서 광선이 그대로 흐르게
            한다(scrim.ts).

            문항 수만큼 레이어를 겹쳐 opacity로 교차시킨다. background
            트랜지션은 transform·opacity·filter만 쓴다는 제약 위반이라
            (최종 리뷰 발견 2), 배경 값 자체는 고정하고 활성 레이어만
            opacity로 드러낸다. reduce 방어([data-about-scrim],
            design-tokens.css)도 opacity 전환 하나만 끊으면 끝난다.

            lg 미만은 글자가 col-start-1부터 폭 전체를 쓴다. 가로
            그라데이션(ABOUT_SCRIMS, to left)을 그대로 쓰면 본문이 시작하는
            왼쪽 끝의 알파가 0이라 그 뒤로 광선이 그대로 지나간다(최종
            리뷰 발견 3). lg 미만 전용으로 세로 그라데이션(ABOUT_SCRIMS_
            MOBILE, to top)을 별도 레이어로 두고 lg부터는 숨긴다. */}
        {ABOUT_SCRIMS.map((scrim, index) => (
          <div
            key={`desktop-${index}`}
            data-about-scrim
            data-about-scrim-index={index}
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 -z-[1] hidden transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
              index === activeIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ background: scrim }}
          />
        ))}
        {ABOUT_SCRIMS_MOBILE.map((scrim, index) => (
          <div
            key={`mobile-${index}`}
            data-about-scrim
            data-about-scrim-index={index}
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 -z-[1] transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
              index === activeIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ background: scrim }}
          />
        ))}
        {coreValues.map((value, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={value.id}
              data-detail={index}
              inert={!isActive}
              aria-hidden={!isActive}
              className={`transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:absolute lg:inset-0 ${
                isActive
                  ? 'opacity-100 pointer-events-auto'
                  : 'absolute inset-0 opacity-0 pointer-events-none'
              }`}
            >
              <div
                key={transitionSeq}
                data-about-grid
                data-about-direction={transition.direction}
                data-about-distance={String(transition.distance)}
                className="grid grid-cols-4 gap-x-4 gap-y-6 px-5 py-6 lg:h-full lg:grid-cols-12 lg:grid-rows-6 lg:gap-x-6 lg:gap-y-2 lg:px-10 lg:py-8"
              >
                <h3
                  data-about-title
                  className="col-span-4 col-start-1 text-t3 font-bold leading-tight text-[var(--color-text-primary)] sm:text-t2 lg:col-span-5 lg:col-start-7 lg:row-start-2 lg:self-center lg:text-t1"
                >
                  {value.title}
                </h3>
                <div
                  data-about-evidence
                  className="col-span-4 col-start-1 lg:col-span-4 lg:col-start-7 lg:row-span-2 lg:row-start-3 lg:self-center"
                >
                  {EVIDENCE[index]}
                </div>
                <p
                  data-about-description
                  className="col-span-4 col-start-1 text-t7 leading-relaxed text-[var(--color-text-secondary)] sm:text-t6 lg:col-span-5 lg:col-start-7 lg:row-start-5 lg:self-center"
                >
                  {value.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
