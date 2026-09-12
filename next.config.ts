// next.config.ts
import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';
const isCspEnforced = process.env.CSP_ENFORCE === 'true';

// 정적 렌더링을 유지하는 1차 CSP. Preview에서 Report-Only 위반을 확인한 뒤
// CSP_ENFORCE=true를 빌드 환경에 설정하면 동일 정책을 강제 모드로 전환한다.
//
// Analytics/SpeedInsights는 basePath나 dsn을 넘기지 않았으므로 프로덕션에서
// 스크립트와 수집 엔드포인트가 전부 동일 출처 상대 경로다
// (/_vercel/insights/script.js, /_vercel/speed-insights/vitals). 'self'가
// 이미 덮는다. va.vercel-scripts.com은 개발 모드 디버그 스크립트에서만 쓰인다.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval' https://va.vercel-scripts.com" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://images.unsplash.com https://i.pravatar.cc",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: isCspEnforced
              ? 'Content-Security-Policy'
              : 'Content-Security-Policy-Report-Only',
            value: contentSecurityPolicy,
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  experimental: {
    // 실제 사용하는 대형 패키지의 import 최적화
    optimizePackageImports: ['@heroicons/react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
    ],
    // 최신 이미지 포맷 우선 사용
    formats: ['image/avif', 'image/webp'],
    // 반응형 이미지 사이즈 최적화
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Gzip 압축 활성화
  compress: true,
  // 엄격 모드
  reactStrictMode: true,
  // 프로덕션 소스맵 비활성화 (성능 향상)
  productionBrowserSourceMaps: false,
};

export default nextConfig;
