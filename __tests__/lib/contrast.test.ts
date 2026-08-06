import { describe, it, expect } from 'vitest';
import { contrastRatio } from '@/lib/utils/contrast';

describe('contrastRatio', () => {
  it('흰색과 검정은 21:1이다', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('같은 색끼리는 1:1이다', () => {
    expect(contrastRatio('#03b3c3', '#03b3c3')).toBeCloseTo(1, 2);
  });

  it('순서를 바꿔도 같은 값이다', () => {
    const a = contrastRatio('#03b3c3', '#000000');
    const b = contrastRatio('#000000', '#03b3c3');
    expect(a).toBeCloseTo(b, 5);
  });

  it('시안 강조색은 검정 위에서 AAA를 넘는다', () => {
    expect(contrastRatio('#03b3c3', '#000000')).toBeGreaterThan(7);
  });

  it('장식용 파랑은 검정 위에서 AA 본문 기준에 미달한다', () => {
    // 이 값이 4.5를 넘게 되면 계획의 전제가 바뀐 것이다. 그때 문서를 고쳐라.
    expect(contrastRatio('#0e5ea5', '#000000')).toBeLessThan(4.5);
  });

  it('3자리 단축 표기도 처리한다', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 1);
  });
});
