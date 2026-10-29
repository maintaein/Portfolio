import { describe, expect, it } from 'vitest';
import { experiences } from '@/lib/data/experience';

const byCompany = (name: string) => {
  const found = experiences.find((e) => e.company === name);
  if (!found) throw new Error(`경력 항목 없음: ${name}`);
  return found;
};

describe('경력 데이터', () => {
  it('FASOO는 장애 수치 둘과 점검·보안 카드를 갖는다', () => {
    const fasoo = byCompany('FASOO');
    expect(fasoo.metrics).toEqual([
      { from: 0, to: -30, suffix: '%', label: '장애 발생률 평균' },
      { from: 20, to: 3, suffix: '분', label: '장애 시 평균 복구 시간 (20분 → 3분)' },
    ]);
    expect(fasoo.evidence?.map((c) => c.demo)).toEqual(['inspect', 'security']);
    expect(fasoo.evidence?.every((c) => c.wide)).toBe(true);
    expect(fasoo.highlight).toBe(
      '자동 정기점검 툴 개발로 장애 발생률 평균 30% 하락, 장애 시 평균 복구 시간 20분 → 3분',
    );
  });

  it('삼성청년SW아카데미는 1620시간·우수상 2회와 달력 카드를 갖는다', () => {
    const ssafy = byCompany('삼성청년SW아카데미');
    expect(ssafy.metrics).toEqual([
      { from: 0, to: 1620, suffix: 'h', label: '학습 시간' },
      { from: 0, to: 2, suffix: '회', label: '우수상 수상' },
    ]);
    expect(ssafy.evidence?.map((c) => c.demo)).toEqual(['calendar']);
    expect(ssafy.evidence?.[0].wide).toBe(true);
    expect(ssafy.evidence?.[0].note).toBe('2024년 7월 ~ 2025년 6월 · 총 1620시간');
    expect(ssafy.highlight).toBe('우수상 2회 수상, 학습 1620시간');
  });

  it('지능정보SW아카데미는 학습 곡선과 CNN 카드만 갖고 수치는 없다', () => {
    const kua = byCompany('지능정보SW아카데미');
    expect(kua.evidence?.map((c) => c.demo)).toEqual(['loss', 'cnn']);
    expect(kua.evidence?.every((c) => !c.wide)).toBe(true);
    expect(kua.metrics).toBeUndefined();
    expect(kua.position).toBe('AI 개발 / 교육생 · 고려대학교 주관');
  });

  it('Elasticsearch는 어디에도 없다', () => {
    expect(JSON.stringify(experiences)).not.toMatch(/elasticsearch/i);
  });

  it('모든 증거 카드는 sr-only 문장을 갖는다', () => {
    const cards = experiences.flatMap((e) => e.evidence ?? []);
    expect(cards.length).toBe(5);
    for (const card of cards) expect(card.summary.length).toBeGreaterThan(0);
  });
});
