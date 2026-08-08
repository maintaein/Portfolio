import { describe, it, expect } from 'vitest';
import { CRITICAL_CSS } from '@/lib/criticalCss';
import { darkTokens } from '@/lib/theme/darkTokens';

describe('CRITICAL_CSS', () => {
  it('body 배경이 검정이다', () => {
    expect(CRITICAL_CSS).toContain(`background:${darkTokens.background}`);
  });

  it('정해진 두 다크 토큰 외의 색상을 포함하지 않는다', () => {
    const hexColours = CRITICAL_CSS.match(
      /#(?:[\da-fA-F]{8}|[\da-fA-F]{6}|[\da-fA-F]{4}|[\da-fA-F]{3})\b/g,
    ) ?? [];

    expect(new Set(hexColours)).toEqual(
      new Set([darkTokens.background, darkTokens.text.primary]),
    );
  });

  it('box-sizing 리셋은 유지한다', () => {
    expect(CRITICAL_CSS).toContain('box-sizing:border-box');
  });
});
