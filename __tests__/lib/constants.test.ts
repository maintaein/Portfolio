import { describe, it, expect } from 'vitest';
import { HOME_SECTION_CONFIG, NAV_ITEMS } from '@/lib/constants';

describe('HOME_SECTION_CONFIG', () => {
  it('디자인 리뷰가 확정한 순서를 따른다', () => {
    // overview는 Hero 상태이므로 이 배열에 없다.
    // 확정 순서: overview → about → projects → experience → skills →
    // awards-certificates → contact(여섯 번째 섹션으로 승격)
    expect(HOME_SECTION_CONFIG.map((s) => s.id)).toEqual([
      'about',
      'projects',
      'experience',
      'skills',
      'awards-certificates',
      'contact',
    ]);
  });

  it('revealDelay가 배열 순서대로 증가한다', () => {
    const delays = HOME_SECTION_CONFIG.map((s) => s.revealDelay);
    const sorted = [...delays].sort((a, b) => a - b);
    expect(delays).toEqual(sorted);
  });

  it('NAV_ITEMS가 같은 순서를 그대로 물려받는다', () => {
    expect(NAV_ITEMS.map((n) => n.id)).toEqual(HOME_SECTION_CONFIG.map((s) => s.id));
  });
});
