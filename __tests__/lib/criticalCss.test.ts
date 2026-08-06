import { describe, it, expect } from 'vitest';
import { CRITICAL_CSS } from '@/lib/criticalCss';
import { darkTokens } from '@/lib/theme/darkTokens';

describe('CRITICAL_CSS', () => {
  it('body 배경이 검정이다', () => {
    expect(CRITICAL_CSS).toContain(`background:${darkTokens.background}`);
  });

  it('라이트 시절 하드코딩이 남아 있지 않다', () => {
    // 첫 페인트에 이 값들이 보이면 흰 화면이 번쩍인다.
    const lightLeftovers = ['#f8faff', '#191f28', '#eef4ff', '#edf3ff'];
    for (const v of lightLeftovers) {
      expect(CRITICAL_CSS, `${v}가 남아 있다`).not.toContain(v);
    }
  });

  it('폐기된 Hero 터미널의 그라데이션 규칙이 없다', () => {
    // 결정 6으로 HeroSection 1,230줄이 삭제된다. #hero 규칙도 함께 간다.
    expect(CRITICAL_CSS).not.toContain('linear-gradient');
  });

  it('box-sizing 리셋은 유지한다', () => {
    expect(CRITICAL_CSS).toContain('box-sizing:border-box');
  });

  it('한 줄로 압축되어 있다', () => {
    // 인라인 <style>에 들어가므로 개행과 들여쓰기는 낭비다.
    expect(CRITICAL_CSS).not.toMatch(/\n\s{2,}/);
  });
});
