
export interface Implementation {
  category: string;
  items: string[];
  // 영상 아래 설명. 오른쪽 목록은 items를 그대로 쓰므로, 같은 문장이 두 군데
  // 겹치지 않게 영상 쪽만 구현 의도로 갈아 끼운다. 없으면 items[0]로 돌아간다
  intent?: string;
  video?: string;
  image?: string;
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

export interface ProjectReview {
  title: string;
  problem?: string;
  analysis?: string[];
  action?: string[];
  result?: KeyMetric[];
  // 결과 절의 큰 제목 한 줄. 지표가 여러 개면 그중 하나(result[0].after)를
  // 제목으로 세우는 게 맞지 않는다 — 대표 성과를 따로 적는다.
  // 없으면 result[0].after로 돌아간다(지표가 하나뿐인 리뷰의 기존 동작)
  resultHeadline?: string;
  tradeOffs?: string[];
}

export interface Project {
  title: string;
  subtitle?: string;
  image: string;
  tags: string[];
  duration?: string;
  // duration은 전체 기간 하나. 단계가 나뉜 프로젝트만 phases로 쪼개 적는다
  phases?: { label: string; period: string }[];
  role?: string;
  teamSize?: string;
  motivation?: string;

  implementations?: Implementation[];
  reviews?: ProjectReview[];

  githubUrl?: string;
}
