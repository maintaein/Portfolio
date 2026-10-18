'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSectionActivity } from '@/components/common/SectionActivityContext';

export interface WhenVisibleProps {
  visible: boolean;
  index?: number;
  activeIndex?: number;
  children: (state: { paused: boolean; shouldLoad: boolean; shouldMount: boolean; reducedMotion: boolean }) => ReactNode;
}
export default function WhenVisible({ visible, index, activeIndex, children }: WhenVisibleProps) {
  const { pageVisible, routeResolved, motionReady, reducedMotion, obscured } = useSectionActivity();
  const eligible = routeResolved && motionReady && pageVisible && !obscured && visible && (index === undefined || index === activeIndex);
  const [shouldLoad, setShouldLoad] = useState(eligible && !reducedMotion);
  useEffect(() => { if (eligible && !reducedMotion) setShouldLoad(true); }, [eligible, reducedMotion]);
  return <>{children({ paused: !eligible || reducedMotion, shouldLoad, shouldMount: shouldLoad || (eligible && reducedMotion), reducedMotion })}</>;
}
