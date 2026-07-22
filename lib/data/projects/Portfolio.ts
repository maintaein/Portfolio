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
        '서버에서 미리 그려도 화면 깜빡임이 없는 모달을 직접 구현했습니다. 모달이 열리면 본문 스크롤이 잠기고, ESC 키나 바깥 영역 클릭으로 닫을 수 있습니다.',
        '자주 쓰이는 기능을 별도 모듈로 분리해 어느 화면에서든 같은 방식으로 가져다 쓸 수 있게 만들었습니다. 모달 열고 닫기, 현재 보이는 섹션 감지, 스크롤로 들어오는 요소 감지 세 가지를 다룹니다.',
        '컴포넌트를 작은 단위(Atoms)부터 큰 단위(Sections)까지 단계별로 쌓는 구조를 적용해, 작은 부품을 바꾸면 어디까지 영향을 주는지 한눈에 파악할 수 있도록 했습니다.',
        '색상·글자 크기·간격 같은 디자인 값을 한 곳에 모아두고, 그 값을 바꾸면 사이트 전체에 즉시 반영되도록 구성했습니다.',
      ],
    },
  ],

  techReasons: [
    {
      name: 'Next.js 15',
      reasons: [
        '포트폴리오 특성 상 검색창에 잘 노출되길 바랬는데, SEO를 잘 챙길 수 있는 Next.js가 딱 맞겠다 싶었습니다.',
        '이미지 최적화와 폰트 미리 불러오기 같은 성능 작업이 라이브러리에 이미 들어 있어, 별도 설정 없이도 가벼운 사이트를 만들 수 있었습니다.',
      ],
    },
    {
      name: 'TypeScript',
      reasons: [
        '타입을 한 곳에 모아두니, 데이터 구조를 바꿨을 때 영향을 받는 모든 화면을 편집기가 즉시 빨간 줄로 알려줘 누락 없이 수정할 수 있었습니다.',
      ],
    },
    {
      name: 'Tailwind CSS 4',
      reasons: [
        '포트폴리오처럼 화면 수는 많지 않지만 섹션마다 배치와 상태가 다른 프로젝트에서는, 스타일 파일을 오가며 class 이름을 관리하는 것보다 컴포넌트 안에서 레이아웃과 상태 스타일을 함께 확인하는 방식이 더 효율적이라고 판단했습니다.',
        'Tailwind v4의 @theme와 CSS 변수 기반 토큰을 사용해 색상·타이포그래피·애니메이션 값을 한 곳에 모았습니다. 덕분에 버튼, 카드, 섹션 배경처럼 반복되는 시각 규칙을 같은 토큰으로 맞출 수 있었습니다.',
        'CSS Modules나 vanilla-extract도 선택지가 될 수 있었지만, 이 프로젝트에서는 별도 스타일 파일과 타입 정의를 늘리는 것보다 빠르게 UI를 조정하고 반응형 상태를 확인하는 쪽이 더 중요해 Tailwind를 선택했습니다.',
      ],
    },
    {
      name: 'Framer Motion',
      reasons: [
        '프로젝트 카드가 확장되고 모달이 등장하는 과정에서 단순한 show/hide보다 부드러운 전환이 필요했습니다. CSS transition만으로도 일부 효과는 만들 수 있지만, 진입·퇴장 상태를 React 렌더링 흐름과 함께 관리해야 해서 코드가 빠르게 복잡해졌습니다.',
        'Framer Motion의 motion 컴포넌트와 AnimatePresence를 사용하면 카드 확장, 모달 등장·퇴장, 섹션 전환 애니메이션을 같은 방식으로 작성할 수 있어 인터랙션 구현 방식을 통일할 수 있었습니다.',
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
      learned: '성능 점수 하나만 높이는 것보다 LCP 후보, 네트워크 전송량, 메인 스레드 지표를 함께 봐야 실제 병목과 측정상의 병목을 구분할 수 있었습니다.',
    },
    {
      label: 'LCP 반복 측정 중앙값',
      before: '5.5초',
      after: '1.3초',
      delta: '-76%',
      measuredBy: 'Lighthouse Desktop 동일 환경 반복 측정 중앙값',
      learned: '애니메이션을 없애는 대신 브라우저가 의미 있는 콘텐츠를 인식하는 시점과 초기 자원 우선순위를 분리해 개선했습니다.',
    },
    {
      label: 'Hydration 경고',
      before: '프로젝트 모달 렌더링 경로에서 발생',
      after: '0건',
      measuredBy: 'Next.js 개발 모드 콘솔 (React 19 Strict Mode)에서 새로고침·모달 열기 반복 확인',
      learned: '브라우저 전용 API는 Client Component라는 선언만으로 안전해지는 것이 아니라, 서버와 브라우저의 첫 렌더 결과까지 같도록 실행 시점을 분리해야 했습니다.',
    },
  ],

  reviews: [
    {
      id: 'performance',
      title: '1. Lighthouse Desktop 80→99점, LCP 중앙값 5.5→1.3초',
      image: '/projects/Portfolio/performance.webp',
      problem: '동일한 Desktop 환경에서 Lighthouse를 반복 측정한 결과 **성능 점수는 80점, LCP 중앙값은 5.5초**였습니다. Hero 부팅 애니메이션은 포트폴리오의 첫인상을 만드는 핵심 연출이지만, 연출이 끝날 때까지 브라우저가 주요 콘텐츠를 늦게 인식하고 초기 자원까지 경쟁하면 사용자는 의도한 경험보다 기다림을 먼저 느끼게 됩니다. 따라서 애니메이션을 유지하면서도 측정 대상과 실제 초기 다운로드 병목을 함께 분리해야 했습니다.',
      analysis: [
        '**진단 — 한 가지 느린 작업이 아니라 세 병목의 결합**: Performance trace와 Network 요청을 대조하니 Hero 제목이 초기 `opacity: 0` 상태라 LCP 후보에서 빠졌고, 터미널 타이핑이 끝난 뒤의 텍스트가 뒤늦게 후보가 되고 있었습니다. 동시에 Pretendard 5개 weight를 모두 preload해 약 1.3MB가 초기 요청에서 다운로드됐고, 대표 이미지 6장은 PNG 원본 합계 약 5.21MB였습니다. 즉 LCP 후보가 늦게 정해지는 측정 구조와 실제 전송량 문제가 함께 있었습니다.',
        '**선택지 1 — Hero 부팅 애니메이션 단축 또는 제거**: 재생 시간을 줄이면 `opacity: 0` 구간도 함께 짧아져 LCP 시점이 조금 앞당겨지지만, 시간만 줄여서는 처음엔 보이지 않는 요소라는 판정 자체는 그대로 남아 근본 원인이 해결되지 않습니다. 확실히 해결하려면 애니메이션 자체를 없애야 하는데, 그러면 IDE 부팅이라는 포트폴리오의 정체성과 첫 화면의 서사 자체가 사라지는 비용이 컸습니다.',
        '**선택지 2 — 제목은 처음부터 완전히 그리고, 불투명한 오버레이로 시각적으로만 가리기**: 실제 제목 텍스트를 처음부터 `opacity: 1`로 유지해 브라우저가 즉시 LCP 후보로 인식하게 하고, 그 위에 터미널 연출을 불투명한 레이어로 얹어 시각적으로만 가리는 방법입니다. 부팅이 끝나면 이 레이어를 걷어내면 안에 있던 진짜 제목이 드러나는 구조라 제목 DOM 노드가 하나만 있어도 됩니다. 다만 오버레이가 텍스트를 픽셀 단위로 완전히 가려야 하고, 타이핑 후 제목이 서서히 나타나는 지금의 연출을 가림막을 걷어내는 연출로 바꿔야 해서 기존 시퀀스의 결을 그대로 유지하기는 어렵습니다.',
        '**선택지 3 — 측정 경로와 시각 연출을 분리하고 초기 자원 우선순위를 축소 (선택)**: 의미 있는 제목은 초기 HTML에서 브라우저가 인식하게 하고, 사용자가 보는 제목 애니메이션은 기존 시퀀스에 남기는 방향입니다. 오버레이로 가리는 방식(선택지 2)보다 구현이 단순하고 기존 타이핑→페이드인 시퀀스를 그대로 유지할 수 있습니다. 여기에 첫 화면에 필요한 폰트만 우선 요청하고 이미지 원본 자체를 줄이면 연출을 보존하면서 측정상의 지연과 실제 다운로드 병목을 동시에 다룰 수 있다고 판단했습니다.',
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
        '부팅 연출을 그대로 유지하면서 LCP 대상을 빠르게 확정하는 대신, 초기 HTML의 제목과 화면에 나중에 나타나는 제목을 따로 관리하게 됐습니다. 따라서 LCP 개선 전체를 체감 속도 개선으로 해석하지 않고 다른 화면 표시 지표도 함께 확인했습니다.',
        '미리 받는 폰트를 5종에서 2종으로 줄여 첫 화면 다운로드는 가벼워졌지만, 나머지 굵기는 처음 사용될 때 받아야 합니다. 해당 폰트가 늦게 도착하면 잠시 기본 글꼴로 보일 수 있습니다.',
        '첫 화면 아래 섹션을 나중에 불러와 초기 JavaScript는 줄었지만, 사용자가 곧바로 아래로 스크롤하면 섹션 코드가 도착할 때까지 기다릴 수 있습니다. 최소 높이를 유지해 로딩 중 화면이 밀리는 현상을 줄였습니다.',
      ],
    },
    {
      id: 'ssr-modal',
      title: '2. Hydration 경고 0건을 만든 SSR-safe 모달',
      image: '/projects/Portfolio/ssr-modal.webp',
      problem: '프로젝트 상세 모달에서 `createPortal`, `document.body`, `window`, 카드의 `DOMRect`를 렌더링 경로에 사용하면서 **서버가 만든 결과와 브라우저의 첫 렌더가 달라지는 Hydration 경고가 실제로 발생**했습니다. 프로젝트 상세 보기는 방문자가 구현 과정과 성과를 확인하는 핵심 경로이므로, 경고를 숨기는 것이 아니라 서버와 브라우저가 같은 첫 결과를 만들면서 카드 위치에서 확장되는 인터랙션도 유지해야 했습니다.',
      analysis: [
        '**진단 — Client Component 여부가 아니라 첫 렌더 시점의 문제**: 모달 파일이 Client Component여도 초기 렌더 결과는 서버에서 만들어질 수 있습니다. 이때 존재하지 않는 `document.body`와 viewport 좌표를 사용하면 서버는 같은 결과를 만들 수 없고, 브라우저 전용 계산이 첫 렌더에 섞인 것이 경고의 원인이었습니다.',
        '**선택지 1 — 접근성 모달 라이브러리와 커스텀 애니메이션 조합**: focus trap과 포커스 복귀를 기본으로 얻을 수 있지만, 라이브러리의 Portal·Transition 생명주기와 카드 `DOMRect`를 기반으로 크기·위치 값을 부드럽게 변화시키는 계산을 다시 연결해야 해 제어 계층이 늘어납니다.',
        '**선택지 2 — 모달 전체를 `dynamic(..., { ssr: false })`로 분리**: 서버가 모달 모듈을 렌더하지 않으므로 경계는 명확하지만, 모달의 로딩 시점이 별도 청크 상태에 의존하고 첫 클릭 반응을 위한 loading 처리가 추가됩니다.',
        '**선택지 3 — 서버·브라우저의 첫 렌더를 null로 맞춘 뒤 Portal 활성화 (선택)**: 상세 모달은 사용자 클릭 전에는 필요하지 않으므로 초기 HTML에서 제외해도 콘텐츠 손실이 없습니다. 마운트 이후에만 브라우저 좌표 계산을 허용하면 카드 원점 애니메이션을 직접 제어하면서 첫 렌더 일치도 보장할 수 있어 이 경계를 선택했습니다.',
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
        '초기 HTML에는 모달 DOM이 없으므로 JavaScript가 실행되기 전에는 상세 모달을 열 수 없습니다. 다만 모달은 카드 클릭 이후에만 필요한 보조 콘텐츠이므로 정적 첫 화면과 카드 탐색을 우선했습니다.',
        '직접 구현을 선택하면서 접근성 책임도 직접 맡게 됐습니다. 현재는 dialog 의미·ESC·백드롭·scroll lock까지 제공하도록 구현했습니다.',
        'viewport와 카드 DOMRect에 의존하므로 창 크기가 바뀐 뒤에는 열기 시점의 좌표를 다시 읽어야 합니다. 현재는 클릭 직전에 originRect를 캡처해 오래된 좌표 사용을 피했습니다.',
      ],
    },
    {
      id: 'hero-canvas-performance',
      image: '/projects/Portfolio/hero-canvas-performance.webp',
      title: '3. Hero 부팅 애니메이션 아키텍처 리팩터링 — 끊김 제거와 렌더링 책임 분리',
      problem: 'Hero 부팅 애니메이션의 진행 상태를 12단계로 뚝뚝 끊어서 반영하다 보니 **눈에 보이는 움직임이 부자연스럽게 끊겨 보였**습니다. 그렇다고 이 단계를 없애려고 매 프레임마다 React state를 갱신하면, 값 하나가 바뀔 때마다 첫 화면의 렌더 트리 전체가 함께 다시 계산될 위험이 있습니다. 포트폴리오의 시작을 알리는 핵심 연출이므로, 시퀀스는 그대로 유지하면서 움직임은 끊김 없이 이어지게 하고 렌더링 책임은 필요한 범위로만 좁히는 아키텍처 정리가 필요했습니다.',
      analysis: [
        '**진단 — 12단계로 끊어지는 충전 효과와, 전환마다 리셋되는 애니메이션 타이밍이 끊김을 만든 구조**: 기존 glow 효과는 `Math.floor(t * 12) / 12` 계산으로 충전량을 12단계로 딱딱 끊어서 표현했고, 활동 변화를 별도의 동작처럼 처리해 화면이 전환될 때마다 애니메이션 타이밍이 처음으로 되돌아갔습니다. 정적인 box-shadow만으로는 한 지점에서 순간적으로 솟아오르는 빛과, 천천히 부풀었다 줄어드는 움직임·빠르게 떨리는 움직임을 함께 표현하기도 어려웠습니다.',
        '**선택지 1 — CSS box-shadow와 keyframes만 사용**: DOM을 추가하지 않아도 되고 브라우저의 기본 최적화를 그대로 활용할 수 있지만, 둥근 테두리의 각 지점이 서로 다른 크기로 출렁이는 모양이나, 화면이 전환돼도 애니메이션이 끊기지 않고 자연스럽게 이어지는 것까지 세밀하게 제어하기는 어렵습니다.',
        '**선택지 2 — 다수의 DOM 입자·에너지 레이어 배치**: 빛 하나하나의 위치와 속도를 직접 조절하기는 쉽지만, 첫 화면에 많은 DOM 요소를 추가하고 각 요소의 style·transform을 하나하나 관리해야 해서, 화면이 화려해질수록 관리해야 할 DOM 구조도 함께 복잡해집니다.',
        '**선택지 3 — 하나의 Canvas에서 여러 움직임을 겹쳐 그리고, 자주 바뀌는 값은 React state 밖에서 관리 (선택)**: Canvas를 쓰면 테두리를 따라 찍은 여러 지점마다 천천히 부풀었다 줄어드는 움직임과 빠르게 떨리는 움직임을 겹쳐서 그릴 수 있고, 흐른 시간을 하나의 값에 계속 쌓아 두면 BUILD COMPLETE에서 RUN으로 넘어갈 때도 애니메이션이 처음부터 다시 시작되지 않고 그대로 이어집니다. 충전량과 활동량은 화면 구조 자체를 바꾸지는 않는, 눈에만 보이는 값이므로 React state가 아닌 ref로 따로 관리하는 것이 "화면 구조는 state가, 시각 효과는 ref가 맡는다"는 렌더링 책임 분리 원칙에도 맞다고 판단했습니다.',
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
        'Canvas는 CSS보다 움직임의 모양을 자유롭게 만들 수 있는 대신, 여러 지점의 색상 그라데이션을 매 프레임 다시 계산해야 해서 메인 스레드에 부담이 생깁니다. 화면 해상도 배율(DPR)을 1.5배로 제한해 이 부담을 눌러 두었지만, 고해상도 디스플레이에서는 최대 선명도보다 테두리가 살짝 흐릿하게 보일 수 있습니다.',
        'ref와 직접 style 갱신은 React DevTools에서 상태 변화를 추적하기 어렵습니다. 이 방식은 매 프레임 바뀌는 시각 값에만 한정해서 쓰고, BUILD COMPLETE·RUN·완료처럼 의미 있는 진행 상태는 그대로 React state에 남겼습니다.',
      ],
    },
  ],

  githubUrl: 'https://github.com/maintaein/portfolio'
};
