import { Project } from '@/types';

export const ttabong: Project = {
  title: 'Ttabong',
  subtitle: '따뜻한 봉사, 따봉. 웹 SNS 큐레이팅 봉사 매칭 플랫폼',
  image: '/projects/Ttabong.webp',
  tags: ['React', 'TypeScript', 'TailwindCSS', 'Zustand', 'Framer Motion'],
  duration: '2025.01 - 2025.02',
  role: '웹 프론트엔드 개발',
  teamSize: '6명',

  motivation: 'SNS 활성화를 통해 봉사의 활성화를 기대하다. 직접 봉사활동을 하면서 관련 사이트들을 찾아봤는데, 대부분 텍스트 위주라 어떤 활동인지 한눈에 들어오지 않았습니다. 이런 경험이 봉사 진입 장벽을 높이는 원인이 될 수 있겠다는 생각이 들었고, 핀터레스트나 인스타그램처럼 보는 재미가 있는 큐레이션 형태로 봉사 공고를 탐색할 수 있으면 더 많은 사람이 자연스럽게 참여하지 않을까라는 생각에서 시작했습니다.',
  implementations: [
    {
      category: '홈',
      items: [
        '카드 스와이프 디자인: 틴더와 같은 매칭 시스템 디자인, 직관적이고 편리한 봉사 공고 탐색',
      ],
      image:'/projects/ttabong/home1.webp'
    },
    {
      category: '검색',
      items: [
        '봉사 공고 검색 및 매칭: 봉사자와 공고 매칭, 카테고리, 위치, 날짜별 필터링을 통한 검색'
      ],
      image:'/projects/ttabong/search.webp'
    },
    {
      category: '후기 관리',
      items: [
        '후기 시스템: 실시간 댓글 기능으로 커뮤니티 활성화, 공개/비공개 설정으로 프라이버시 보호'
      ],
      image:'/projects/ttabong/review1.webp'
    }
  ],

  reviews: [
    {
      title: '홈 페이지 — 카드 스와이프로 봉사 공고 탐색',
      problem: '봉사 공고를 목록으로만 보여주면 사용자가 공고를 하나씩 읽으며 직접 비교해야 합니다. 로그인 직후 바로 탐색을 시작할 수 있는 방법이 필요했습니다.',
      analysis: [
        '**진단: 목록형 탐색은 공고를 하나씩 읽어야 한다**: 봉사 공고의 제목, 위치, 날짜, 설명을 한 카드에서 확인하고 바로 다음 공고로 넘어갈 수 있어야 했습니다.',
        '**선택지 1: 목록형 검색만 제공한다**: 원하는 공고를 찾을 수 있지만, 공고를 비교하며 계속 스크롤해야 해 첫 화면의 행동이 분명하지 않습니다.',
        '**선택지 2: 카드 스와이프로 빠르게 선택한다 (선택)**: 카드에서 공고를 확인한 뒤 오른쪽은 관심 봉사 등록, 왼쪽은 봉사 거절로 연결했습니다. 자세히 보고 싶은 경우에는 카드 안의 상세보기 버튼을 사용하도록 했습니다.',
      ],
      action: [
        '@react-spring/web과 react-use-gesture로 카드 드래그와 스와이프 구현',
        '스와이프 방향에 따라 관심 봉사 등록 및 봉사 거절 API 호출',
        '카드 안의 상세보기 버튼으로 공고 상세 페이지 연결',
      ],
      resultHeadline: '봉사 공고 탐색부터 관심 등록까지 카드 한 장으로 연결',
      result: [
        { label: '공고 탐색', after: '카드 스와이프로 공고를 한 장씩 확인', measuredBy: '홈 페이지 구현 기능 확인' },
        { label: '선택 행동', after: '오른쪽은 관심 봉사 등록, 왼쪽은 봉사 거절', measuredBy: '스와이프 방향별 API 호출 코드 확인' },
        { label: '상세 확인', after: '카드 안 상세보기 버튼으로 공고 상세 페이지 이동', measuredBy: '버튼 클릭 동작 확인' },
      ],
      tradeOffs: [
        '목록형보다 여러 공고를 한 번에 비교하기 어렵습니다. 대신 한 공고에 집중해 빠르게 넘길 수 있습니다.',
        '스와이프 방향을 모르면 처음에는 학습이 필요해 오른쪽·왼쪽 동작을 안내해야 합니다.',
      ],
    },
  ],

  githubUrl: 'https://github.com/maintaein/ttabong',
};
