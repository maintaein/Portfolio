// app/layout.tsx
import { Metadata } from 'next';
import { pretendard } from '@/lib/fonts';
import JsonLd from '@/components/seo/JsonLd';
import '@/styles/design-tokens.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';


const siteUrl = 'https://kimtaein.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

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
      url: siteUrl,
    }
  ],

  creator: '김태인',
  publisher: '김태인',

  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
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
    canonical: siteUrl,
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
    <html lang="ko" className={pretendard.variable}>
      <head>
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