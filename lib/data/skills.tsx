import { SkillLedgerEntry } from "@/types";

// 핵심 6개 증거 우선 레저. 디자인 리뷰 D23에서 문구까지 확정했다. 순서와
// 문구를 바꾸지 않는다(계획 5 T3 브리프).
export const skillLedger: SkillLedgerEntry[] = [
  {
    name: 'React',
    evidence: '컴포넌트 구독 범위를 Profiler로 진단하고 불필요한 연쇄 렌더를 제거',
    projects: 'AlphaMail · TDS · Ttabong',
  },
  {
    name: 'TypeScript',
    evidence: 'strict/no-any와 타입 기반 디자인 토큰으로 잘못된 참조를 컴파일 단계에서 차단',
    projects: 'TDS · AlphaMail · Portfolio · Ttabong',
  },
  {
    name: 'Next.js',
    evidence: 'SSG/SSR·SEO를 적용하고 hydration 경고를 0건으로 정리',
    projects: 'Portfolio',
  },
  {
    name: 'React Query',
    evidence: '중복 폴링을 단일 20초 전략으로 통합하고 사용자 액션 완료 시 캐시를 즉시 무효화',
    projects: 'AlphaMail',
  },
  {
    name: 'Zustand',
    evidence: '입력 한 번당 4~5회 연쇄 렌더를 해당 필드 구독 컴포넌트 1회로 축소',
    projects: 'AlphaMail · Ttabong',
  },
  {
    name: 'Tailwind CSS',
    evidence: '세 웹 프로젝트에서 반응형 UI와 공통 스타일 규칙을 일관되게 적용',
    projects: 'AlphaMail · Portfolio · Ttabong',
  },
];

// 나머지 11개. 설명·숙련도·아이콘 없이 조용한 한 줄 목록이다. 원본 데이터의
// Github 표기를 공개 화면에서 GitHub로 정상화했다.
export const skillInventory: string[] = [
  'JavaScript',
  'Python',
  'Java',
  'Node.js',
  'Spring Framework',
  'MySQL',
  'Linux',
  'GitHub',
  'Figma',
  'Notion',
  'Jira',
];
