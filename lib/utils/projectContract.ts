// 프로젝트 공개 최소 계약. 계약을 못 채우는 프로젝트는 모달을 열지 않는다.
// 빈 판을 그리거나 자리를 접어 메우지 않는다. 판 둘이 같은 크기로 서는 것이
// 이 디자인의 전제이고, 한쪽이 비면 전제가 무너진다.
// 정본은 .claude/designRefactoring/2026-09-09-t2-implementation-spec.md §6
import type { Project, ProjectReview } from '@/types/index';

// 이스케이프로 쓴다. 이 저장소는 산문에서 줄표를 금지하기 때문에 리터럴로
// 두면 언젠가 정리 대상으로 오인돼 파서가 조용히 깨진다.
const EM_DASH = '\u2014';
const PLACEHOLDER_METRICS = new Set(['', 'N', 'TODO']);

export type AnalysisKind = 'diagnosis' | 'option' | 'other';

export interface AnalysisEntry {
  kind: AnalysisKind;
  label: string;
  name: string;
  body: string;
  chosen: boolean;
}

export interface ContractViolation {
  project: string;
  field: string;
  reason: string;
}

// 형태: **<라벨> — <이름>**: <본문>
// 라벨과 이름은 줄표(U+2014)로 가른다. 하이픈이 아니다.
export function parseAnalysisEntry(raw: string): AnalysisEntry | null {
  const match = raw.match(/^\*\*(.+?)\*\*:\s*([\s\S]+)$/);
  if (!match) return null;

  const head = match[1];
  const body = match[2].trim();
  const dash = head.indexOf(EM_DASH);
  if (dash === -1) return null;

  const label = head.slice(0, dash).trim();
  const rawName = head.slice(dash + 1).trim();
  const chosen = rawName.includes('(선택)');
  const name = rawName.replace('(선택)', '').trim();
  if (!label || !name || !body) return null;

  const kind: AnalysisKind = label.startsWith('진단')
    ? 'diagnosis'
    : label.startsWith('선택지')
      ? 'option'
      : 'other';

  return { kind, label, name, body, chosen };
}

// reviews[0]만 본다. 0번이 계약을 못 채워도 뒤에서 찾아오지 않는다.
export function selectFeaturedReview(project: Project): ProjectReview | null {
  return project.reviews?.[0] ?? null;
}

export function validateProjectContract(project: Project): ContractViolation[] {
  const out: ContractViolation[] = [];
  const fail = (field: string, reason: string) =>
    out.push({ project: project.title, field, reason });
  const need = (value: string | undefined, field: string) => {
    if (!value || !value.trim()) fail(field, '비어 있다');
  };

  // 판 1
  need(project.title, 'title');
  need(project.subtitle, 'subtitle');
  need(project.duration, 'duration');
  need(project.role, 'role');
  need(project.teamSize, 'teamSize');
  need(project.motivation, 'motivation');
  if (!project.tags?.length) fail('tags', '1개 이상이어야 한다');

  const impls = project.implementations ?? [];
  // 하한 2만 본다. 하나뿐이면 좌측 무대를 넘길 것이 없다.
  // 상한은 두지 않는다. 캡션이 `01 / 06`을 그냥 쓴다.
  // video도 보지 않는다. 없으면 무대가 project.image로 떨어지고 판은 안 빈다
  if (impls.length < 2) {
    fail('implementations', `2개 이상이어야 하는데 ${impls.length}개다`);
  }
  impls.forEach((impl, i) => {
    need(impl.category, `implementations[${i}].category`);
    need(impl.items?.[0], `implementations[${i}].items[0]`);
  });

  // 판 2. reviews[0]만 본다
  const review = selectFeaturedReview(project);
  if (!review) {
    fail('reviews[0]', '없다');
    return out;
  }

  need(review.title, 'reviews[0].title');
  need(review.problem, 'reviews[0].problem');
  if (!review.action?.length) fail('reviews[0].action', '1개 이상이어야 한다');
  if (!review.tradeOffs?.length) fail('reviews[0].tradeOffs', '1개 이상이어야 한다');

  const metric = review.result?.[0];
  if (!metric) {
    fail('reviews[0].result', '1개 이상이어야 한다');
  } else if (PLACEHOLDER_METRICS.has(metric.after.trim())) {
    fail('reviews[0].result[0].after', `자리 표시자다: ${metric.after}`);
  }

  const entries = (review.analysis ?? [])
    .map(parseAnalysisEntry)
    .filter((e): e is AnalysisEntry => e !== null);
  const diagnoses = entries.filter((e) => e.kind === 'diagnosis');
  const options = entries.filter((e) => e.kind === 'option');
  const chosen = options.filter((e) => e.chosen);

  if (diagnoses.length !== 1) {
    fail('reviews[0].analysis', `진단이 정확히 1개여야 하는데 ${diagnoses.length}개다`);
  }
  if (options.length < 2) {
    fail('reviews[0].analysis', `선택지가 2개 이상이어야 하는데 ${options.length}개다`);
  }
  if (chosen.length !== 1) {
    fail('reviews[0].analysis', `채택이 정확히 1개여야 하는데 ${chosen.length}개다`);
  }

  return out;
}

export function isProjectModalReady(project: Project): boolean {
  return validateProjectContract(project).length === 0;
}
