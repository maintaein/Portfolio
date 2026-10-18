'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface SectionActivityState {
  pageVisible: boolean;
  routeResolved: boolean;
  motionReady: boolean;
  reducedMotion: boolean;
  obscured: boolean;
}
export interface SectionActivityProviderProps extends SectionActivityState { children: ReactNode }
const SectionActivityContext = createContext<Readonly<SectionActivityState> | null>(null);
export function SectionActivityProvider({ pageVisible, routeResolved, motionReady, reducedMotion, obscured, children }: SectionActivityProviderProps) {
  const value = useMemo(() => ({ pageVisible, routeResolved, motionReady, reducedMotion, obscured }),
    [pageVisible, routeResolved, motionReady, reducedMotion, obscured]);
  return <SectionActivityContext.Provider value={value}>{children}</SectionActivityContext.Provider>;
}
export function useSectionActivity(): Readonly<SectionActivityState> {
  const state = useContext(SectionActivityContext);
  if (state === null) throw new Error('useSectionActivity must be used within SectionActivityProvider');
  return state;
}
