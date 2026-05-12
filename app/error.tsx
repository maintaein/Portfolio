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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold tracking-widest text-red-500 uppercase mb-4">Error</p>
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">문제가 발생했습니다</h1>
      <p className="text-base text-gray-500 mb-8">일시적인 오류입니다. 다시 시도해 주세요.</p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
      >
        다시 시도
      </button>
    </div>
  );
}
