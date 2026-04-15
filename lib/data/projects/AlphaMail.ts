import { Project } from '@/types';

export const alphaMail: Project = {
  title: 'AlphaMail',
  subtitle: '미래형 업무 환경을 제안하는 AI 기반 업무 자동화 웹 메일 서비스',
  description: 'AI 기반 업무 자동화 웹 메일 서비스',
  longDescription: 'AlphaMail은 이메일로 들어오는 다양한 업무를 AI가 자동으로 정리하고, 단순 작업까지 대신 수행하는 혁신적인 업무 환경을 지향합니다.',
  image: '/projects/Alphamail.png',
  imageAspect: 'landscape',
  tags: ['React', 'TypeScript', 'React-query', 'Zustand', 'TailwindCSS', 'MaterialUI', 'FSD', 'Atomic'],
  duration: '2025.04 - 2025.05',
  role: '웹 프론트엔드 개발 / 프론트엔드 리더',
  teamSize: '6명',

  implementations: [
    {
      text: '🤖 AI 업무 비서: 메일 내용을 자동으로 분석하여 홈 대시보드에 업무를 정리하고 수행',
      video: '/projects/alphamail/alphaHomeService.mp4'
    },
    {
      text: '📬 스마트 메일 서비스: AI 기반 스레드 요약과 자동 메일 작성 기능',
      video: '/projects/alphamail/mailService.mp4'
    },
    {
      text: '💬 전역 챗봇: 모든 화면에서 동작하는 업무 지원 챗봇',
      video: '/projects/alphamail/chatbotService.mp4'
    },
    {
      text: '📋 문서 작업 자동화: 거래처, 발주서, 견적서 관리 등 문서 업무 자동 처리',
      video: '/projects/alphamail/workService.mp4'
    }
  ],

  responsibilities: [
    '웹 프론트엔드 개발',
    '프론트엔드 리더'
  ],

  techReasons: [
    {
      name: 'React',
      reasons: [
        '높은 사용자 인터랙션과 복잡한 **실시간 상태 관리**를 구현하기 위해 **컴포넌트 기반 선언적 UI**가 유리',
        '**React-query, Zustand, TailwindCSS** 등 다양한 라이브러리와의 호환성이 좋아 개발 속도 향상'
      ]
    },
    {
      name: 'TypeScript',
      reasons: [
        '백엔드에서 받아오는 메일 데이터, AI 응답, ERP 데이터 등 **API 응답 구조의 타입 안전성** 확보로 `undefined` 에러 방지',
        '도메인별로 분리된 **store의 타입 일관성** 보장으로 상호작용 향상'
      ]
    },
    {
      name: 'TailwindCSS',
      reasons: [
        '**유틸리티 클래스**로 일관된 디자인 시스템 구축에 편리하고 빠른 프로토타이핑 가능',
        '읽음/안읽음 메일, 활성/비활성 메뉴 등 **동적 스타일 변경**을 조건부 클래스로 직관적 구현'
      ]
    },
    {
      name: 'React Query',
      reasons: [
        '업무 자동화 특성상 백그라운드 데이터 흐름이 많아 **서버 상태 관리 자동화** 필요',
        '**지능형 캐싱**과 `invalidateQueries`로 코드 복잡도 낮추면서 최적화된 성능 구현'
      ]
    },
    {
      name: 'Zustand',
      reasons: [
        '**TypeScript 호환성**이 뛰어나 별도 타입 정의 없이 자동 완성과 타입 체크 완벽 동작',
        'Redux보다 가볍고 **보일러플레이트 코드가 거의 없어** 코드 최적화 가능'
      ]
    },
    {
      name: 'Material UI',
      reasons: [
        '기본 컴포넌트에 **접근성, 키보드 네비게이션, 반응형 디자인** 모두 갖춤',
        '**완벽한 타입 정의**로 컴포넌트 props 자동 완성 지원'
      ]
    },
    {
      name: 'Light FSD + Light Atomic',
      reasons: [
        '**수평적 분리(FSD) + 수직적 분리(Atomic)**으로 복잡한 비즈니스 로직을 관리 가능한 구조로 구축',
        '**Feature별 폴더 분리**로 팀원 독립적 개발 가능, 컴포넌트 재사용성 극대화'
      ]
    }
  ],

  reviews: [
    {
      id: 'dashboard',
      title: '1. 홈 대시보드',
      image: '/projects/alphamail/alphaHome.png',
      features: [
        'AI 업무 비서가 메일 내용 **자동 분석** 및 태그로 분류',
        '첨부파일(사업자등록증 등) **OCR 처리**',
        '업무별 **자동 등록 및 처리**',
        'AlphaMail 기능(일정, 안 읽은 메일, Work) **통합 관리**'
      ],
      intent: '홈 화면에서 가장 신경 쓴 부분은 **"사용자가 로그인 후 오늘 할 일을 바로 할 수 있게 하자"**입니다. 사이드 네비게이션의 각 메뉴는 세부적인 업무가 필요할 때만 들어가서 확인하고, AI 업무 비서가 제시해주는 업무들을 대시보드 화면에서 수행하면 됩니다. AI가 필터링한 업무들을 한 화면에서 처리하는 경험으로, 번거로운 네비게이션을 최소화하고 실제 업무에 집중할 수 있는 환경을 만들고자 했습니다.',
      troubleShooting: {
        title: '홈 대시보드 실시간 업데이트 지연 및 과도한 폴링 문제',
        initialImpl: 'AI 업무 비서와 안 읽은 메일 위젯은 사용자가 홈 대시보드에 접속했을 때 실시간으로 업데이트되어야 합니다. 초기에는 **React Query**의 `refetchInterval`(20초)과 별도로 `useEffect` 내에 `setInterval`(10초)을 추가로 선언하여 **두 타이머가 동시에 동작**하도록 구현했습니다.',
        problem: [
          '사용자가 새 메일을 받아도 대시보드에 **즉시 반영되지 않음**',
          '업무 비서 항목을 처리(등록/삭제)해도 목록이 바로 갱신되지 않음',
          '반응 속도가 사용자 수에 따라 지연됨',
          '`refetchInterval`(20초)과 `setInterval`(10초)이 **중복 등록**되어 실제 폴링 간격이 의도보다 짧아짐'
        ],
        analysis: [
          '**React Query**의 `refetchInterval`이 이미 주기적 갱신을 담당하고 있음에도, `useEffect` 내 `setInterval`이 추가로 `refetch()`를 호출하고 있었음. __결과적으로 최소 10초 간격으로 중복 요청이 발생하는 구조__였음',
          '각 API 요청이 데이터베이스를 직접 조회하는 방식이었기 때문에, **동시 접속자가 늘어날수록 DB 커넥션 점유가 누적**되어 응답 지연으로 이어지는 구조적 문제가 있었음. 실제로 팀 내 테스트 중 동시 접속 시 응답 시간이 눈에 띄게 증가하는 현상을 확인하였음',
          '`invalidateQueries` 미적용 상태에서는 업무 처리(삭제, 등록) 후에도 캐시된 데이터가 반환되어 UI 갱신이 되지 않았음. __"즉시 반영"은 폴링 주기를 줄이는 것이 아니라, 사용자 액션 시점에 캐시를 무효화하는 것으로 해결해야 한다는 것을 인식하게 됨__'
        ],
        solution: '`setInterval`을 제거하고 **React Query**의 `refetchInterval` **단일 전략**으로 통합했습니다. 사용자 액션(등록/삭제) 이후에는 `invalidateQueries`로 캐시를 즉시 무효화하여 UI가 반응하도록 **"즉시 반영"과 "주기적 갱신"의 역할을 분리**했습니다.',
        solutionCode: `// useHome.ts — 단일 refetchInterval 전략
const useAssistants = (params: AssistantsParams = {}) => {
  return useQuery({
    queryKey: [...homeQueryKeys.assistants, user?.id, params],
    queryFn: () => homeService.getAssistants(params),
    staleTime: 0,         // 캐시를 즉시 만료로 설정 → 마운트·포커스 시 항상 서버 조회
    refetchInterval: 20000, // 20초 주기 자동 갱신 (단일 타이머)
  });
};

// 뮤테이션 성공 시 캐시 즉시 무효화 → 폴링 주기와 무관하게 즉각 반영
const useDeleteAssistant = () => {
  return useMutation({
    mutationFn: ({ id, type }) => homeService.deleteAssistant(id, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homeQueryKeys.assistants });
    }
  });
};

const useRegisterSchedule = () => {
  return useMutation({
    mutationFn: (scheduleData) => homeService.registerSchedule(scheduleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homeQueryKeys.assistants });
    }
  });
};

// homeAiTemplate.tsx — setInterval 제거, visibilitychange만 유지
useEffect(() => {
  const handleFocus = () => refetch();
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') refetch();
  };
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [refetch, user?.id]);`,
        results: [
          '**중복 폴링 제거**: `setInterval` + `refetchInterval` 혼재에서 `refetchInterval` **단일 전략**으로 통합, 불필요한 서버 요청 감소',
          '**즉각 반영**: 업무 처리(등록/삭제) 직후 `invalidateQueries`로 캐시 무효화 → 다음 폴링을 기다리지 않고 즉시 목록 갱신',
          '**탭 포커스 복귀 시 갱신**: `visibilitychange` + `window focus` 이벤트로 사용자가 다른 탭에서 돌아올 때도 최신 데이터 표시'
        ],
        lessons: [
          '**React Query**의 `refetchInterval`이 있을 때 `setInterval`로 `refetch()`를 또 호출하면 타이머가 이중으로 동작한다. __라이브러리가 제공하는 기능을 신뢰하고, 같은 역할을 하는 코드를 중복 작성하지 않는 것이 중요하다.__',
          '__"즉시 반영"과 "주기적 갱신"은 서로 다른 문제다.__ 주기를 짧게 줄이는 것이 아니라, 사용자 액션 후에는 `invalidateQueries`로 정확한 시점에 캐시를 무효화하고, 백그라운드 갱신은 적절한 `refetchInterval`에 맡기는 **역할 분리**가 핵심이다.',
          'API 요청은 그 자체로 비용이다. **백엔드 DB 조회 구조를 이해하지 않으면 프론트엔드 최적화에도 한계가 있다.** 폴링 전략을 결정할 때는 요청 빈도와 서버 부하의 **trade-off**를 함께 고려해야 한다.'
        ]
      }
    },
    {
      id: 'mail',
      title: '2. 메일',
      image: '/projects/alphamail/mail.png',
      features: [
        '**스레드 기반** 메일 이력 관리',
        '**AI 기반** 메일 요약',
        '**템플릿 기반** 자동 답장 생성',
        '**벡터 DB 기반** 빠른 검색',
      ],
      intent: '메일 화면은 사람들이 보편적으로 메일 서비스에서 기대하는 부분들을 구현하고자 했습니다. 회신을 하면 이전 메일 내용이 첨부되겠구나, 안 읽은 메일을 읽으면 볼드 처리가 풀리겠구나 하는 것들입니다. 최대한 **가독성과 직관성**에 초점을 두었습니다. AlphaMail이 제공하는 AI 기능을 어떻게 인터페이스를 설계해서 사용자에게 보여줄 지 고민이 많았습니다. 메일을 읽는 메인 흐름을 방해하지 않으면서도 항상 접근 가능한 위치에 인터페이스를 배치하기 위해 **사이드 패널 모달**로 구현했습니다. 이를 통해 기존 메일 서비스의 기본기에 AI 가치를 덧붙인 차별화된 경험을 제공하고자 했습니다.',
      troubleShooting: {
        title: '컴포넌트 리렌더링으로 인한 입력 지연 및 포커스 해제 현상',
        initialImpl: '메일 작성 폼은 받는 사람, 제목, 본문, 첨부파일 등 여러 개의 입력 필드를 포함한 복잡한 구조였습니다. 초기에는 폼 전체 상태(`recipients`, `subject`, `content`, `attachments` 등)를 **부모 컴포넌트(`MailWriteTemplate`)의 개별 `useState`로 관리**하고 props로 전달하는 방식을 사용했습니다.',
        problem: [
          '각 입력 폼에 뭔가 입력할 때마다 **입력 지연이 발생**',
          '텍스트나 숫자를 입력할 때 **한 글자씩 끊김**',
          '첨부파일을 추가할 때 현재 입력 중이던 **다른 필드의 포커스가 해제**됨'
        ],
        analysis: [
          '**React DevTools Profiler**로 분석한 결과, `subject` 입력 한 글자에도 `MailWriteTemplate` 전체와 자식 컴포넌트들(`MailWriteForm`, `MailQuillEditor`, `MailAttachmentInput`)이 모두 리렌더링됨을 확인. __입력 한 번당 렌더링이 4~5회 연쇄 발생하는 구조__였음',
          '**React**의 `useState`는 상태가 선언된 컴포넌트와 그 하위 트리 전체를 리렌더링 대상으로 만든다. `subject`가 바뀌면 `MailWriteTemplate`이 리렌더링되고, 이때 `MailAttachmentInput`도 새 props 참조를 받아 리렌더링됨. 이 과정에서 `input` 엘리먼트가 reconciliation을 거치며 **포커스 상태가 초기화**되는 케이스가 발생했음',
          '`memo()`나 `useCallback`으로 props 안정화를 시도했으나, __부모의 상태 변경이 children에 전달되는 구조 자체가 리렌더링을 유발하므로 근본 해결이 되지 않았음__'
        ],
        solution: '**Zustand를 전역 상태 관리뿐만 아니라 로컬 폼 상태 관리에도 적용**했습니다. Zustand는 React 컴포넌트 트리 외부(외부 스토어)에 상태를 보관하므로, **특정 필드가 변경되어도 그 필드를 구독하는 컴포넌트만 리렌더링**됩니다. `subject`가 바뀌어도 `MailAttachmentInput`은 `attachments`만 구독하고 있기 때문에 리렌더링 대상이 아닙니다.',
        solutionCode: `// useMailStore.ts — 폼 상태를 Zustand 외부 스토어로 분리
export const useMailStore = create<MailState>((set) => ({
  recipients: [],
  subject: '',
  content: '',
  threadId: null,
  inReplyTo: null,
  references: [],
  attachments: [],

  setRecipients: (recipients) => set({ recipients }),
  setSubject: (subject) => set({ subject }),
  setContent: (content) => set({ content }),
  setThreadId: (threadId) => set({ threadId }),
  setInReplyTo: (inReplyTo) => set({ inReplyTo }),
  setReferences: (references) => set({ references }),

  addAttachment: (file) => set((state) => ({
    attachments: [...state.attachments, {
      id: \`\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`,
      file, name: file.name, size: file.size, type: file.type
    }]
  })),
  removeAttachment: (id) => set((state) => ({
    attachments: state.attachments.filter(a => a.id !== id)
  })),
  resetComposeState: () => set({
    recipients: [], subject: '', content: '',
    threadId: null, inReplyTo: null, references: [], attachments: []
  }),
}));

// 각 컴포넌트는 자신이 필요한 필드만 selector로 구독
// → subject가 변경되어도 MailAttachmentInput은 리렌더링되지 않음

// MailSubjectInput.tsx
const { subject, setSubject } = useMailStore((state) => ({
  subject: state.subject,
  setSubject: state.setSubject,
}));

// MailAttachmentInput.tsx — subject 변경과 완전히 독립
const { attachments, addAttachment, removeAttachment } = useMailStore((state) => ({
  attachments: state.attachments,
  addAttachment: state.addAttachment,
  removeAttachment: state.removeAttachment,
}));`,
        results: [
          '**리렌더링 격리**: 특정 필드 입력이 다른 필드 컴포넌트의 리렌더링을 유발하지 않음',
          '**입력 지연 제거**: 한 글자 입력 시 연쇄 리렌더링이 사라지고 입력 끊김 현상이 해소됨',
          '**포커스 유지**: 첨부파일 추가 시 다른 입력 필드의 포커스가 유지됨',
          '**유지보수성 강화**: 상태 변경의 영향 범위가 컴포넌트 단위로 명확해져 기능 추가 시 사이드 이펙트 예측이 용이해짐'
        ],
        lessons: [
          '**React**의 `useState`는 선언된 컴포넌트와 그 하위 트리 전체를 리렌더링 대상으로 만든다. 하나의 폼에 여러 독립적인 입력 필드가 있다면, 하나의 상태 변경이 모든 필드를 리렌더링시키는 구조가 된다. __이때 상태를 외부 스토어(Zustand)로 분리하면, React 트리 밖에서 상태를 관리하므로 selector로 구독하는 컴포넌트만 정확히 리렌더링된다.__',
          '포커스 해제는 `input` 엘리먼트가 DOM에서 unmount→remount될 때 발생한다. 리렌더링이 일어나더라도 같은 DOM 노드를 유지하면 포커스가 유지되지만, 컴포넌트가 새로 생성되면 DOM 노드도 교체된다. __리렌더링 범위를 줄이는 것이 곧 포커스 문제의 예방책이다.__',
          '__Zustand가 전역 상태 관리에만 유용하다고 생각했던 것이 실수였다.__ 외부 스토어라는 특성 자체가 React 리렌더링 범위를 제어하는 수단이 되므로, 로컬 폼 상태에도 동일하게 적용할 수 있다.'
        ]
      }

    },
    {
      id: 'work',
      title:'3. 문서 관리',
      image: '/projects/alphamail/work.png',
      features: [
        '견적서 **자동 생성** 및 문서화',
        '발주서 처리',
        '거래처 관리',
        '**원클릭** pdf 문서 출력',
      ],
      intent: '문서 작업 화면은 레퍼런스를 찾아보는 데에 가장 많은 시간을 들였던 것 같습니다. 회사원들이 그룹웨어를 이용하며 필요할 만한 기능과, 기능이 위치하길 기대하는 UI를 충실히 구현하는 데 초점을 맞췄습니다. 이를 통해 **서비스에 대한 학습 없이도 직관적으로 사용**할 수 있도록 설계했습니다.',
    },
    {
      id: 'chatbot',
      title:'4. 챗봇',
      image: '/projects/alphamail/chatbot.png',
      features: [
        '**실시간** 업무 지원',
        '일정 등록/조회',
        '발주서/견적서 검색',
        '**전역 접근성**'
      ],
      intent: '**"AI가 서비스 전체를 관리하고 있다!"** 라는 느낌을 사용자가 받길 원했습니다. 본래 챗봇을 제외한 위 4가지 기능이 1차 MVP 였습니다. 개발 이후 사용자 테스트를 진행해본 결과, 가장 많이 들은 피드백은 "AI 서비스인데 AI가 뭔가 하고 있다는 느낌을 받기 어렵다", "AI에게 일을 직접 시킬 수 있어야 비서인 것 같다" 라는 피드백이었습니다. 챗봇은 이러한 **사용자 피드백을 반영**하여 개발했습니다. AlphaMail 전 화면에 걸쳐 존재하며, 업무 도중 모르는 것이 있다면 챗봇이 안내해주는 가이드를 통해 질문이 가능합니다. 또한 원하는 일정을 등록하고, 오늘 들어온 견적 요청이 몇 건인지 알아보는 등 상세하고 세부적인 업무를 수행할 수 있습니다.',
    }
  ],

  githubUrl: 'https://github.com/mail-coding/AlphaMail',
  // demoUrl: 'https://alphamail.vercel.app'
};
