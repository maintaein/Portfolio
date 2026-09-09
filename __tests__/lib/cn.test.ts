import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cn } from '@/lib/utils/cn';

const RAMP = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'] as const;

describe('cn: 글자 크기 램프와 글자 색이 부딪히지 않는다', () => {
  // 기본 설정의 tailwind-merge는 text-tN을 모르는 탓에 색으로 오해하고 크기를 지웠다.
  it.each(RAMP)('text-%s는 색 클래스와 같이 써도 살아남는다', (step) => {
    const out = cn(`text-${step} font-bold`, 'text-[var(--color-text-primary)]');
    expect(out).toContain(`text-${step}`);
    expect(out).toContain('text-[var(--color-text-primary)]');
  });

  it('rgb 형태의 색 클래스에서도 살아남는다', () => {
    expect(cn('text-t6', 'text-[rgb(255_255_255_/_0.62)]')).toContain('text-t6');
  });

  it('램프끼리는 여전히 뒤엣것이 이긴다', () => {
    expect(cn('text-t6', 'text-t3')).toBe('text-t3');
  });

  it('Tailwind 기본 크기와도 서로를 밀어낸다', () => {
    expect(cn('text-lg', 'text-t3')).toBe('text-t3');
    expect(cn('text-t3', 'text-lg')).toBe('text-lg');
  });

  it('색끼리 겹치는 기존 동작은 그대로다', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('cn: 램프 등록이 토큰 정의와 어긋나지 않는다', () => {
  it('design-tokens.css가 정의한 유틸을 전부 등록해 뒀다', () => {
    const css = readFileSync('styles/design-tokens.css', 'utf8');
    const defined = [...css.matchAll(/@utility (text-t\d) \{/g)].map((m) => m[1]).sort();
    const source = readFileSync('lib/utils/cn.ts', 'utf8');
    const registered = [...source.matchAll(/'(text-t\d)'/g)].map((m) => m[1]).sort();
    expect(registered).toEqual(defined);
  });
});
