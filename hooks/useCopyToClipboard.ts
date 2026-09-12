import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyStatus = 'copied' | 'failed';

interface CopyState {
  key: string;
  status: CopyStatus;
}

export function useCopyToClipboard(resetDelay = 2000) {
  const [state, setState] = useState<CopyState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string, key = 'default') => {
      let succeeded = false;
      try {
        await navigator.clipboard.writeText(text);
        succeeded = true;
      } catch {
        succeeded = false;
      }

      // 새 호출이 이전 타이머를 먼저 지운다. 안 그러면 앞 타이머가 뒤
      // 상태를 조기에 지운다.
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setState({ key, status: succeeded ? 'copied' : 'failed' });
      timeoutRef.current = setTimeout(() => {
        setState(null);
      }, resetDelay);

      return succeeded;
    },
    [resetDelay]
  );

  return { state, copy };
}
