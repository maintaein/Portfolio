import { useLayoutEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export interface MotionPreference {
  ready: boolean;
  reduced: boolean;
}

// HomeClient만 호출한다. 준비 전에는 모션을 허용하지 않는다.
export function useMotionPreference(): MotionPreference {
  const [preference, setPreference] = useState<MotionPreference>({
    ready: false,
    reduced: true,
  });

  useLayoutEffect(() => {
    if (typeof matchMedia !== 'function') {
      setPreference({ ready: true, reduced: true });
      return;
    }

    const mediaQueryList = matchMedia(QUERY);
    setPreference({ ready: true, reduced: mediaQueryList.matches });

    const onChange = (event: MediaQueryListEvent) => {
      setPreference({ ready: true, reduced: event.matches });
    };

    mediaQueryList.addEventListener('change', onChange);
    return () => mediaQueryList.removeEventListener('change', onChange);
  }, []);

  return preference;
}
