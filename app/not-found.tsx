import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold tracking-widest text-blue-500 uppercase mb-4">404</p>
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">페이지를 찾을 수 없습니다</h1>
      <p className="text-base text-gray-500 mb-8">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors duration-200"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
