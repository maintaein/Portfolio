
export type ExperienceMetric = { from: number; to: number; suffix: string; label: string };
export type EvidenceDemo = 'inspect' | 'security' | 'calendar' | 'loss' | 'cnn';
export type ExperienceEvidence = { demo: EvidenceDemo; label: string; note?: string; wide: boolean; summary: string };

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
    metrics?: ExperienceMetric[];
    evidence?: ExperienceEvidence[];
    /** 업무 목록 맨 위의 강조 줄 */
    highlight?: string;
  }
  
  export type ExperienceType = Experience['type'];
  
  export const typeLabels: Record<ExperienceType, { label: string; color: 'blue' | 'green' | 'purple' }> = {
    'full-time': { label: '정규직', color: 'blue' },
    'intern': { label: '인턴', color: 'purple' },
    'student': { label: '교육생', color: 'green' },
  };