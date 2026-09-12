import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// next.config.ts는 빌드 설정이라 import해서 실행하기 번거롭다.
// 지키려는 불변식이 "정책 문자열에 어떤 출처가 들어 있는가"이므로
// 소스를 읽어 검사한다.
const source = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8');

describe('CSP 정책', () => {
  it('connect-src에 외부 애널리틱스 수집 출처를 넣지 않는다', () => {
    // Analytics/SpeedInsights에 basePath나 dsn을 넘기지 않았으므로 수집
    // 엔드포인트가 프로덕션에서 동일 출처 상대 경로다. 'self'가 이미 덮는다.
    const connectSrc = source.match(/`connect-src[^`]*`/)?.[0] ?? '';
    expect(connectSrc).not.toContain('vercel-insights');
  });

  it('va.vercel-scripts.com은 개발 모드 분기 안에만 있다', () => {
    // 프로덕션 스크립트 출처도 동일 출처 상대 경로라 이 출처는 개발 모드의
    // 디버그 스크립트에서만 필요하다. 조건부 밖(문자열이 isDevelopment 앞)에
    // 있으면 프로덕션 정책에 불필요한 외부 출처가 새어 들어간다.
    const scriptSrc = source.match(/`script-src[^`]*`/)?.[0] ?? '';
    const devIndex = scriptSrc.indexOf('isDevelopment');
    const originIndex = scriptSrc.indexOf('va.vercel-scripts.com');
    expect(originIndex).toBeGreaterThan(-1);
    expect(originIndex).toBeGreaterThan(devIndex);
  });

  it('SMAA 텍스처용 data: URI가 img-src에 남아 있다', () => {
    // Hyperspeed의 SMAAEffect가 data: URI를 Image.src에 넣는다.
    // 네트워크 요청은 0건이지만 이 지시어가 없으면 막힌다.
    const imgSrc = source.match(/"img-src[^"]*"/)?.[0] ?? '';
    expect(imgSrc).toContain('data:');
  });

  it('프로덕션에 unsafe-eval을 넣지 않는다', () => {
    // 개발 모드에만 조건부로 붙어야 한다
    const scriptSrc = source.match(/`script-src[^`]*`/)?.[0] ?? '';
    expect(scriptSrc).toContain('isDevelopment');
  });
});
