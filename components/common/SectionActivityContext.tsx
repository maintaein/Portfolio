'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { NavId } from '@/hooks/useSectionNav';

interface SectionActivityState {
  active: NavId;
  entryAnimationTarget: NavId | null;
  pageVisible: boolean;
  routeResolved: boolean;
  motionReady: boolean;
  reducedMotion: boolean;
}

export interface SectionActivityProviderProps extends SectionActivityState {
  children: ReactNode;
}

const SectionActivityContext = createContext<Readonly<SectionActivityState> | null>(
  null
);

export function SectionActivityProvider({
  active,
  entryAnimationTarget,
  pageVisible,
  routeResolved,
  motionReady,
  reducedMotion,
  children,
}: SectionActivityProviderProps) {
  const value = useMemo(
    () => ({
      active,
      entryAnimationTarget,
      pageVisible,
      routeResolved,
      motionReady,
      reducedMotion,
    }),
    [
      active,
      entryAnimationTarget,
      pageVisible,
      routeResolved,
      motionReady,
      reducedMotion,
    ]
  );

  return (
    <SectionActivityContext.Provider value={value}>
      {children}
    </SectionActivityContext.Provider>
  );
}

export function useSectionActivity(): Readonly<SectionActivityState> {
  const state = useContext(SectionActivityContext);
  if (state === null) {
    throw new Error(
      'useSectionActivity must be used within SectionActivityProvider'
    );
  }

  return state;
}
