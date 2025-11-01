// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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