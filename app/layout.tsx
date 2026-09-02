// app/layout.tsx
import { Metadata, Viewport } from 'next';
import { pretendardCore, pretendardExtended } from '@/lib/fonts';
import JsonLd from '@/components/seo/JsonLd';
import '@/styles/design-tokens.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { siteConfig } from '@/lib/siteConfig';
import { CRITICAL_CSS } from '@/lib/criticalCss';

// styles/design-tokens.css가 env(safe-area-inset-bottom)으로 .section-stage의
// 하단 여백과 .site-footer의 높이를 계산한다. 그런데 Next의 기본 viewport에는
// viewport-fit=cover가 없고, 그 선언이 없으면 iOS에서 env()가 언제나 0으로
// 잡혀 그 계산이 조용히 무의미해진다. 푸터가 홈 인디케이터에 깔린다.
// 두 파일이 같은 계약을 공유하므로 __tests__/docs/designCanon.test.ts가
// CSS의 safe area 사용과 이 선언을 짝지어 지킨다.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),

  title: {
    default: '김태인의 프론트엔드 포트폴리오',
    template: '%s | 김태인 Portfolio',
  },

  description: '사용자 경험을 최우선으로 생각하는 프론트엔드 개발자 김태인입니다. React, Next.js, TypeScript를 활용한 웹 개발 프로젝트를 소개합니다.',

  keywords: [
    '김태인',
    '프론트엔드 개발자',
    '프론트엔드 포트폴리오',
    'React 개발자',
    'Next.js 개발자',
    'TypeScript 개발자',
    '웹 개발자 포트폴리오',
    'Frontend Developer',
    'AlphaMail',
    'Rebirth',
    'Ttabong',
    '삼성청년SW아카데미',
    'SSAFY',
    '웹 프론트엔드',
    'UI/UX',
    'Tailwind CSS',
    'React Query',
    'Zustand',
    'Kotlin',
    'Jetpack Compose',
    '웹 개발',
    '반응형 웹',
    '사용자 경험',
    'UX 디자인',
    '인터페이스 개발',
    'SPA',
    '컴포넌트 기반 개발',
    '프론트엔드 엔지니어',
    '웹 애플리케이션',
    '자바스크립트 개발자',
  ],

  authors: [
    {
      name: '김태인',
      url: siteConfig.url,
    }
  ],

  creator: '김태인',
  publisher: '김태인',

  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteConfig.url,
    title: '김태인의 프론트엔드 포트폴리오',
    description: '사용자 경험을 최우선으로 생각하는 프론트엔드 개발자 김태인입니다. React, Next.js, TypeScript를 활용한 웹 개발 프로젝트를 소개합니다.',
    siteName: '김태인 Portfolio',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '김태인 프론트엔드 개발자 포트폴리오',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: '김태인의 프론트엔드 포트폴리오',
    description: '사용자 경험을 최우선으로 생각하는 프론트엔드 개발자',
    images: ['/opengraph-image'],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  alternates: {
    canonical: siteConfig.url,
  },

  category: 'technology',

  verification: {
    google: 'GcIgkVqhMiqgEPezjtAFubVXXQ09wLSIQiEtM-YZas0',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${pretendardCore.variable} ${pretendardExtended.variable}`}>
      <head>
        {/* CSS 파일 요청 이전에 배경을 검정으로 확정한다.
            흰 화면이 한 프레임이라도 보이면 부팅 시퀀스의 첫인상이 깨진다. */}
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
        <meta name="naver-site-verification" content="125d5eedfefaa060cae94d8d07f62f7a9127b907" />
        <JsonLd />
      </head>
      <body className="font-pretendard antialiased overflow-x-hidden">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
