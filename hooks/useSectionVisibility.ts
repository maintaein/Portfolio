import { useEffect, useState } from 'react';
import { useIntersection } from './useIntersection';

export function useSectionVisibility<T extends HTMLElement>() {
  const { ref, isIntersecting: visible } = useIntersection<T>({ threshold: 0, freezeOnceVisible: false });
  const [hasEntered, setHasEntered] = useState(false);
  useEffect(() => { if (visible) setHasEntered(true); }, [visible]);
  return { ref, visible, hasEntered };
}
