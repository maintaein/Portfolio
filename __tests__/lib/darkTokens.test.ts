import { describe, it, expect } from 'vitest';
import { darkTokens } from '@/lib/theme/darkTokens';
import { contrastRatio } from '@/lib/utils/contrast';

describe('darkTokens', () => {
  it('배경은 순수 검정이다', () => {
    expect(darkTokens.background).toBe('#000000');
  });

  it('텍스트 역할의 모든 색이 본문 대비 4.5:1을 넘는다', () => {
    for (const [role, color] of Object.entries(darkTokens.text)) {
      const ratio = contrastRatio(color, darkTokens.background);
      expect(ratio, `${role}(${color})의 대비 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('장식용 파랑은 텍스트 역할에 들어 있지 않다', () => {
    // #0e5ea5는 검정 위 3.16:1이라 본문으로 쓸 수 없다.
    // 누군가 이 색을 text 그룹으로 옮기면 여기서 막힌다.
    expect(Object.values(darkTokens.text)).not.toContain('#0e5ea5');
    expect(darkTokens.decoration.dim).toBe('#0e5ea5');
  });

  it('마젠타·보라 계열이 어디에도 없다', () => {
    const banned = ['#d856bf', '#6750a2', '#c247ac'];
    const all = [
      darkTokens.background,
      ...Object.values(darkTokens.text),
      darkTokens.decoration.dim,
    ].map((c) => c.toLowerCase());

    for (const b of banned) {
      expect(all).not.toContain(b);
    }
  });
});
