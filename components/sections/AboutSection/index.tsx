'use client';

import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { ELECTRIC_LOGO_MORPH_SECONDS } from '@/components/blocks/ElectricLogo/motion';
import { coreValues } from '@/lib/data';
import { RichText, parseRichText } from '@/lib/utils/richText';
import { SECTION_IDS } from '@/lib/constants';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { useChapterLock } from '@/hooks/useChapterLock';
import ChapterFocus from './ChapterFocus';
import { ABOUT_SCRIMS, ABOUT_SCRIMS_MOBILE } from './scrim';
import styles from './styles.module.css';

export interface AboutSectionHandle { release(): void }
export interface AboutSectionProps {
  onChapterChange: (index: number) => void;
  navigationPending: boolean;
  // 공유 로고의 자리(HomeClient motion.ts의 LogoOwner). 날아가는 동안(boundary)에는 잠그지 않고,
  // 그사이 잠금 자리에 닿았으면 About에 내려앉을 때 잠근다. Hero로 되돌아가 내려앉으면 미룬 잠금을 버린다.
  // Projects 프리뷰와 오가는 비행(preview)과 프리뷰 자리(projects)에는 잠금도 본문도 묶이지 않는다(돌아올 때 읽던 chapter로 잠근다).
  // Hero에서 About을 지나 그대로 프리뷰로 가면 미룬 잠금을 버린다.
  logoOwner?: 'hero' | 'about' | 'boundary' | 'preview' | 'projects' | 'none';
}

// 본문 전환과 로고 모프가 같은 1초를 쓴다.
const TRANSITION_MS = ELECTRIC_LOGO_MORPH_SECONDS * 1000;

// 읽기 잠금(제스처 하나에 chapter 하나, 마지막 chapter의 새 제스처는 문서로)은 useChapterLock이 맡는다.
export default function AboutSection({ ref, onChapterChange, navigationPending, logoOwner = 'none' }: AboutSectionProps & { ref?: Ref<AboutSectionHandle> }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const selected = useRef(0);
  // 로고가 About에 내려앉아 있는지. 위로 돌아갈 때 그동안은 R 위에서도 본문을 남긴다.
  const restingRef = useRef(logoOwner === 'about');
  const { reducedMotion, motionReady, pageVisible, obscured } = useSectionActivity();
  const { ref: sectionRef, visible } = useSectionVisibility<HTMLElement>();
  const active = visible && motionReady && pageVisible && !obscured;
  const chapterLock = useChapterLock({
    ref: sectionRef,
    count: coreValues.length,
    current: () => selected.current,
    choose: index => { selected.current = index; setActiveIndex(index); },
    // 날아오는 동안(boundary)은 잠금을 미루고 About(또는 GL 로고 없음)에 내려앉으면 건다. Hero·프리뷰 쪽에 내려앉으면 미룬 잠금을 버린다.
    logo: logoOwner === 'boundary' ? 'flying' : logoOwner === 'about' || logoOwner === 'none' ? 'landed' : 'away',
    stepMs: TRANSITION_MS,
    disabled: reducedMotion,
    blocked: navigationPending || obscured,
    // 위로 R을 지나도 로고가 About에 있는 동안은 본문이 남는다. 로고가 떠나는 프레임(되돌기 시작)에 owner effect가 다시 읽는다(Task 11).
    onScroll: offset => setRevealed(shown => offset < window.innerHeight / 2 && (offset > -window.innerHeight / 2 || (shown && restingRef.current))),
  });
  const { locked, plain, release, offset: lockOffset } = chapterLock;

  useImperativeHandle(ref, () => ({ release }), [release]);
  useEffect(() => { onChapterChange(activeIndex); }, [activeIndex, onChapterChange]);
  useEffect(() => {
    restingRef.current = logoOwner === 'about';
    const offset = lockOffset();
    if (offset !== null) setRevealed(Math.abs(offset) < window.innerHeight / 2);
  }, [logoOwner, lockOffset]);

  // 스크림 포털 대상. 서버 렌더에는 document가 없어 마운트 뒤에 정한다.
  // .portfolio-document 안에 붙여야 배경과 같은 쌓임 맥락에 놓인다.
  const [scrimHost, setScrimHost] = useState<Element | null>(null);
  useEffect(() => setScrimHost(sectionRef.current?.closest('.portfolio-document') ?? document.body), [sectionRef]);

  const value = coreValues[activeIndex];
  // 본문은 로고가 내려앉은 뒤에 나타난다(사용자 결정 2026-10-21). 날아가는 동안 기다릴 뿐 스크롤 입력은 막지 않는다.
  // 본문은 로고가 Hero 쪽(Hero에 있거나 Hero와 오가는 중)에 있으면 보이지 않는다. 경로 지점에서 Hero로 돌아간 로고는 R 아래에서도 본문을 다시 열지 않는다(Task 12).
  // 로고가 Projects 프리뷰 쪽에 있을 때는 About 자신의 규칙(반 화면)만 따른다(M4 Task 1).
  const entered = (revealed && logoOwner !== 'hero' && logoOwner !== 'boundary') || plain;
  return (
    <section ref={sectionRef} id={SECTION_IDS.ABOUT} aria-labelledby="about-heading" className={styles.section}>
      {/* 섹션 제목은 시각적으로 숨긴다. 화면 위에는 chapter 단어만 남는다. */}
      <h2 id="about-heading" className="sr-only">
        About
      </h2>
      {/* 스크림은 .portfolio-document의 끝으로 포털해 배경 위·본문 아래에 깐다.
          보이는 조건은 About이 읽기선을 가질 때다(design-tokens.css의
          [data-about-scrim] 형제 선택자). 언마운트가 아니라 불투명도로 감춰
          떠날 때도 페이드한다. lg 미만은 세로 그라데이션을 쓴다(scrim.ts). */}
      {scrimHost
        ? createPortal(
            <>
              {ABOUT_SCRIMS.map((scrim, index) => (
                <div
                  key={`desktop-${index}`}
                  data-about-scrim
                  data-about-scrim-index={index}
                  aria-hidden="true"
                  className={`pointer-events-none fixed inset-0 -z-[1] hidden transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
                    active && index === activeIndex
                      ? 'opacity-100'
                      : 'opacity-0'
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
                    active && index === activeIndex
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                  style={{ background: scrim }}
                />
              ))}
            </>,
            scrimHost
          )
        : null}
      <div className={styles.stage} style={{ '--chapter-transition': `${TRANSITION_MS}ms` } as CSSProperties}
        data-motion-layout="reading" data-static={plain ? '' : undefined} data-entered={entered} data-locked={locked}>
        <div className={styles.header} onFocus={event => chapterLock.focus(event)}>
          <ChapterFocus active={activeIndex} entered={entered} onSelect={index => chapterLock.select(index)} />
        </div>
        <div className={styles.rail} aria-hidden="true">
          {/* 공유 로고는 HomeClient 셸의 host 하나가 띄우고 이 앵커에 내려앉는다. 여기는 자리와 정적 실루엣뿐이다. */}
          <div data-about-visual>
            <div data-motion-anchor="about-logo" className="about-electric">
              <div className={`about-electric-static ${reducedMotion || plain ? '' : 'about-electric-static-charging'}`}>
                <div className="about-electric-static-shape" style={{ maskImage: `url(${value.logoSrc})`, WebkitMaskImage: `url(${value.logoSrc})` }} />
              </div>
            </div>
          </div>
        </div>
        {/* 세 chapter가 전부 DOM에 상주한다. 활성 하나만 보이고 나머지는 inert다. */}
        <div className={styles.articles}>
          <div className={styles.panelViewport}>
            {coreValues.map((chapter, index) => {
              const current = plain || index === activeIndex;
              return (
                <article key={chapter.id} data-detail={index} data-chapter={chapter.label} className={styles.panel}
                  data-position={index === activeIndex ? 'active' : index < activeIndex ? 'past' : 'future'}
                  inert={!current} aria-hidden={!current}>
                  <h3 data-about-title className={styles.title}>{parseRichText(chapter.title)}</h3>
                  <dl data-about-evidence className={styles.evidence}>
                    {chapter.evidence.map(({ label, value: evidenceValue }) => (
                      <div key={label}><dt>{parseRichText(label)}</dt><dd>{parseRichText(evidenceValue)}</dd></div>
                    ))}
                  </dl>
                  <div data-about-description className={styles.description}>
                    <RichText text={chapter.description} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
