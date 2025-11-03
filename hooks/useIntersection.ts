import { useEffect, useRef, useState } from 'react';

interface UseIntersectionOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

interface UseIntersectionReturn<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

export function useIntersection<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionOptions = {}
): UseIntersectionReturn<T> {
  const {
    threshold = 0.1,
    root = null,
    rootMargin = '0px',
    freezeOnceVisible = false,
  } = options;

  const ref = useRef<T>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  const frozen = freezeOnceVisible && isIntersecting;

  useEffect(() => {
    const element = ref.current;
    if (!element || frozen) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, frozen]);

  return {
    ref,
    isIntersecting,
    entry,
  };
}