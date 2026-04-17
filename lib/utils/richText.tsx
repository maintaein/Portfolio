import React from 'react';

/**
 * 강조 마크업 규칙:
 *   **텍스트**  → <strong> (핵심 기술어, 수치, 결론)
 *   `텍스트`    → <code>   (코드 심볼, API명, 메서드명, 속성명)
 *   __텍스트__  → <mark>   (형광펜 강조 — 핵심 문장)
 */
export function parseRichText(text: string): React.ReactNode[] {
  // 토큰 분리: **...**, `...`, __...__ 순서로 파싱
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|__[^_]+__)/g;
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-grey-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded text-[11px] font-mono bg-grey-100 text-blue-700">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return (
        <mark key={i} className="bg-amber-200/70 text-grey-900 font-medium px-0.5 rounded-sm" style={{ boxDecorationBreak: 'clone' }}>
          {part.slice(2, -2)}
        </mark>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** string 배열의 각 항목에 parseRichText 적용 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{parseRichText(text)}</span>;
}
