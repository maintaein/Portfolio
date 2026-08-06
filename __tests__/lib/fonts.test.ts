import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// next/font/local은 빌드타임 변환이라 vitest에서 실행할 수 없다.
// 그래서 소스 텍스트를 직접 검사한다. 지키려는 불변식이 "어느 블록에
// 어떤 파일이 들어 있느냐"이므로 소스 검사가 오히려 정확하다.
const source = readFileSync(resolve(__dirname, '../../lib/fonts.ts'), 'utf8');

function blockOf(name: string): string {
  const start = source.indexOf(`export const ${name}`);
  expect(start, `${name} 선언을 찾지 못했다`).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const end = rest.indexOf('\n});');
  return rest.slice(0, end === -1 ? rest.length : end);
}

describe('lib/fonts.ts', () => {
  it('LCP 요소가 쓰는 ExtraBold가 preload되는 그룹에 있다', () => {
    // 부팅 시퀀스의 대형 이름이 weight 800이다.
    expect(blockOf('pretendardCore')).toContain('Pretendard-ExtraBold');
  });

  it('core 그룹이 preload된다', () => {
    expect(blockOf('pretendardCore')).toContain('preload: true');
  });

  it('core 그룹에 폴백 메트릭 보정이 걸려 있다', () => {
    // 없으면 스왑 순간 글자 폭이 달라져 CLS가 난다.
    expect(blockOf('pretendardCore')).toContain('adjustFontFallback');
  });

  it('extended 그룹에도 폴백 메트릭 보정이 걸려 있다', () => {
    expect(blockOf('pretendardExtended')).toContain('adjustFontFallback');
  });

  it('extended 그룹은 여전히 preload하지 않는다', () => {
    // 500/600은 첫 화면에 안 쓰인다. 전부 preload하면 초기 전송량이 늘어난다.
    expect(blockOf('pretendardExtended')).toContain('preload: false');
  });

  it('폐기된 터미널을 전제로 한 주석이 남아 있지 않다', () => {
    expect(source).not.toContain('터미널');
  });
});
