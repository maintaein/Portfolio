import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-ink)] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold tracking-widest text-[var(--color-cyan-core)] uppercase mb-4">
        404
      </p>
      <h1 className="text-d3 font-bold text-[var(--color-text-primary)] mb-3">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-t5 text-[var(--color-text-secondary)] mb-8">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 border border-[var(--color-elevation-near)] text-[var(--color-text-primary)] text-sm tracking-widest uppercase hover:border-[var(--color-cyan-hi)] hover:text-[var(--color-cyan-hi)] transition-colors duration-300"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
