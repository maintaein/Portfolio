import { SkillCategory } from "@/types";

export const skillCategories: SkillCategory[] = [
    {
      id: 'Programing Languages',
      label: 'Programing Languages',
      skills: [
        {
          name: 'JavaScript',
          icon: '/icons/JS.webp',
          experience: '비동기 처리(Promise, async/await) 및 API 통신 경험, 이벤트 리스너 구현 및 핸들링 경험 보유.'
        },
        {
          name: 'TypeScript',
          icon: '/icons/TS.webp',
          experience: '타입 안정성을 활용한 프로젝트 개발 경험, 제네릭 및 유틸리티 타입 활용.'
        },
        {
          name: 'Python',
          icon: '/icons/Python.webp',
          experience: '기본 문법 및 자료구조 활용, pandas, numpy 활용한 데이터 분석 경험'
        },
        {
          name: 'Java',
          icon: '/icons/Java.webp',
          experience: '객체지향 프로그래밍 기반 애플리케이션 개발, 컬렉션 프레임워크 활용 및 성능 최적화 경험 보유.'
        },
      ]
    },
    {
      id: 'Framework / Library',
      label: 'Framework / Library',
      skills: [
        {
          name: 'Node.js',
          icon: '/icons/nodejs.webp',
          experience: 'Express 기반 REST API 서버 구현, 미들웨어 체계 구성 및 비동기 이벤트 루프 활용 경험.'
        },
        {
          name: 'React',
          icon: '/icons/React.webp',
          experience: 'Hooks, Context API, 컴포넌트 설계 및 최적화 경험, 상태 관리 라이브러리 활용.'
        },
        {
          name: 'Next.js',
          icon: '/icons/next.webp',
          experience: 'App Router 기반 개발, SSR/SSG 구현, API Routes 활용, SEO 최적화 경험.'
        },
        {
          name: 'TailwindCSS',
          icon: '/icons/Tailwind.webp',
          experience: '유틸리티 클래스 기반 디자인 시스템 구축, 반응형 레이아웃 구현.'
        },
        {
          name: 'React-query',
          icon: '/icons/react-query.webp',
          experience: '비동기 데이터 관리 및 서버 상태 캐싱을 통한 API 호출 최적화'
        },
        {
          name: 'Zustand',
          icon: '/icons/zustand.webp',
          experience: '전역 상태 관리 및 스토어 구조 설계 경험 보유.'
        },
        {
          name: 'Spring Framework',
          icon: '/icons/Spring.webp',
          experience: 'MVC 패턴을 이해하고 REST API 구현 및 HTTP 요청 처리 가능.'
        },
      ]
    },
    {
      id: 'server',
      label: 'Server',
      skills: [
        {
          name: 'MySQL',
          icon: '/icons/MySQL.webp',
          experience: '데이터 모델링 및 정규화된 스키마 설계 경험.'
        },
        {
          name: 'Linux',
          icon: '/icons/linux.webp',
          experience: '리눅스 서버 구축 및 통신체계 이해.'
        }
      ]
    },
    {
      id: 'devtools',
      label: 'DevTools',
      skills: [
        {
          name: 'Github',
          icon: '/icons/github.webp',
          experience: '버전 관리 및 브랜치 전략 적용, 커밋 컨벤션을 통한 협업 프로세스 구축.'
        },
        {
          name: 'Figma',
          icon: '/icons/Figma.webp',
          experience: 'UI/UX 설계 및 프로토타이핑 도구로 활용.'
        },
        {
          name: 'Notion',
          icon: '/icons/Notion.webp',
          experience: '회의록, 요구사항 정의서, API 명세 등 프로젝트 관리 문서 체계화.'
        },
        {
          name: 'Jira',
          icon: '/icons/Jira.webp',
          experience: '애자일(Agile) 기반 스프린트 및 백로그 관리 경험 보유.'
        }
      ]
    }
];
