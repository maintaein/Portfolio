
import localFont from 'next/font/local';

// Regular + Bold만 preload — 초기 렌더에 필요한 최소 weight (~538KB)
// HeroSection 터미널은 font-mono(시스템 폰트)라 Pretendard 불필요
// Pretendard 실제 필요 시점: 타이핑 완료 후 h1/본문 등장 (~3.2초 이후)
export const pretendardCore = localFont({
  src: [
    {
      path: '../public/fonts/Pretendard-Regular.subset.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Pretendard-Bold.subset.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-pretendard',
  preload: true,
  fallback: [
    '-apple-system',
    'BlinkMacSystemFont',
    'system-ui',
    'Roboto',
    'Helvetica Neue',
    'Segoe UI',
    'Apple SD Gothic Neo',
    'Noto Sans KR',
    'Malgun Gothic',
    'sans-serif',
  ],
  adjustFontFallback: 'Arial',
});

// Medium + SemiBold + ExtraBold — 필요 시 브라우저가 자동 요청 (preload 없음)
export const pretendardExtended = localFont({
  src: [
    {
      path: '../public/fonts/Pretendard-Medium.subset.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/Pretendard-SemiBold.subset.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/Pretendard-ExtraBold.subset.woff2',
      weight: '800',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-pretendard-ext',
  preload: false,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
});
