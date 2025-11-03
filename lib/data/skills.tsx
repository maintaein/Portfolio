import { SkillCategory } from "@/types";

export const skillCategories: SkillCategory[] = [
    {
      id: 'language',
      label: 'Language',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      description: '프로그래밍 언어',
      skills: [
        {
          name: 'JavaScript',
          icon: '/icons/JS.png',
          experience: '비동기 처리(Promise, async/await) 및 API 통신 경험, 이벤트 리스너 구현 및 핸들링 경험 보유.'
        },
        {
          name: 'TypeScript',
          icon: '/icons/TS.png',
          experience: '타입 안정성을 활용한 프로젝트 개발 경험, 제네릭 및 유틸리티 타입 활용.'
        },
        {
          name: 'Python',
          icon: '/icons/Python.png',
          experience: '기본 문법 및 자료구조 활용, pandas, numpy 활용한 데이터 분석 경험'
        },
        {
          name: 'Java',
          icon: '/icons/Java.png',
          experience: '객체지향 프로그래밍 기반 애플리케이션 개발, 컬렉션 프레임워크 활용 및 성능 최적화 경험 보유유.'
        },
        {
          name: 'Kotlin',
          icon: '/icons/Kotlin.png',
          experience: '객체지향 프로그래밍 기반 애플리케이션 개발, 컬렉션 프레임워크 활용 및 성능 최적화 경험 보유유.'
        },
        {
          name: 'SQL',
          icon: '/icons/SQL.png',
          experience: '객체지향 프로그래밍 기반 애플리케이션 개발, 컬렉션 프레임워크 활용 및 성능 최적화 경험 보유유.'
        },
      ]
    },
    {
      id: 'frontend',
      label: 'Frontend',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      description: '프론트엔드',
      skills: [
        {
          name: 'React',
          icon: '/icons/React.png',
          experience: 'Hooks, Context API, 컴포넌트 설계 및 최적화 경험, 상태 관리 라이브러리 활용.'
        },
        {
          name: 'Next.js',
          icon: '/icons/next.png',
          experience: 'App Router 기반 개발, SSR/SSG 구현, API Routes 활용, SEO 최적화 경험.'
        },
        {
          name: 'TailwindCSS',
          icon: '/icons/Tailwind.png',
          experience: '유틸리티 클래스 기반 디자인 시스템 구축, 반응형 레이아웃 구현.'
        },
        {
          name: 'React-query',
          icon: '/icons/react-query.png',
          experience: '비동기 데이터 관리 및 서버 상태 캐싱을 통한 API 호출 최적화'
        },
        {
          name: 'Zustand',
          icon: '/icons/zustand.png',
          experience: '전역 상태 관리 및 스토어 구조 설계 경험 보유.'
        },
        {
          name: 'Headless UI',
          icon: '/icons/headless.png',
          experience: 'Tailwind CSS와 조합하여 UI 컴포넌트 구현 경험'
        },
        {
          name: 'Jetpack Compose',
          icon: '/icons/Jetpack.png',
          experience: 'Kotlin기반의 선언적 UI 라이브러리 활용 가능'
        },
        {
          name: 'HTML5',
          icon: '/icons/HTML.png',
          experience: '시맨틱 마크업, 웹 접근성(WAI-ARIA) 준수, SEO 최적화 마크업 작성.'
        },
        {
          name: 'CSS3',
          icon: '/icons/CSS.png',
          experience: 'Flexbox, Grid 레이아웃, 애니메이션, 반응형 디자인 구현 경험.'
        }
      ]
    },
    {
      id: 'backend',
      label: 'Backend',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
      description: '백엔드',
      skills: [
        {
          name: 'Spring Framework',
          icon: '/icons/Spring.png',
          experience: 'MVC 패턴을 이해하고 REST API 구현 및 HTTP 요청 처리 가능.'
        },
        {
          name: 'MySQL',
          icon: '/icons/MySQL.png',
          experience: '데이터 모델링 및 정규화된 스키마 설계 경험.'
        },
        {
          name: 'Express.js',
          icon: '/icons/express.png',
          experience: 'Node.js 기반의 RESTful API 서버 설계 및 구축 이해.'
        }
      ]
    },
    {
      id: 'devtools',
      label: 'DevTools',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: 'DevTools',
      skills: [
        {
          name: 'Github',
          icon: '/icons/github.png',
          experience: '버전 관리 및 브랜치 전략 적용, 커밋 컨벤션을 통한 협업 프로세스 구축.'
        },
        {
          name: 'Figma',
          icon: '/icons/Figma.png',
          experience: 'UI/UX 설계 및 프로토타이핑 도구로 활용.'
        },
        {
          name: 'Notion',
          icon: '/icons/Notion.png',
          experience: '회의록, 요구사항 정의서, API 명세 등 프로젝트 관리 문서 체계화.'
        },
        {
          name: 'Jira',
          icon: '/icons/Jira.png',
          experience: '애자일(Agile) 기반 스프린트 및 백로그 관리 경험 보유.'
        }
      ]
    }
];