import { Project } from '@/types';

export const portfolio: Project = {
  title: 'Portfolio',
  subtitle: 'Next.js 15 + TypeScript 기반 개인 포트폴리오 웹사이트',
  image: '/projects/Portfolio.webp',
  imageAspect: 'landscape',
  tags: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS 4', 'Framer Motion', 'Atomic Design'],
  duration: '2025.08 - 현재',
  role: '웹 프론트엔드 개발',
  teamSize: '1명 (개인 프로젝트)',

  motivation: '포트폴리오를 문서 파일로 관리하다 보니 수정본이 쌓이면서 어떤 게 최신 버전인지 헷갈리기도 했고, 무엇보다 프론트엔드 개발자인데 포트폴리오 정도는 웹으로 보여줘야지 싶었습니다. 마침 SSR이라는 개념에 대해 공부하면서 Next.js에 관심이 생겼는데, 포트폴리오는 모든 방문자에게 같은 화면을 보여주는 사이트라 빌드 시점에 HTML을 미리 만들어두는 SSG 방식이 적합했고, 그 결과물을 무료로 빠르게 배포해주는 Vercel과도 잘 맞아 이 참에 같이 배워보자는 생각으로 시작했습니다.',

  implementations: [
    {
      category: 'Hero 섹션',
      items: ['터미널 부팅 애니메이션과 함께하는 포트폴리오 사이트의 랜딩 페이지'],
    },
    {
      category: 'About 섹션',
      items: ['자기소개·기술 스택·협업 스타일을 애니메이션과 함께 소개'],
    },
    {
      category: 'Projects 섹션',
      items: ['프로젝트 카드 그리드와 상세 모달로 구성'],
    },
    {
      category: 'Skills 섹션',
      items: ['기술 스택을 카테고리별로 그룹화하여 배지 형태로 표시'],
    },
    {
      category: 'Experience 섹션',
      items: ['경력·학력 이력을 타임라인 레이아웃으로 표시'],
    },
    {
      category: '공통 시스템',
      items: [
        'SSR-safe 모달을 직접 구현해 화면 깜빡임 없이 렌더링하고, ESC·바깥 클릭으로 닫을 수 있게 했습니다.',
        '모달 열고 닫기, 현재 섹션 감지, 스크롤 인터섹션 감지를 커스텀 훅으로 분리해 재사용했습니다.',
        'Atoms→Sections 단계로 컴포넌트를 쌓아 변경 영향 범위를 한눈에 파악할 수 있게 구조화했습니다.',
        '색상·타이포·간격 값을 디자인 토큰으로 모아 한 곳만 바꾸면 전체에 반영되게 했습니다.',
      ],
    },
  ],

  techReasons: [
    {
      name: 'Next.js 15',
      reasons: [
        '포트폴리오는 검색 노출이 중요해서, SEO에 강한 Next.js를 선택했습니다.',
        '이미지 최적화·폰트 프리로드가 기본 내장돼 있어 추가 설정 없이 가벼운 사이트를 만들 수 있었습니다.',
      ],
    },
    {
      name: 'TypeScript',
      reasons: [
        '데이터 타입을 한 곳에 모아두면 구조를 바꿨을 때 영향받는 화면을 편집기가 즉시 알려줘 누락 없이 수정할 수 있었습니다.',
      ],
    },
    {
      name: 'Tailwind CSS 4',
      reasons: [
        '레이아웃과 상태 스타일을 컴포넌트 안에서 함께 확인할 수 있어 빠르게 조정할 수 있었습니다.',
        '@theme와 CSS 변수 기반 토큰으로 색상·타이포·애니메이션 값을 한 곳에 모아 반복 규칙을 통일했습니다.',
      ],
      selectionCriteria: '섹션마다 배치와 상태가 자주 바뀌는 프로젝트라 스타일 파일 관리보다 빠른 반응형 확인이 더 중요했습니다.',
      alternatives: [
        { name: 'CSS Modules / vanilla-extract', rejectedBecause: '스타일 파일과 타입 정의가 늘어나 UI를 빠르게 조정하기 어려워짐' },
      ],
    },
    {
      name: 'Framer Motion',
      reasons: [
        '카드 확장, 모달 진입·퇴장에 필요한 전환을 React 렌더링 흐름과 맞춰 관리해야 했습니다.',
        '`motion` 컴포넌트와 `AnimatePresence`로 카드 확장·모달 등장·섹션 전환을 같은 방식으로 작성해 인터랙션 구현을 통일했습니다.',
      ],
      alternatives: [
        { name: 'CSS transition', rejectedBecause: '진입·퇴장 상태를 React 렌더링 흐름과 함께 관리하려면 코드가 빠르게 복잡해짐' },
      ],
    },
  ],

  keyMetrics: [
    {
      label: 'Lighthouse Desktop 성능 점수',
      before: '80점',
      after: '99점',
      delta: '+19점',
      measuredBy: 'Lighthouse Desktop 동일 환경 반복 측정',
      learned: 'LCP 후보·전송량·메인 스레드를 함께 봐야 진짜 병목이 보였습니다.',
    },
    {
      label: 'LCP 반복 측정 중앙값',
      before: '5.5초',
      after: '1.3초',
      delta: '-76%',
      measuredBy: 'Lighthouse Desktop 동일 환경 반복 측정 중앙값',
      learned: '애니메이션은 유지한 채, 콘텐츠 인식 시점과 초기 자원 우선순위만 분리해 개선했습니다.',
    },
    {
      label: 'Hydration 경고',
      before: '프로젝트 모달 렌더링 경로에서 발생',
      after: '0건',
      measuredBy: 'Next.js 개발 모드 콘솔 (React 19 Strict Mode)에서 새로고침·모달 열기 반복 확인',
      learned: 'Client Component 선언만으로는 부족하고, 서버·브라우저의 첫 렌더 결과를 맞추는 실행 시점 분리가 필요했습니다.',
    },
  ],

  reviews: [
    {
      id: 'performance',
      title: '1. Lighthouse Desktop 80→99점, LCP 중앙값 5.5→1.3초',
      image: '/projects/Portfolio/performance.webp',
      problem: 'Lighthouse Desktop 반복 측정 결과 **성능 점수 80점, LCP 5.5초**였습니다. 실제 사이트 입장 시 화면에서도 지연이 발생하여, 첫 인상을 해치는 문제가 있었습니다.',
      analysis: [
        '**진단 — 세 가지 병목의 결합**: Hero 제목이 `opacity: 0`으로 시작해 LCP 후보에서 빠졌고, 폰트 5종 preload(1.3MB)와 이미지 PNG 원본(5.2MB)까지 겹쳐 있었습니다.',
        '**선택지 1 — 부팅 애니메이션 단축/제거**: 구현이 가장 간단하고 코드 변경도 최소화할 수 있지만, 재생 시간만 줄이면 "처음엔 안 보이는 요소"라는 판정 자체는 그대로 남고 아예 없애면 IDE 부팅이라는 정체성 서사가 사라집니다.',
        '**선택지 2 — 제목을 처음부터 그리고 오버레이로 가리기**: 제목을 즉시 LCP 후보로 만들 수 있지만, 오버레이가 픽셀 단위로 완전히 가려야 하고 기존 타이핑 연출 자체를 바꿔야 합니다.',
        '**선택지 3 — 측정 경로와 시각 연출 분리 (선택)**: 브라우저가 인식하는 LCP 후보와 방문자가 보는 화면을 서로 다른 레이어로 분리할 수 있다는 데서 착안했습니다. 선택지 1처럼 근본 원인을 남기지도, 선택지 2처럼 기존 타이핑 연출을 새로 짜지도 않으면서 기존 시퀀스를 그대로 유지할 수 있어 구현 비용 대비 개선 효과가 가장 컸습니다.',
      ],
      action: [
        'Hero의 의미 있는 h1을 초기 HTML에 배치하고, 시각적으로 노출되는 제목은 부팅 완료 시퀀스의 Framer Motion 레이어로 분리',
        'Pretendard Regular·Bold 2종만 preload하고 Medium·SemiBold·ExtraBold는 실제 사용 시점에 요청하도록 font 설정 분리',
        '대표 이미지 6장을 PNG에서 WebP 원본으로 변환하고 모든 프로젝트 데이터 경로를 `.webp`로 교체',
        '서버 진입점과 상호작용이 필요한 HomeClient 경계를 분리하고, 첫 화면 아래 섹션은 동적 import로 분할',
      ],
      result: [
        { label: 'Lighthouse Desktop 성능 점수', before: '80점', after: '99점', delta: '+19점', measuredBy: 'Lighthouse Desktop 동일 환경 반복 측정' },
        { label: 'LCP 반복 측정 중앙값', before: '5.5초', after: '1.3초', delta: '-76%', measuredBy: 'Lighthouse Desktop 동일 환경 반복 측정 중앙값' },
        { label: '최종 측정 상세', after: 'FCP 0.3초 / LCP 0.9초 / TBT 0ms / CLS 0.043 / Speed Index 0.9초', measuredBy: 'Lighthouse Desktop 99점 최종 리포트' },
        { label: '대표 이미지 원본 합계', before: '5,214,565바이트 (PNG 6장)', after: '139,316바이트 (WebP 6장)', delta: '-97.3%', measuredBy: '변환 전 Git 객체와 현재 public/projects 파일 크기 합계' },
        { label: '초기 preload 폰트', before: '약 1.3MB (5종)', after: '약 538KB (2종)', delta: '-59%', measuredBy: 'next/font preload 설정과 폰트 파일 크기 합계' },
      ],
      tradeOffs: [
        '초기 HTML의 제목과 화면에 나타나는 제목을 따로 관리하게 돼, LCP 개선을 체감 속도 개선과 동일시하지 않고 다른 지표도 함께 확인했습니다.',
        '폰트를 5종에서 2종만 preload해 나머지 3종은 처음 사용 시 지연 로딩되므로, 도착이 늦으면 잠깐 기본 글꼴로 보일 수 있습니다.',
        '아래 섹션을 나중에 불러와 초기 JS는 줄었지만, 빠른 스크롤 시 로딩을 기다릴 수 있어 최소 높이로 화면 밀림을 막았습니다.',
      ],
    },
    {
      id: 'ssr-modal',
      title: '2. Hydration 경고 0건을 만든 SSR-safe 모달',
      image: '/projects/Portfolio/ssr-modal.webp',
      problem: '프로젝트 상세 모달이 `document.body`·`window`·카드 `DOMRect`를 렌더링 경로에서 그대로 써서 **서버와 브라우저의 첫 렌더가 다른 Hydration 경고**가 발생했습니다.',
      analysis: [
        '**진단 — Client Component 여부가 아니라 첫 렌더 시점의 문제**: Client Component여도 초기 렌더는 서버에서 만들어지는데, 존재하지 않는 `document.body`와 viewport 좌표를 그 시점에 사용한 것이 원인이었습니다. 이 원인을 카드 위치에서 모달로 확장되는 인터랙션은 유지한 채 해결하고자 했습니다.',
        '**선택지 1 — 접근성 모달 라이브러리 사용**: focus trap은 기본 제공되지만, 라이브러리의 Portal 생명주기와 카드 `DOMRect` 기반 위치 계산을 다시 연결해야 해 제어 계층이 늘어납니다.',
        '**선택지 2 — `dynamic(..., { ssr: false })`로 분리**: 서버가 모달을 렌더하지 않아 경계는 명확하지만, 로딩이 별도 청크에 의존해 첫 클릭 반응을 위한 loading 처리가 추가됩니다.',
        '**선택지 3 — 첫 렌더를 null로 맞춘 뒤 마운트 후 Portal 활성화 (선택)**: 모달은 클릭 전에는 필요 없는 콘텐츠라는 점에서 착안해, 초기 HTML에서 아예 제외하면 서버·브라우저 렌더가 자연히 일치한다는 아이디어를 떠올렸습니다. 선택지 1처럼 라이브러리의 생명주기를 다시 연결할 필요도, 선택지 2처럼 로딩 상태를 따로 관리할 필요도 없이 카드 원점 애니메이션까지 직접 제어할 수 있어 가장 간단한 방법이라고 판단했습니다.',
      ],
      action: [
        '`useEffect`에서 mounted 상태를 활성화하고, 그전에는 null을 반환해 서버와 브라우저의 첫 렌더 결과를 통일',
        '마운트 이후에만 `window` 크기와 `originRect`로 scale·translate 시작값을 계산하고 `document.body`에 Portal 렌더링',
        '열릴 때 기존 body overflow 값을 보관한 뒤 scroll lock을 적용하고, cleanup에서 원래 값으로 복원',
        'ESC·백드롭 닫기와 `role="dialog"`, `aria-modal`, `aria-labelledby`를 연결',
      ],
      result: [
        { label: 'Hydration 경고', before: '서버·브라우저 첫 렌더 불일치 경고 발생', after: '0건', measuredBy: 'Next.js 개발 모드 콘솔 (React 19 Strict Mode)에서 새로고침·모달 열기 반복 확인' },
        { label: '브라우저 전용 계산 시점', before: '초기 렌더 경로', after: '마운트 완료 이후로 격리', measuredBy: 'mounted guard 이후 window·document 접근 코드 경로 확인' },
      ],
      tradeOffs: [
        '초기 HTML에 모달 DOM이 없어 JS 실행 전에는 열 수 없지만, 클릭 이후에만 필요한 보조 콘텐츠라 정적 첫 화면을 우선했습니다.',
        '직접 구현한 만큼 접근성 책임도 직접 맡게 되었습니다. dialog 의미·ESC·백드롭·scroll lock을 모두 구현해야 했습니다',
        'viewport·카드 `DOMRect`에 의존해 카드 위치가 바뀌면 좌표를 다시 읽어야 합니다. 현재는 클릭 직전에 카드 위치를 캡처해 오래된 좌표 사용을 막았습니다.',
      ],
    },
    {
      id: 'hero-canvas-performance',
      image: '/projects/Portfolio/hero-canvas-performance.webp',
      title: '3. Hero 부팅 애니메이션 아키텍처 리팩터링 — 끊김 제거와 렌더링 책임 분리',
      problem: 'Hero 부팅 애니메이션의 **움직임이 부자연스럽게 끊겨 보였**습니다. 포트폴리오 첫인상을 망칠 수 있는 연출이라고 판단했습니다.',
      analysis: [
        '**진단 — 12단계 충전 효과와 전환마다 리셋되는 타이밍**: `Math.floor(t * 12) / 12`로 충전량을 12단계로 끊었고, 화면 전환마다 애니메이션 타이밍이 처음으로 되돌아갔습니다.',
        '**선택지 1 — CSS box-shadow와 keyframes만 사용**: 추가 DOM 없이 브라우저 기본 최적화를 쓸 수 있지만, 지점마다 다른 출렁임과 전환 간 끊김 없는 연결까지 세밀하게 제어하긴 어렵습니다.',
        '**선택지 2 — 다수의 DOM 입자·에너지 레이어 배치**: 빛 하나하나를 직접 조절하긴 쉽지만, 첫 화면에 DOM이 늘어나 화려해질수록 구조가 함께 복잡해집니다.',
        '**선택지 3 — Canvas로 겹쳐 그리고 자주 바뀌는 값은 ref로 관리 (선택)**: CSS만으로는 세밀한 제어가 안 되고(선택지 1) DOM 입자는 구조가 복잡해지는(선택지 2) 두 한계를 동시에 피하고 싶어서, 그리기는 자유롭되 DOM은 늘리지 않는 방법으로 Canvas를 찾았습니다. 화면 구조를 바꾸지 않는 시각 값(충전량·활동량)은 state가 아닌 ref로 관리해 렌더링 책임을 분리하는 편이 두 대안보다 유지보수 부담이 적어 이 방향을 택했습니다.',
      ],
      action: [
        '`EnergyAuraCanvas`에서 가로 42개·세로 30개 지점을 따라 두 겹의 출렁이는 띠(boiling band)와 국소적으로 솟아오르는 빛 덩어리(flare lobe)를 겹쳐서 그림',
        '부팅이 시작된 뒤 지난 시간을 smoothstep 함수로 부드럽게 이어지도록 계산해 `chargeLevelRef` 값을 0에서 0.96까지 끊김 없이 갱신하고, box-shadow와 충전 입자의 투명도를 DOM에 직접 반영',
        '`activityRef`가 가리키는 목표값을 `visualActivity`가 점점 가까워지는 방식으로 따라가게 하고, `animationTime` 하나에 시간을 계속 쌓아 두어 BUILD COMPLETE에서 RUN으로 전환될 때도 애니메이션 타이밍이 끊기지 않고 이어지도록 유지',
        '`requestAnimationFrame`의 delta를 최대 50ms로 제한하고, Canvas의 화면 해상도 배율(DPR) 상한을 1.5로 설정해 처리해야 할 픽셀 양을 제한',
        '완료 시 Canvas를 비활성화하고 cleanup에서 animation frame과 resize listener를 해제',
      ],
      result: [
        { label: '테두리 충전 단계', before: '12단계', after: '경과 시간에 따라 끊김 없이 변화', measuredBy: '기존 `Math.floor(t * 12) / 12`와 현재 smoothstep 갱신 경로 비교' },
        { label: '프레임마다 바뀌는 값의 React 상태 갱신 횟수', after: '0회 — chargeLevelRef·activityRef로 분리 관리', measuredBy: 'requestAnimationFrame 루프 내 state setter 호출 여부 확인' },
        { label: '상태 전환 시 애니메이션 타이밍 재시작 횟수', before: 'BUILD COMPLETE→RUN 전환에서 1회', after: '0회 — 단일 animationTime 유지', measuredBy: '전환 시퀀스 반복 재생과 Canvas 시간 누적 코드 경로 확인' },
        { label: 'Canvas 해상도 상한', after: '기기의 화면 해상도 배율(DPR)과 관계없이 최대 1.5배', measuredBy: 'resize 시 backing store 크기와 DPR 제한값 확인' },
      ],
      tradeOffs: [
        'Canvas는 자유롭지만 매 프레임 색상 계산이 메인 스레드 부담이 되어, 화면 해상도 배율(DPR)을 1.5배로 제한해 관리했습니다 — 고해상도에서는 테두리가 살짝 흐릿하게 보일 수 있습니다.',
        'ref 직접 갱신은 DevTools로 추적하기 어려워, 매 프레임 바뀌는 시각 값에만 한정하고 BUILD COMPLETE·RUN 같은 의미 있는 진행 상태는 React state에 남겨 관리했습니다.',
      ],
    },
  ],

  githubUrl: 'https://github.com/maintaein/portfolio'
};
