
export interface Experience {
    id: string;
    company: string;
    logo?: string;
    position: string;
    period: string;
    type: 'full-time' | 'intern' | 'student';
    description: string;
    responsibilities: string[];
    skills?: string[];
  }
  
  export type ExperienceType = Experience['type'];
  
  export const typeLabels: Record<ExperienceType, { label: string; color: 'blue' | 'green' | 'purple' }> = {
    'full-time': { label: '정규직', color: 'blue' },
    'intern': { label: '인턴', color: 'purple' },
    'student': { label: '교육생', color: 'green' },
  };