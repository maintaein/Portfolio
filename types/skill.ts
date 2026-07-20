
export interface Skill {
  name: string;
  icon?: string;
  experience?: string;
}

export interface SkillCategory {
  id: string;
  label: string;
  skills: Skill[];
}
