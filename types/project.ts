
export interface Implementation {
  category: string;
  items: string[];
  video?: string;
}

// PAAR 빌딩 블록 — 정량 지표. 수치 미확보 시 after='N' 플레이스홀더 허용
export interface KeyMetric {
  label: string;
  before?: string;
  after: string;
  delta?: string;
  measuredBy?: string;
  learned?: string; // 이 수치에서 얻은 핵심 깨달음 (한눈에 보기 성과+배움 페어)
}

// 기술 선정 시 검토하고 탈락시킨 대안 (PAAR의 Analyze)
export interface Alternative {
  name: string;
  rejectedBecause: string;
}

export interface TechReason {
  name: string;
  reasons: string[];
  selectionCriteria?: string;
  alternatives?: Alternative[];
  action?: string[];
  tradeOffs?: string[];
}

export interface ProjectReview {
  id: string;
  title: string;
  image?: string | string[];
  problem?: string;
  analysis?: string[];
  action?: string[];
  result?: KeyMetric[];
  tradeOffs?: string[];
}

export interface Project {
  title: string;
  subtitle?: string;
  image: string;
  imageAspect?: 'landscape' | 'portrait' | 'square' | 'auto';
  tags: string[];
  duration?: string;
  role?: string;
  teamSize?: string;

  motivation?: string;          
  keyMetrics?: KeyMetric[];     

  implementations?: Implementation[];
  techReasons?: TechReason[];
  reviews?: ProjectReview[];
  keyLearnings?: string[];

  demoUrl?: string;
  githubUrl?: string;
}
