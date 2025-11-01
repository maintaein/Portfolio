// types/project.ts

export interface ImplementationItem {
  text: string;
  video?: string;
  image?: string;
}

export interface ImplementationGroup {
  category: string;
  items: (string | ImplementationItem)[];
}

export interface TechReason {
  name: string;
  reasons: string[];
}

export interface TroubleShooting {
  title: string;
  image?: string;
  initialImpl?: string;
  problem?: string[];
  analysis?: string[];
  solution?: string;
  solutionCode?: string;
  results?: string[];
  lessons?: string[];
}

export interface ProjectReview {
  id: string;
  title: string;
  category?: string;
  image?: string | string[];
  features?: string[];
  intent?: string;
  troubleShooting?: TroubleShooting;
}

export interface Project {
  title: string;
  description: string;
  subtitle?: string;
  longDescription?: string;
  image: string;
  imageAspect?: 'landscape' | 'portrait' | 'square' | 'auto';
  tags: string[];
  duration?: string;
  role?: string;
  teamSize?: string;

  // 새로운 필드
  implementations?: (string | ImplementationItem | ImplementationGroup)[];
  responsibilities?: string[];
  techReasons?: TechReason[];
  reviews?: ProjectReview[];
  keyLearnings?: string[];

  // 링크
  demoUrl?: string;
  githubUrl?: string;
}