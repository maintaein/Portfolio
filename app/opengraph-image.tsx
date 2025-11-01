import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '김태인 프론트엔드 개발자 포트폴리오';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: 'linear-gradient(to bottom right, #f3f4f6, #e5e7eb)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 'bold',
            background: 'linear-gradient(to right, #2563eb, #93c5fd)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            marginBottom: '20px',
          }}
        >
          김태인
        </div>
        <div
          style={{
            fontSize: 48,
            color: '#374151',
            marginBottom: '40px',
          }}
        >
          Frontend Developer
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#6b7280',
            display: 'flex',
            gap: '20px',
          }}
        >
          <span>React</span>
          <span>•</span>
          <span>Next.js</span>
          <span>•</span>
          <span>TypeScript</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
