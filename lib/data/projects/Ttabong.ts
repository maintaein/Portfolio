import { Project } from '@/types';

export const ttabong: Project = {
  title: 'Ttabong',
  subtitle: '봉사 기관과 봉사자를 연결하는 웹 SNS 큐레이팅 봉사 매칭 플랫폼',
  description: '봉사 기관과 봉사자를 연결하는 웹 SNS 큐레이팅 봉사 매칭 플랫폼',
  longDescription:'Ttabong을 통해 기관은 효율적으로 봉사자를 모집하고, 봉사자는 자신에게 맞는 봉사활동을 쉽게 찾을 수 있습니다.',
  image: '/projects/Ttabong.png',
  imageAspect: 'landscape',
  tags: ['React', 'TypeScript', 'TailwindCSS', 'Zustand', 'Framer Motion'],
  duration: '2025.01 - 2025.02',
  role: '웹 프론트엔드 개발',
  teamSize: '6명',

  implementations: [
    {
      category: '봉사자',
      items: [
        '🔍 봉사 공고 검색 및 매칭: 봉사자와 공고 매칭, 카테고리, 위치, 날짜별 필터링을 통한 검색',
        '💌 카드 스와이프 디자인: 틴더와 갈은 매칭 시스템 디자인, 직관적이고 편리한 봉사 공고 탐색',
        '📝 후기 시스템: 실시간 댓글 기능으로 커뮤니티 활성화, 공개/비공개 설정으로 프라이버시 보호',
        '💼 마이 페이지: 나의 신청 내역, 대기/승인/완료 상태 한눈에 파악'
      ]
    },
    {
      category: '봉사 기관',
      items: [
        '📋 기관용 공고 관리 시스템: 템플릿 저장/재사용으로 공고 작성 시간 단축, 공개/비공개 설정으로 프라이버시 보호',
        '✅ 지원자 및 공고 상태 관리: 지원자 상태 관리(대기 → 승인/거절), 공고 상태 변경(모집마감) 지원',
        '💼 마이 페이지: 공고 목록, 지원자 현황, 템플릿 관리'
      ]
    }
  ],

  responsibilities: [
    '웹 프론트엔드 개발'
  ],

  techReasons: [
    {
      name: 'React',
      reasons: [
        '활발한 생태계와 풍부한 학습 자료로 공부와 프로젝트를 동시에 진행하기 좋겠다고 생각함.',
        '선언적 UI와 컴포넌트 기반 개발로 봉사자/기관 두 가지 사용자 타입에 따른 복잡한 조건부 렌더링을 관리하기 용이할 것이라고 판단.'
      ]
    },
    {
      name: 'TypeScript',
      reasons: [
        '공고 데이터, 신청 정보, 사용자 프로필 등 다양한 백엔드 응답 구조를 관리하여 undefined 에러를 사전에 방지.',
      ]
    },
    {
      name: 'TailwindCSS',
      reasons: [
        '별도 CSS 파일 작성 부담 감소로 개발 속도 향상.',
        '동적 스타일 변경을 조건부 클래스로 간편히 구현할 수 있다고 생각함.'
      ]
    },
    {
      name: 'Zustand',
      reasons: [
        'TypeScript와의 완벽한 호환성을 갖는다고 하여 도입, 자동 타입 추론으로 자동 완성을 지원.',
        'store별 상태와 액션의 타입이 자동으로 유추되어 안전한 코드를 작성.'
      ]
    },
    {
      name: 'Framer Motion',
      reasons: [
        '틴더의 카드 스와이프 UI처럼 봉사 공고를 큐레이션 하기 위해 활용.',
      ]
    }
  ],

  keyLearnings: [
    '상태 관리의 중요성: 같은 데이터가 여러 곳에서 관리되면 불일치가 발생한다는 것을 경험. Zustand로 중앙집중식 상태 관리를 도입하여 봉사자/기관 간 다른 UI를 효율적으로 관리',
    '컴포넌트 분리의 필요성: 처음엔 한 파일에 몇백 줄이 들어있었으나, 작은 컴포넌트로 나누니 각각을 이해하기 쉽고 버그를 찾기도 쉬워짐',
    '기술 부채 관리: 처음부터 폴더 구조를 체계적으로 설계하고, 빠르게 상태 관리 라이브러리를 도입했으면 리팩토링 부담이 줄었을 것'
  ],

  reviews: [
    {
      id: 'volunteer-home',
      category: '봉사자 계정',
      title: '1. 홈 페이지(공고 큐레이션 매칭)',
      image: [
        '/projects/ttabong/home1.png',
        '/projects/ttabong/home2.png',
        '/projects/ttabong/home3.png'
      ],
      features: [
        '카드 스와이핑으로 직관적인 공고 탐색',
        '공고 상세 정보 확인 및 즉시 신청',
        '좋아요/싫어요 제스처로 선호도 표시'
      ],
      intent: '사용자가 로그인 후 직관적인 인터페이스에서 원하는 봉사활동을 쉽게 찾을 수 있게 하는 것을 목표로 했습니다. 카드 스와이핑이라는 친숙한 상호작용으로 봉사활동 탐색을 게임처럼 즐기면서 관심 공고를 빠르게 찾을 수 있도록 설계했습니다.',
    },
    {
      id: 'volunteer-search',
      category: '봉사자 계정',
      title: '2. 공고 검색/ 후기 관리',
      image: [
        '/projects/ttabong/search.png',
        '/projects/ttabong/review1.png',
        '/projects/ttabong/review2.png'
      ],
      features: [
        '카테고리, 위치, 날짜별 필터링을 통한 정교한 검색',
        '상태별 공고 분류 (모집중 → 모집마감 → 활동완료)',
        '완료된 봉사활동 목록에서 후기 작성, 공개/비공개 설정',
        '갤러리 형식으로 모든 후기 탐색 및 댓글 참여 가능'
      ],
      intent: '사용자가 자신에게 맞는 봉사를 직접 찾고 선택할 수 있도록 했습니다. 필터링 검색 방식을 제공하여 사용자의 선호도에 맞춘 경험을 제공합니다. 또한 커뮤니티를 만들기 위해 후기 작성과 공유를 설계했습니다. 커뮤니티가 형성되어야 봉사 활동이 더욱 활성화 된다고 생각했습니다. 완료된 봉사에서 바로 후기를 작성할 수 있고, 다른 사용자의 후기를 갤러리로 탐색하며 댓글로 상호작용할 수 있습니다.',
    },
    {
      id: 'organization-home',
      category: '봉사 기관 계정',
      title: '1. 공고 관리/ 공고 작성/ 후기 관리',
      image: [
        '/projects/ttabong/organization-home.png',
        '/projects/ttabong/organization-create.png',
        '/projects/ttabong/organization-review.png'
      ],
      features: [
        '등록한 모든 공고를 상태별로 필터링 (전체 → 모집중 → 모집마감 → 활동완료)',
        '5단계 폼으로 단계별 가이드 (그룹선택 → 공고내용 → 모집조건 → 봉사지 → 담당자정보)',
        '각 단계별 입력값 검증으로 오류 방지',
        '템플릿으로 저장하여 반복 공고 빠르게 생성',
        '완료된 봉사활동에 대한 기관 후기 작성',
      ],
      intent: '기관 담당자가 모든 공고와 지원자를 한눈에 관리할 수 있도록 설계했습니다.  템플릿 저장 기능으로 반복되는 공고 작성 시간을 단축하여 기관의 업무 효율을 높입니다. 기관과 봉사자 양측의 투명한 평가를 통해 신뢰도를 높이는 양방향 평가 시스템도 추가했습니다.',
    },
  ],

  githubUrl: 'https://github.com/maintaein/ttabong',

};
