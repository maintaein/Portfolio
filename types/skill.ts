
// Skills 재작성(계획 5 T3 개정). 증거 우선 레저를 폐기하고 카테고리별
// 아이콘 그리드로 되돌아간다. icon은 public/icons-mono/의 파일명이다
// (확장자 제외, 예: 'react' -> /icons-mono/react.svg).
export interface Skill {
  name: string;
  icon: string;
  description: string;
  projects?: string;
}

export interface SkillCategory {
  label: string;
  skills: Skill[];
}
