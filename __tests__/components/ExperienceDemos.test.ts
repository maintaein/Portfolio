import { describe, expect, it } from 'vitest';
import { DEMOS, monthProgress } from '@/components/sections/ExperienceSection/demos';
import type { EvidenceDemo } from '@/types';

// jsdom에는 2d 컨텍스트가 없다. 그리기 호출은 모두 받아 넘기고, 글자 폭만 길이에 비례하게 돌려준다
// (달력 막대의 줄바꿈·글자 줄이기 분기까지 타게 한다).
function mockContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  const store: Record<string | symbol, unknown> = {
    canvas: document.createElement('canvas'),
    measureText: (s: string) => ({ width: s.length * 7 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return new Proxy(store, {
    get: (o, k) => (k in o ? o[k] : () => undefined),
    set: (o, k, v) => {
      o[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('경력 증거 카드 그리기', () => {
  it('모든 데모는 t 0, 2, 9와 still에서 오류 없이 그린다', () => {
    for (const demo of Object.keys(DEMOS) as EvidenceDemo[]) {
      for (const w of [900, 360]) {
        for (const t of [0, 2, 9]) expect(() => DEMOS[demo](mockContext(), w, 300, t, false)).not.toThrow();
        expect(() => DEMOS[demo](mockContext(), w, 300, 99, true)).not.toThrow();
      }
    }
    expect(Object.keys(DEMOS).sort()).toEqual(['calendar', 'cnn', 'inspect', 'loss', 'security']);
  });

  it('달은 .3초 간격으로 .8초씩 켜진다', () => {
    expect(monthProgress(0.2, 0)).toBe(0);
    expect(monthProgress(1, 0)).toBe(1);
    expect(monthProgress(0.5, 1)).toBe(0);
    expect(monthProgress(0, 11, true)).toBe(1);
  });
});
