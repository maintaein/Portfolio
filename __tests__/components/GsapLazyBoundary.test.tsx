import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// 표제 계약(gsap-lazy-brief.md) — "GSAP이 First Load JS에 없다".
// BootSequence·HomeClient가 '@/lib/gsap'을 값으로 정적 import하면 webpack이
// core+CustomEase+MotionPathPlugin+Flip을 통째로 First Load JS 청크에 합친다
// (계획 3 Task 6에서 실제로 221,469 → 255,386 bytes로 벌어졌던 원인).
// __tests__/components/HyperspeedBackground.test.tsx의 ssr:false 소스 검사와
// 같은 패턴으로, 소스를 TypeScript AST로 파싱해 두 가지를 직접 판정한다:
//   1) '@/lib/gsap'을 값으로 import하는 문장이 없다(타입 전용 import는 허용 —
//      컴파일 시 완전히 지워지므로 번들에 아무 흔적도 남기지 않는다).
//   2) 그 대신 동적 import('@/lib/gsap')가 실제로 있다(제거만 하고 아예 안
//      쓰는 회귀까지 잡는다).

const TARGET_FILES = [
  path.resolve(process.cwd(), 'components/sections/BootSequence/index.tsx'),
  path.resolve(process.cwd(), 'components/sections/HomeClient/index.tsx'),
];

function analyzeGsapImports(filePath: string) {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  let hasValueImport = false;
  let hasDynamicImport = false;

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (
        ts.isStringLiteral(specifier) &&
        specifier.text === '@/lib/gsap' &&
        !node.importClause?.isTypeOnly
      ) {
        hasValueImport = true;
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const [specifier] = node.arguments;
      if (
        specifier &&
        ts.isStringLiteral(specifier) &&
        specifier.text === '@/lib/gsap'
      ) {
        hasDynamicImport = true;
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return { hasValueImport, hasDynamicImport };
}

describe('GSAP 동적 경계 — First Load JS 표제 계약', () => {
  it.each(TARGET_FILES)(
    '%s은 @/lib/gsap을 값으로 정적 import하지 않는다',
    (filePath) => {
      const { hasValueImport } = analyzeGsapImports(filePath);
      expect(hasValueImport).toBe(false);
    }
  );

  it.each(TARGET_FILES)(
    '%s은 @/lib/gsap을 동적으로 import한다(제거만 하고 안 쓰는 회귀 방지)',
    (filePath) => {
      const { hasDynamicImport } = analyzeGsapImports(filePath);
      expect(hasDynamicImport).toBe(true);
    }
  );
});
