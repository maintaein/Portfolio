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
        <strong key={i} className="font-semibold text-[var(--color-text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded text-[11px] font-mono bg-[rgb(255_255_255_/_0.08)] text-[var(--color-cyan-hi)]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return (
        <mark key={i} className="bg-[rgb(3_179_195_/_0.22)] text-[var(--color-text-primary)] font-medium px-0.5 rounded-sm" style={{ boxDecorationBreak: 'clone' }}>
          {part.slice(2, -2)}
        </mark>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/**
 * RichText — 인라인 마크업 + \n- 글머리 목록 지원
 * \n- 로 시작하는 줄이 하나라도 있으면 본문 + 하위 글머리 구조로 렌더링
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const bodyLines: string[] = [];
  const bulletLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('- ')) {
      bulletLines.push(line.slice(2));
    } else if (line.trim()) {
      bodyLines.push(line);
    }
  }

  if (bulletLines.length === 0) {
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    if (paragraphs.length > 1) {
      return (
        <div className={className}>
          {paragraphs.map((p, i) => (
            <p key={i} className={i > 0 ? 'mt-3' : undefined}>{parseRichText(p)}</p>
          ))}
        </div>
      );
    }
    return <span className={className}>{parseRichText(text)}</span>;
  }

  return (
    <div className={className}>
      <span>{parseRichText(bodyLines.join(' '))}</span>
      <ul className="mt-1.5 space-y-1 pl-1">
        {bulletLines.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-[5px] w-1 h-1 rounded-full bg-[rgb(255_255_255_/_0.25)] flex-shrink-0" />
            <span className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{parseRichText(b)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
