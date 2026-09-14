import { describe, expect, it } from 'vitest';
import {
  isProjectModalReady,
  parseAnalysisEntry,
  selectFeaturedReview,
  validateProjectContract,
} from '@/lib/utils/projectContract';
import { projects } from '@/lib/data';
import type { Project } from '@/types/index';

const EM_DASH = '\u2014';

function findProject(title: string): Project {
  const found = projects.find((p) => p.title.includes(title));
  if (!found) throw new Error(`프로젝트를 못 찾았다: ${title}`);
  return found;
}

// 통과하는 프로젝트를 얕게 베껴 결함 하나만 주입한다.
function withDefect(base: Project, patch: Partial<Project>): Project {
  return { ...base, ...patch };
}

describe('parseAnalysisEntry', () => {
  it('줄표로 라벨과 이름을 가르고 본문을 뗀다', () => {
    const entry = parseAnalysisEntry(
      `**진단 ${EM_DASH} 두 타이머가 충돌하고 있었다**: React Query의 refetchInterval이 이미 있었다.`
    );
    expect(entry).not.toBeNull();
    expect(entry!.kind).toBe('diagnosis');
    expect(entry!.label).toBe('진단');
    expect(entry!.name).toBe('두 타이머가 충돌하고 있었다');
    expect(entry!.body).toBe('React Query의 refetchInterval이 이미 있었다.');
    expect(entry!.chosen).toBe(false);
  });

  it('줄표가 없으면 첫 콜론으로 가른다', () => {
    const entry = parseAnalysisEntry(
      '**선택지 3: ref 대신 props로 받는다 (선택)**: 래퍼가 버리는 것은 ref뿐이다.'
    );
    expect(entry!.kind).toBe('option');
    expect(entry!.label).toBe('선택지 3');
    expect(entry!.name).toBe('ref 대신 props로 받는다');
    expect(entry!.body).toBe('래퍼가 버리는 것은 ref뿐이다.');
    expect(entry!.chosen).toBe(true);
  });

  it('하이픈으로는 가르지 않는다', () => {
    // 파서는 하이픈이 아니라 줄표 문자로 갈라야 한다
    expect(parseAnalysisEntry('**진단 - 하이픈이다**: 본문')).toBeNull();
  });

  it('(선택)이 chosen이 되고 표시 이름에서 빠진다', () => {
    const entry = parseAnalysisEntry(
      `**선택지 3 ${EM_DASH} 역할 분리 (선택)**: 두 문제는 성격이 다르다.`
    );
    expect(entry!.kind).toBe('option');
    expect(entry!.label).toBe('선택지 3');
    expect(entry!.name).toBe('역할 분리');
    expect(entry!.chosen).toBe(true);
  });

  it('형태가 깨진 문자열은 null이다', () => {
    expect(parseAnalysisEntry('')).toBeNull();
    expect(parseAnalysisEntry('머리도 본문도 없다')).toBeNull();
    expect(parseAnalysisEntry(`**진단 ${EM_DASH} 닫는 별표가 없다: 본문`)).toBeNull();
  });

  it('진단도 선택지도 아니면 other다', () => {
    const entry = parseAnalysisEntry(`**배경 ${EM_DASH} 어떤 이름**: 본문`);
    expect(entry!.kind).toBe('other');
  });
});

describe('selectFeaturedReview', () => {
  it('reviews[0]만 고른다', () => {
    const alphaMail = findProject('AlphaMail');
    expect(selectFeaturedReview(alphaMail)).toBe(alphaMail.reviews![0]);
  });

  it('reviews가 비면 null이다. 뒤에서 찾아오지 않는다', () => {
    const alphaMail = findProject('AlphaMail');
    // 0번이 계약을 못 채워도 규칙이 조용히 다른 항목으로 넘어가면
    // 배열 순서가 곧 편집이라는 전제가 깨진다
    expect(selectFeaturedReview(withDefect(alphaMail, { reviews: [] }))).toBeNull();
  });
});

describe('validateProjectContract - 양성', () => {
  it('AlphaMail·Portfolio·TDS가 판 2 계약을 통과한다', () => {
    for (const title of ['AlphaMail', 'Portfolio', 'TDS']) {
      const violations = validateProjectContract(findProject(title));
      const panel2 = violations.filter((v) => v.field.startsWith('reviews[0]'));
      expect(panel2, `${title} 판 2: ${JSON.stringify(panel2)}`).toEqual([]);
    }
  });
});

describe('validateProjectContract - 음성 (결함을 하나씩 주입한다)', () => {
  const base = () => findProject('AlphaMail');

  it('result[0].after가 N이면 거부한다', () => {
    const source = base();
    const review = { ...source.reviews![0], result: [{ label: '지표', after: 'N' }] };
    const project = withDefect(source, { reviews: [review, ...source.reviews!.slice(1)] });
    // 픽스처가 정말 그 결함을 들고 있는지 먼저 확인한다.
    // 잘못 만든 픽스처가 조용히 통과하면 이 테스트는 아무것도 안 지킨다
    expect(project.reviews![0].result![0].after).toBe('N');
    expect(
      validateProjectContract(project).some((v) => v.field === 'reviews[0].result[0].after')
    ).toBe(true);
  });

  it('result[0].after가 TODO면 거부한다', () => {
    const source = base();
    const review = { ...source.reviews![0], result: [{ label: '지표', after: 'TODO' }] };
    const project = withDefect(source, { reviews: [review] });
    expect(project.reviews![0].result![0].after).toBe('TODO');
    expect(isProjectModalReady(project)).toBe(false);
  });

  it('motivation이 비면 거부한다', () => {
    const project = withDefect(base(), { motivation: '' });
    expect(project.motivation).toBe('');
    expect(
      validateProjectContract(project).some((v) => v.field === 'motivation')
    ).toBe(true);
  });

  it('메타 세 칸 중 하나만 비어도 거부한다', () => {
    const project = withDefect(base(), { teamSize: undefined });
    expect(project.teamSize).toBeUndefined();
    expect(
      validateProjectContract(project).some((v) => v.field === 'teamSize')
    ).toBe(true);
  });

  it('구현 기능이 2개 미만이면 거부한다', () => {
    const source = base();
    const one = withDefect(source, { implementations: source.implementations!.slice(0, 1) });
    expect(one.implementations).toHaveLength(1);
    expect(isProjectModalReady(one)).toBe(false);
  });

  it('구현 기능의 category나 items[0]이 비면 거부한다', () => {
    const source = base();
    const impls = source.implementations!.map((impl, i) =>
      i === 1 ? { ...impl, items: [] } : impl
    );
    const project = withDefect(source, { implementations: impls });
    expect(project.implementations![1].items).toHaveLength(0);
    expect(
      validateProjectContract(project).some(
        (v) => v.field === 'implementations[1].items[0]'
      )
    ).toBe(true);
  });

  it('구현 기능이 5개 이상이어도 통과한다', () => {
    // 상한 4는 캡션 `01 / 04`를 예쁘게 하려는 표현 제약이지 데이터 온전성이
    // 아니다. Portfolio가 실제로 6개다
    const source = base();
    const six = withDefect(source, {
      implementations: [...source.implementations!, ...source.implementations!],
    });
    expect(six.implementations).toHaveLength(8);
    expect(
      validateProjectContract(six).some((v) => v.field === 'implementations')
    ).toBe(false);
  });

  it('video가 없어도 통과한다', () => {
    // 지금 mp4가 붙은 프로젝트는 AlphaMail 하나다. 계약에 넣으면 여섯 중
    // 하나만 열린다. 좌측 무대는 영상이 없으면 project.image로 떨어지고
    // 판은 안 빈다
    const source = base();
    const impls = source.implementations!.map((impl) => ({ ...impl, video: undefined }));
    const project = withDefect(source, { implementations: impls });
    expect(project.implementations!.every((i) => !i.video)).toBe(true);
    expect(isProjectModalReady(project)).toBe(true);
  });

  it('진단이 2개면 거부한다', () => {
    const source = base();
    const diagnosis = `**진단 ${EM_DASH} 또 하나의 진단**: 본문입니다.`;
    const review = {
      ...source.reviews![0],
      analysis: [...source.reviews![0].analysis!, diagnosis],
    };
    const project = withDefect(source, { reviews: [review] });
    expect(
      project.reviews![0].analysis!.filter((a) => a.startsWith('**진단'))
    ).toHaveLength(2);
    expect(
      validateProjectContract(project).some((v) => v.field === 'reviews[0].analysis')
    ).toBe(true);
  });

  it('선택지가 1개면 거부한다', () => {
    const source = base();
    const analysis = source.reviews![0].analysis!.filter(
      (a) => !a.startsWith('**선택지')
    );
    const review = {
      ...source.reviews![0],
      analysis: [...analysis, `**선택지 1 ${EM_DASH} 하나뿐 (선택)**: 본문입니다.`],
    };
    const project = withDefect(source, { reviews: [review] });
    expect(
      project.reviews![0].analysis!.filter((a) => a.startsWith('**선택지'))
    ).toHaveLength(1);
    expect(isProjectModalReady(project)).toBe(false);
  });

  it('채택 표식이 0개면 거부한다', () => {
    const source = base();
    const analysis = source.reviews![0].analysis!.map((a) => a.replace(' (선택)', ''));
    const review = { ...source.reviews![0], analysis };
    const project = withDefect(source, { reviews: [review] });
    expect(project.reviews![0].analysis!.some((a) => a.includes('(선택)'))).toBe(false);
    expect(isProjectModalReady(project)).toBe(false);
  });

  it('위반을 첫 건에서 멈추지 않고 전부 모은다', () => {
    const project = withDefect(base(), {
      motivation: '',
      subtitle: '',
      tags: [],
    });
    expect(validateProjectContract(project).length).toBeGreaterThanOrEqual(3);
  });
});

describe('현재 데이터 현황', () => {
  // 데이터는 사용자 소유이고 정제 예정이다. 대신 채우지 않는다.
  // 이 테스트는 지금 상태를 고정할 뿐 사용자에게 작업을 요구하지 않는다.
  // 2026-09-14에 실제 데이터를 돌려 잰 값이다.
  it('일곱 다 모달을 연다', () => {
    // 실패하면 어느 프로젝트의 어느 칸이 빈 것인지 바로 보여야 한다.
    // 목록만 비교하면 "여섯이다"까지만 알려주고 원인을 안 알려준다
    const blocked = projects
      .filter((p) => !isProjectModalReady(p))
      .map((p) => `${p.title}: ${JSON.stringify(validateProjectContract(p))}`);
    expect(blocked).toEqual([]);
  });
});
