
// 증거 우선 레저(Skills 재작성, 계획 5 T3). 기술명·증거·연결 프로젝트가
// 한 행이다. Inventory 11개는 이 모양이 필요 없어 string[]로 둔다
// (lib/data/skills.tsx).
export interface SkillLedgerEntry {
  name: string;
  evidence: string;
  projects: string;
}
