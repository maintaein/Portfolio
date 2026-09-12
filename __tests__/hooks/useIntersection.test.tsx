import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// SectionHeader가 마지막 whileInView 사용자였다. 계획 5 T5-C가 그 컴포넌트를
// 진행도 레일로 다시 쓰면서 이 원장을 비웠다. 다음에 whileInView를 쓰는
// 컴포넌트가 생기면 여기 다시 담아 count까지 잠글 수 있도록 타입은 남겨
// 둔다(빈 객체 리터럴만 두면 keyof가 never가 되어 아래 인덱싱이 깨진다).
const WHILE_IN_VIEW_DEBT: Record<string, { plan: number; count: number }> = {};

function collectComponentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectComponentFiles(path);
    return entry.isFile() && path.endsWith('.tsx') ? [path] : [];
  });
}

// components 디렉터리 전체를 재귀적으로 읽어 문자열 검사하는 작업이다.
// 전체 스위트(35+ 파일 병렬)에서는 CPU 경합만으로 기본 5초를 넘겨 플레이키가
// 됐다(checkBundle.test.ts와 같은 부류다). 수행 시간이 아니라 대기가 원인이다.
describe('섹션 진입 애니메이션 트리거', { timeout: 30_000 }, () => {
  it('useIntersection을 사용하는 컴포넌트의 IntersectionObserver 진입 판정을 차단한다', () => {
    const componentRoot = resolve(process.cwd(), 'components');
    const sources = collectComponentFiles(componentRoot).map((file) => {
      const source = readFileSync(file, 'utf8');
      const relativePath = file.slice(process.cwd().length + 1).replaceAll('\\', '/');
      return { relativePath, source };
    });
    const ioOffenders = sources
      .filter(({ source }) =>
        source.includes('useIntersection') ||
        source.includes('IntersectionObserver(') ||
        /\b(?:const|let)\s+\w+\s*=\s*window\.IntersectionObserver/.test(source) ||
        source.includes('useInView')
      )
      .map(({ relativePath }) => relativePath);
    const whileInViewOffenders = sources
      .filter(({ source }) => source.includes('whileInView'))
      .map(({ relativePath, source }) => ({
        relativePath,
        count: source.match(/whileInView/g)?.length ?? 0,
      }));
    const debtPaths = Object.keys(WHILE_IN_VIEW_DEBT);

    const offenders = ioOffenders.filter(
      (relativePath) => !debtPaths.includes(relativePath)
    );

    expect(
      offenders,
      `섹션 진입 판정에 IntersectionObserver를 사용하는 파일: ${offenders.join(', ')}`
    ).toEqual([]);
    expect(whileInViewOffenders.map(({ relativePath }) => relativePath).sort()).toEqual(
      debtPaths.sort()
    );
    for (const offender of whileInViewOffenders) {
      expect(offender.count).toBe(
        WHILE_IN_VIEW_DEBT[offender.relativePath as keyof typeof WHILE_IN_VIEW_DEBT].count
      );
    }
  });

  // About 장식의 WhenVisible 통합 테스트 셋을 지웠다. About 재설계가 장식
  // 컴포넌트 자체를 폐기했다. 배경이 이미 있는데 별도 도형을 얹으면 경쟁한다.
  // WhenVisible의 게이팅 계약은 WhenVisible.test.tsx가 컴포넌트와 무관하게
  // 덮는다.
});
