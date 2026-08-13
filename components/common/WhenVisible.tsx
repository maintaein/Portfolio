'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSectionActivity } from '@/components/common/SectionActivityContext';
import type { NavId } from '@/hooks/useSectionNav';

export interface WhenVisibleProps {
  section: NavId;
  index?: number;
  activeIndex?: number;
  children: (state: {
    paused: boolean;
    shouldEnter: boolean;
    shouldLoad: boolean;
    shouldMount: boolean;
    reducedMotion: boolean;
  }) => ReactNode;
}

/**
 * 장식 애니메이션이 현재 실행 가능한지 아는 유일한 통로.
 * 전 섹션이 DOM에 상주하므로 비활성 장식의 반복 작업도 여기서 멈춘다.
 */
export default function WhenVisible({
  section,
  index,
  activeIndex,
  children,
}: WhenVisibleProps) {
  const {
    active,
    entryAnimationTarget,
    pageVisible,
    routeResolved,
    motionReady,
    reducedMotion,
  } = useSectionActivity();

  const sectionActive = section === active;
  const indexActive = index === undefined || index === activeIndex;
  const eligibleToLoad =
    routeResolved &&
    motionReady &&
    !reducedMotion &&
    pageVisible &&
    sectionActive &&
    indexActive;
  const eligibleToMount =
    routeResolved &&
    motionReady &&
    pageVisible &&
    sectionActive &&
    indexActive;
  const [shouldLoad, setShouldLoad] = useState(eligibleToLoad);

  useEffect(() => {
    if (eligibleToLoad) setShouldLoad(true);
  }, [eligibleToLoad]);

  const paused =
    !routeResolved ||
    !motionReady ||
    reducedMotion ||
    !pageVisible ||
    !sectionActive ||
    !indexActive;
  const shouldEnter =
    routeResolved &&
    motionReady &&
    !reducedMotion &&
    pageVisible &&
    sectionActive &&
    entryAnimationTarget === section;
  const shouldMount = shouldLoad || (reducedMotion && eligibleToMount);

  return <>{children({ paused, shouldEnter, shouldLoad, shouldMount, reducedMotion })}</>;
}
