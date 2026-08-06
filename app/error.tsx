'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--color-ink)] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold tracking-widest text-[var(--color-cyan-core)] uppercase mb-4">
        Error
      </p>
      <h1 className="text-d3 font-bold text-[var(--color-text-primary)] mb-3">
        문제가 발생했습니다
      </h1>
      <p className="text-t5 text-[var(--color-text-secondary)] mb-8">
        일시적인 오류입니다. 다시 시도해 주세요.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-5 py-2.5 border border-[var(--color-elevation-near)] text-[var(--color-text-primary)] text-sm tracking-widest uppercase hover:border-[var(--color-cyan-hi)] hover:text-[var(--color-cyan-hi)] transition-colors duration-300"
      >
        다시 시도
      </button>
    </div>
  );
}
