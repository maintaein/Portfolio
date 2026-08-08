
import localFont from 'next/font/local';

// Regular와 Bold는 현재 화면에서 사용하므로 preload한다.
// ExtraBold는 weight 800을 아직 사용하지 않아 preload하지 않는다.
// 3단계에서 부팅 시퀀스의 큰 이름과 글리프 집합이 확정되면 다시 검토한다.
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
  adjustFontFallback: 'Arial',
});
