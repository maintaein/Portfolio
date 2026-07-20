import { Project } from '@/types';

export const alphaMail: Project = {
  title: 'AlphaMail',
  subtitle: 'AI 기반 업무 자동화 웹 메일 서비스',
  image: '/projects/Alphamail.webp',
  imageAspect: 'landscape',
  tags: ['React', 'TypeScript', 'React-query', 'Zustand', 'TailwindCSS', 'MaterialUI', 'FSD', 'Atomic'],
  duration: '2025.04 - 2025.05',
  role: '웹 프론트엔드 개발 / 프론트엔드 리더',
  teamSize: '6명',

  motivation: '실무를 하면서 메일로 쌓이는 업무를 파악하고 관리하는 일이 생각보다 번거롭다고 느꼈습니다. 메일에 들어온 내용을 읽고, 해야 할 일을 정리하고, 간단한 반복 작업까지 직접 처리해주는 서비스가 있으면 어떨까라는 생각에서 시작했습니다.',
  keyMetrics: [
    {
      label: '중복 폴링 제거',
      after: '단일 폴링 전략 / 불필요한 요청 제거',
      measuredBy: '코드 검증 — useHome.ts에서 setInterval 제거 및 invalidateQueries 적용 확인',
      learned: '"즉시 반영"과 "주기적 갱신"은 서로 다른 문제입니다. 폴링 주기를 짧게 줄이는 게 아니라, 사용자 액션 직후 캐시를 무효화하는 것이 즉시 반영의 올바른 해법이라는 걸 배웠습니다.',
    },
    {
      label: '폼 리렌더링 격리',
      after: '리렌더 4~5회 → 1회 (selector 격리)',
      measuredBy: 'React DevTools Profiler — 입력 시 리렌더 컴포넌트 수 측정',
      learned: 'Zustand가 전역 상태 관리에만 유용하다고 생각했는데, React 트리 외부에서 상태를 관리한다는 특성 자체가 리렌더 범위를 제어하는 수단이 됩니다. 로컬 폼 상태에도 동일하게 적용할 수 있었습니다.',
    },
    {
      label: '사용자 피드백 반영',
      after: '피드백 기반 전역 챗봇 추가',
      measuredBy: '사용자 테스트 피드백 수집 후 기능 추가 이력',
      learned: '"AI 서비스인데 AI가 뭔가 하고 있다는 느낌이 없다"는 피드백에서, 기능이 존재하는 것과 사용자가 그것을 체감하는 것은 별개라는 걸 배웠습니다. UI 배치가 기능만큼 중요합니다.',
    },
  ],

  implementations: [
    {
      category: 'AI 업무 비서',
      items: ['메일 내용을 자동으로 분석하여 홈 대시보드에 업무를 정리하고 수행'],
      video: '/projects/alphamail/alphaHomeService.mp4',
    },
    {
      category: '스마트 메일 서비스',
      items: ['AI 기반 스레드 요약과 자동 메일 작성 기능'],
      video: '/projects/alphamail/mailService.mp4',
    },
    {
      category: '전역 챗봇',
      items: ['모든 화면에서 동작하는 업무 지원 챗봇'],
      video: '/projects/alphamail/chatbotService.mp4',
    },
    {
      category: '문서 작업 자동화',
      items: ['거래처, 발주서, 견적서 관리 등 문서 업무 자동 처리'],
      video: '/projects/alphamail/workService.mp4',
    },
  ],

  techReasons: [
    {
      name: 'React',
      reasons: [
        '높은 사용자 인터랙션과 복잡한 실시간 상태 관리를 구현하기 위해 컴포넌트 기반 선언적 UI가 유리',
        'React-query, Zustand, TailwindCSS 등 다양한 라이브러리와의 호환성이 좋아 개발 속도 향상'
      ]
    },
    {
      name: 'TypeScript',
      reasons: [
        '백엔드에서 받아오는 메일 데이터, AI 응답, ERP 데이터 등 API 응답 구조의 타입 안전성 확보로 undefined 에러 방지',
        '도메인별로 분리된 store의 타입 일관성 보장으로 팀 간 상호작용 향상'
      ]
    },
    {
      name: 'TailwindCSS',
      reasons: [
        '유틸리티 클래스로 일관된 디자인 시스템 구축에 편리하고 빠른 프로토타이핑 가능',
        '읽음/안읽음 메일, 활성/비활성 메뉴 등 동적 스타일 변경을 조건부 클래스로 직관적 구현'
      ]
    },
    {
      name: 'React Query',
      reasons: [
        '업무 자동화 특성상 백그라운드 데이터 흐름이 많아 서버 상태 관리 자동화 필요',
        '지능형 캐싱과 invalidateQueries로 코드 복잡도 낮추면서 최적화된 성능 구현'
      ]
    },
    {
      name: 'Zustand',
      reasons: [
        'TypeScript 호환성이 뛰어나 별도 타입 정의 없이 자동 완성과 타입 체크 완벽 동작',
        'Redux보다 가볍고 보일러플레이트 코드가 거의 없어 코드 최적화 가능'
      ]
    },
    {
      name: 'Material UI',
      reasons: [
        '기본 컴포넌트에 접근성, 키보드 네비게이션, 반응형 디자인이 모두 갖춰져 있어 업무 도구로 적합',
        '완벽한 타입 정의로 컴포넌트 props 자동 완성 지원'
      ]
    },
    {
      name: 'Light FSD + Light Atomic',
      reasons: [
        '수평적 분리(FSD) + 수직적 분리(Atomic)으로 복잡한 비즈니스 로직을 관리 가능한 구조로 구축',
        'Feature별 폴더 분리로 팀원 독립적 개발 가능, 컴포넌트 재사용성 극대화'
      ]
    }
  ],

  reviews: [
    {
      id: 'dashboard',
      title: '1. 홈 대시보드 — 실시간 업데이트 중복 폴링',
      image: '/projects/alphamail/alphaHome.webp',
      problem: 'AI 업무 비서와 안 읽은 메일 위젯은 새 메일이 와도 대시보드에 즉시 반영되지 않았습니다. 업무를 처리(등록·삭제)해도 목록이 바로 갱신되지 않았고, 사용자 수가 늘어날수록 응답 지연도 심해졌습니다. "AI 비서가 실시간으로 내 업무를 관리해준다"는 핵심 경험이 흔들리는 상황이었습니다.',
      analysis: [
        '**진단 — 두 타이머가 충돌하고 있었다**: React Query의 `refetchInterval`(20초)이 이미 주기적 갱신을 담당하고 있는데, `useEffect` 안에 `setInterval`(10초)을 추가로 선언해 `refetch()`를 또 호출하고 있었습니다. 결과적으로 최소 10초 간격으로 중복 요청이 발생하는 구조였습니다.',
        '**선택지 1 — 폴링 주기를 더 짧게 줄이기**: 10초보다 짧게 줄이면 더 자주 갱신되는 것처럼 보이지만, 요청 빈도가 늘어난 만큼 DB 커넥션 점유도 누적됩니다. 동시 접속자가 늘면 응답 지연이 더 심해지는 구조적 문제는 해결되지 않습니다.',
        '**선택지 2 — 폴링을 완전히 제거하고 WebSocket으로 대체하기**: WebSocket은 서버-클라이언트 간 양방향 연결을 유지하므로 서버가 변경 사항을 즉시 푸시할 수 있습니다. 그러나 이 서비스의 "즉시 반영" 요구는 내가 직접 처리한 업무가 내 화면에 바로 반영되는 것입니다. 이는 타 사용자의 변경을 실시간으로 수신해야 하는 협업 도구와 다르게, 사용자 자신의 액션 직후 결과를 보여주는 요구입니다. 이 요구에 WebSocket의 양방향 연결이 주는 이점은 거의 없고, 서버 측 WebSocket 핸들러와 연결 상태 관리 비용만 추가됩니다.',
        '**선택지 3 — "즉시 반영"과 "주기적 갱신"의 역할 분리 (선택)**: "즉시 반영"과 "주기적 갱신"은 성격이 다른 두 문제입니다. 사용자가 직접 처리한 업무를 즉시 반영하는 것은 폴링 주기와 무관하게 해당 액션이 완료된 시점에 캐시를 무효화하는 방식으로 해결할 수 있습니다. 주기적 갱신은 단일 전략 하나만 남기면 충분합니다. 이 방식은 서버에 추가 인프라 없이 현재 React Query 아키텍처 안에서 해결할 수 있고, 2번처럼 연결 유지 비용도 없습니다. 1번이 해결하지 못한 구조적 중복과 서버 부하 문제를 동시에 해결하면서도, 이 서비스의 실시간성 요구 수준에 정확히 맞는 방식이라 선택했습니다.',
      ],
      action: [
        '`setInterval` 제거 — React Query `refetchInterval`(20초) 단일 전략으로 통합',
        '업무 처리(등록·삭제) 뮤테이션의 `onSuccess`에 `invalidateQueries` 추가 — 사용자 액션 직후 캐시 즉시 무효화',
        '`visibilitychange` + `window focus` 이벤트로 탭 복귀 시 최신 데이터 갱신',
      ],
      result: [
        { label: '중복 폴링 제거', before: '최소 10초마다 setInterval + refetchInterval 이중 요청 발생', after: '단일 refetchInterval(20초)로 통합 — 불필요한 서버 요청이 절반 이하로 감소해 응답 지연 개선', measuredBy: '코드 검증 — useHome.ts에서 setInterval 제거 후 네트워크 탭 요청 빈도 확인' },
        { label: '업무 처리 반영 속도', before: '업무 등록·삭제 후 최대 20초 뒤 화면 갱신', after: '처리 즉시 목록 갱신 — "AI 비서가 실시간으로 관리해준다"는 핵심 경험 충족', measuredBy: '업무 처리 후 invalidateQueries 적용 전후 갱신 시점 비교' },
      ],
      tradeOffs: [
        '`refetchInterval` 20초는 최신 데이터 보장 주기와 서버 부하 사이의 타협값입니다. 사용자가 업무를 처리한 직후는 `invalidateQueries`로 즉시 갱신되지만, 다른 팀원이 같은 업무를 동시에 처리하는 경우 최대 20초까지 반영이 늦어질 수 있습니다.',
        'DB를 직접 조회하는 API 구조에서는 프론트엔드 폴링 최적화만으로 한계가 있습니다. 근본적인 응답 지연 해소를 위해서는 백엔드 캐싱 레이어(Redis 등) 도입이 필요합니다.',
      ],
    },
    {
      id: 'mail',
      title: '2. 메일 작성 폼 — 리렌더링으로 인한 입력 끊김',
      image: '/projects/alphamail/mail.webp',
      problem: '메일 작성 폼에서 뭔가를 입력할 때마다 한 글자씩 끊기는 지연이 발생했습니다. 특히 첨부파일을 추가하면 입력 중이던 다른 필드의 포커스가 해제되는 현상이 반복되었습니다. 사용자가 메일을 작성하다 멈추게 되는 경험은 업무 도구로서 치명적이었습니다.',
      analysis: [
        '**진단 — 한 필드가 바뀌면 폼 전체가 다시 그려졌다**: React DevTools Profiler로 분석하니 `subject` 입력 한 글자에도 부모 컴포넌트 `MailWriteTemplate` 전체와 모든 자식 컴포넌트(`MailWriteForm`, `MailQuillEditor`, `MailAttachmentInput`)가 함께 리렌더링되고 있었습니다. 입력 한 번당 렌더링이 4~5회 연쇄 발생하는 구조였습니다.',
        '**선택지 1 — memo() + useCallback으로 리렌더 최소화하기**: props 참조를 안정화하면 일부 자식의 리렌더를 막을 수 있지만, 부모의 상태 변경이 children에 전달되는 구조 자체가 리렌더링을 유발하므로 근본 해결이 되지 않습니다.',
        '**선택지 2 — React Hook Form으로 비제어 컴포넌트 전환하기**: 입력 상태를 React 트리 밖에서 ref로 관리하기 때문에 리렌더를 줄일 수 있습니다. 단, 이미 구성된 Zustand 기반 아키텍처와 병행하면 상태 관리 전략이 두 갈래로 나뉘어 유지보수가 복잡해집니다.',
        '**선택지 3 — 폼 상태를 Zustand 외부 스토어로 분리하기 (선택)**: Zustand는 React 컴포넌트 트리 외부에서 상태를 관리하므로, 특정 필드가 변경되어도 그 필드를 구독하는 컴포넌트만 리렌더됩니다. `subject`가 바뀌어도 `attachments`만 구독하는 `MailAttachmentInput`은 리렌더 대상이 아닙니다. 이미 전역 상태에 Zustand를 쓰고 있어 아키텍처 일관성도 유지됩니다.',
      ],
      action: [
        '폼 전체 상태(`recipients`, `subject`, `content`, `attachments` 등)를 부모 `useState`에서 `useMailStore`(Zustand)로 이전',
        '각 입력 컴포넌트가 selector로 자신이 필요한 필드만 구독하도록 변경 — `subject`가 바뀌어도 `MailAttachmentInput`은 리렌더 대상 제외',
      ],
      result: [
        { label: '입력 리렌더 횟수', before: '한 글자 입력에 4~5회 연쇄 리렌더 — 타이핑 끊김 및 첨부파일 추가 시 포커스 해제', after: '해당 필드 구독 컴포넌트만 1회 리렌더 — 타이핑이 자연스럽게 이어지고 포커스 유지', measuredBy: 'React DevTools Profiler — 입력 시 리렌더 컴포넌트 수 측정' },
        { label: '아키텍처 일관성', after: '기존 Zustand 전역 상태와 동일한 패턴 — 팀원이 폼 상태도 같은 방식으로 읽고 수정 가능', measuredBy: '코드 검증 — 상태 관리 전략 단일화 확인' },
      ],
      tradeOffs: [
        'Zustand 외부 스토어 기반 폼은 React DevTools에서 상태 변화를 컴포넌트 트리로 추적하기 어렵습니다. 상태가 바뀌어도 React 트리에 반영되지 않아 Profiler로 원인을 파악할 때 별도 Zustand DevTools를 사용해야 합니다.',
        '전역 스토어에 폼 상태를 두면 모달이 닫혀도 상태가 남아있을 수 있습니다. 모달 언마운트 시 `resetComposeState()`를 반드시 호출하는 규칙이 필요하고, 이를 누락하면 다음 메일 작성 시 이전 내용이 잔존합니다.',
      ],
    },
    {
      id: 'work',
      title: '3. 문서 관리',
      image: '/projects/alphamail/work.webp',
      problem: '회사원들이 그룹웨어에서 기대하는 문서 관리 기능(견적서, 발주서, 거래처)을 처음 쓰는 사용자도 학습 없이 바로 사용할 수 있어야 했습니다.',
      analysis: [
        '**방향 — 레퍼런스 기반 설계**: 실제 그룹웨어 제품들의 인터페이스를 분석해 사용자가 각 기능이 어디에 있을지 이미 알고 있는 위치에 배치하는 방향을 선택했습니다.',
        '**원클릭 PDF 출력**: 문서를 수동으로 편집·저장·다운로드하는 단계를 최소화해 업무 흐름을 끊지 않도록 했습니다.',
      ],
      action: [
        '그룹웨어 레퍼런스 분석 기반으로 UI 배치 결정 — 직관적 사용성 우선',
        '원클릭 PDF 출력 기능 구현',
      ],
    },
    {
      id: 'chatbot',
      title: '4. 전역 챗봇',
      image: '/projects/alphamail/chatbot.webp',
      problem: '1차 MVP 사용자 테스트에서 "AI 서비스인데 AI가 뭔가 하고 있다는 느낌을 받기 어렵다", "AI에게 일을 직접 시킬 수 있어야 비서인 것 같다"는 피드백이 반복됐습니다. AI 기능이 존재하지만 사용자가 그것을 체감하지 못하는 상황이었습니다.',
      analysis: [
        '**방향 — 항상 접근 가능한 대화 창구**: AI 비서라는 컨셉을 사용자가 능동적으로 경험하려면, 특정 화면에만 있는 기능이 아니라 서비스 전체에 걸쳐 언제든 꺼낼 수 있는 인터페이스가 필요하다고 판단했습니다.',
        '**범위 — 단순 Q&A를 넘어 실제 업무 수행**: 안내만 해주는 챗봇이 아니라 일정 등록, 견적 조회 등 실제 업무를 처리할 수 있어야 "AI 비서"라는 느낌을 줄 수 있다고 판단했습니다.',
      ],
      action: [
        '챗봇을 전역 레이아웃에 배치 — 모든 화면에서 접근 가능',
        '일정 등록, 발주서·견적서 검색 등 업무 수행 기능 연결',
      ],
    }
  ],

  githubUrl: 'https://github.com/mail-coding/AlphaMail',
};
