import { SkillCategory } from '@/types';

// 카테고리별 아이콘 그리드(계획 5 T3 개정). 증거 우선 레저를 폐기하고
// 이전 포트폴리오의 핵심(아이콘, 호버 설명, 카테고리 분류)으로 되돌아간다.
// icon은 public/icons-mono/의 파일명이다(컨트롤러가 이미 만들어 둔 17개
// SVG, 다시 만들지 않는다).
//
// 핵심 6개(React, TypeScript, Next.js, React Query, Zustand, Tailwind CSS)의
// description·projects는 디자인 리뷰 D23이 정본이다. 문구를 바꾸지 않는다.
// 나머지 11개는 이전 사이트 문구를 그대로 쓴다. 원본의 Github 표기는
// GitHub로, TailwindCSS는 Tailwind CSS로, React-query는 React Query로
// 정상화했다.
export const skillCategories: SkillCategory[] = [
  {
    label: 'LANGUAGES',
    skills: [
      {
        name: 'JavaScript',
        icon: 'javascript',
        description:
          '비동기 처리(Promise, async/await) 및 API 통신 경험, 이벤트 리스너 구현 및 핸들링 경험 보유.',
      },
      {
        name: 'TypeScript',
        icon: 'typescript',
        description:
          'strict/no-any와 타입 기반 디자인 토큰으로 잘못된 참조를 컴파일 단계에서 차단',
        projects: 'TDS · AlphaMail · Portfolio · Ttabong',
      },
      {
        name: 'Python',
        icon: 'python',
        description: '기본 문법 및 자료구조 활용, pandas, numpy 활용한 데이터 분석 경험',
      },
      {
        name: 'Java',
        icon: 'java',
        description:
          '객체지향 프로그래밍 기반 애플리케이션 개발, 컬렉션 프레임워크 활용 및 성능 최적화 경험 보유.',
      },
    ],
  },
  {
    label: 'FRAMEWORK',
    skills: [
      {
        name: 'Node.js',
        icon: 'nodejs',
        description:
          'Express 기반 REST API 서버 구현, 미들웨어 체계 구성 및 비동기 이벤트 루프 활용 경험.',
      },
      {
        name: 'React',
        icon: 'react',
        description: '컴포넌트 구독 범위를 Profiler로 진단하고 불필요한 연쇄 렌더를 제거',
        projects: 'AlphaMail · TDS · Ttabong',
      },
      {
        name: 'Next.js',
        icon: 'nextjs',
        description: 'SSG/SSR·SEO를 적용하고 hydration 경고를 0건으로 정리',
        projects: 'Portfolio',
      },
      {
        name: 'Tailwind CSS',
        icon: 'tailwind',
        description: '세 웹 프로젝트에서 반응형 UI와 공통 스타일 규칙을 일관되게 적용',
        projects: 'AlphaMail · Portfolio · Ttabong',
      },
      {
        name: 'React Query',
        icon: 'react-query',
        description:
          '중복 폴링을 단일 20초 전략으로 통합하고 사용자 액션 완료 시 캐시를 즉시 무효화',
        projects: 'AlphaMail',
      },
      {
        name: 'Zustand',
        icon: 'zustand',
        description: '입력 한 번당 4~5회 연쇄 렌더를 해당 필드 구독 컴포넌트 1회로 축소',
        projects: 'AlphaMail · Ttabong',
      },
      {
        name: 'Spring',
        icon: 'spring',
        description: 'MVC 패턴을 이해하고 REST API 구현 및 HTTP 요청 처리 가능.',
      },
    ],
  },
  {
    label: 'SERVER',
    skills: [
      {
        name: 'MySQL',
        icon: 'mysql',
        description: '데이터 모델링 및 정규화된 스키마 설계 경험.',
      },
      {
        name: 'Linux',
        icon: 'linux',
        description: '리눅스 서버 구축 및 통신체계 이해.',
      },
    ],
  },
  {
    label: 'DEVTOOLS',
    skills: [
      {
        name: 'GitHub',
        icon: 'github',
        description: '버전 관리 및 브랜치 전략 적용, 커밋 컨벤션을 통한 협업 프로세스 구축.',
      },
      {
        name: 'Figma',
        icon: 'figma',
        description: 'UI/UX 설계 및 프로토타이핑 도구로 활용.',
      },
      {
        name: 'Notion',
        icon: 'notion',
        description: '회의록, 요구사항 정의서, API 명세 등 프로젝트 관리 문서 체계화.',
      },
      {
        name: 'Jira',
        icon: 'jira',
        description: '애자일(Agile) 기반 스프린트 및 백로그 관리 경험 보유.',
      },
    ],
  },
];
