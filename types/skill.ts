// types/skill.ts

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface Skill {
  name: string;
  icon?: string;
  experience?: string;
}

export interface SkillCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  skills: Skill[];
}

export const levelColors: Record<SkillLevel, 'gray' | 'blue'> = {
  beginner: 'gray',
  intermediate: 'blue',
  advanced: 'blue',
  expert: 'blue',
};

export const levelLabels: Record<SkillLevel, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
  expert: '전문가',
};