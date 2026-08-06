
import localFont from 'next/font/local';

// Regular + Bold + ExtraBold를 preload한다.
// 부팅 시퀀스의 대형 이름이 첫 화면의 LCP 요소이고 ExtraBold(800)를 쓴다.
// 이 굵기를 preload에서 빼면 시스템 폰트로 먼저 그려졌다 스왑되면서
// 가장 큰 텍스트에서 CLS가 발생한다.
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
    {
      path: '../public/fonts/Pretendard-ExtraBold.subset.woff2',
      weight: '800',
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

// Medium + SemiBold — 첫 화면 밖에서 쓰인다. 브라우저가 필요할 때 요청한다.
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
  ],
  display: 'swap',
  variable: '--font-pretendard-ext',
  preload: false,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
  adjustFontFallback: 'Arial',
});
