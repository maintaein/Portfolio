import { useEffect, useState } from 'react';

function readPageVisibility() {
  return typeof document !== 'undefined' && document.visibilityState !== 'hidden';
}

export function usePageVisibility(): boolean {
  const [pageVisible, setPageVisible] = useState(readPageVisibility);

  useEffect(() => {
    const syncVisibility = () => {
      setPageVisible(readPageVisibility());
    };
    const handlePageHide = () => {
      setPageVisible(false);
    };

    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', syncVisibility);

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', syncVisibility);
    };
  }, []);

  return pageVisible;
}
