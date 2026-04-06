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
        '높은 사용자 인터랙션과 복잡한 실시간 상태 관리를 구현하기 위해 컴포넌트 기반 선언적 UI가 유리',
        'React-query, Zustand, TailwindCSS 등 다양한 라이브러리와의 호환성이 좋아 개발 속도 향상'
      ]
    },
    {
      name: 'TypeScript',
      reasons: [
        '백엔드에서 받아오는 메일 데이터, AI 응답, ERP 데이터 등 API 응답 구조의 타입 안전성 확보로 undefined 에러 방지',
        '도메인별로 분리된 store의 타입 일관성 보장으로 상호작용 향상'
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
        'Redux보다 가볍고 보일러플레이트 코드 거의 없어 코드 최적화 가능'
      ]
    },
    {
      name: 'Material UI',
      reasons: [
        '기본 컴포넌트에 접근성, 키보드 네비게이션, 반응형 디자인 모두 갖춤',
        '완벽한 타입 정의로 컴포넌트 props 자동 완성 지원'
      ]
    },
    {
      name: 'Light FSD + Light Atomic',
      reasons: [
        '수평적 분리(FSD) + 수직적 분리(Atomic)로 복잡한 비즈니스 로직을 관리 가능한 구조로 구축',
        'Feature별 폴더 분리로 팀원 독립적 개발 가능, 컴포넌트 재사용성 극대화'
      ]
    }
  ],

  reviews: [
    {
      id: 'dashboard',
      title: '1. 홈 대시보드',
      image: '/projects/alphamail/alphaHome.png',
      features: [
        'AI 업무 비서가 메일 내용 자동 분석 및 태그로 분류',
        '첨부파일(사업자등록증 등) OCR 처리',
        '업무별 자동 등록 및 처리',
        'AlphaMail 기능(일정, 안 읽은 메일, Work) 통합 관리'
      ],
      intent: '홈 화면에서 가장 신경 쓴 부분은 "사용자가 로그인 후 오늘 할 일을 바로 할 수 있게 하자"입니다. 사이드 네비게이션의 각 메뉴는 세부적인 업무가 필요할 때만 들어가서 확인하고, AI 업무 비서가 제시해주는 업무들을 대시보드 화면에서 수행하면 됩니다. AI가 필터링한 업무들을 한 화면에서 처리하는 경험으로, 번거로운 네비게이션을 최소화하고 실제 업무에 집중할 수 있는 환경을 만들고자 했습니다.',
      troubleShooting: {
        title: '홈 대시보드 실시간 업데이트 지연 현상',
        initialImpl: 'AI 업무 비서는 사용자가 홈 대시보드에 접속했을 때 실시간으로 업데이트되어야 합니다. 초기에는 useEffect와 setInterval로 5초마다 전체 대시보드 데이터를 가져오는 방식을 사용했습니다.',
        problem: [
          '사용자가 새 메일을 받아도 대시보드에 즉시 반영되지 않음',
          '품목 추가 시 입력 중인 필드의 포커스가 해제됨',
          '반응 속도가 사용자 수에 따라 지연됨'
        ],
        analysis: [
          '처음에는 5초마다 가져오는 것이 큰 부담이 아닐 것이라고 생각했으나, 각 API 요청이 데이터베이스를 직접 조회하고 있었음',
          '여러 명이 동시에 데이터를 가져오면 여러 쿼리가 동시 실행되고, 데이터베이스 커넥션이 점유됨',
          '데이터 커넥션 풀이 고갈되기 시작할 때 지연이 발생한다고 판단'
        ],
        solution: 'React Query의 staleTime, refetchInterval, invalidateQueries를 통해 문제를 해결했습니다.',
        solutionCode: `const useAssistants = (params) => {
  return useQuery({
    queryKey: ['assistants', userId, params],
    queryFn: () => homeService.getAssistants(params),
    staleTime: 0,
    refetchInterval: 20000,
  });
};

const useDeleteAssistant = () => {
  return useMutation({
    mutationFn: (id) => homeService.deleteAssistant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['assistants']
      });
    }
  });
};`,
        results: [
          '서버 부하 감소: 5초 → 20초 refetch로 요청량 감소, 데이터베이스 커넥션 풀 부담 감소',
          '사용자 액션 반응 개선: 업데이트 사항이 즉시 대시보드에 반영되도록 개선'
        ],
        lessons: [
          'API 요청은 그 자체로 비용이다. 백엔드가 어떻게 동작하는지 이해하지 않으면 프론트엔드 최적화에도 한계가 있다는 것을 깨달음',
          'React Query의 가치: 캐싱 전략을 통해 서버 부하를 줄일 수 있는 도구. invalidateQueries는 API 요청과 뮤테이션을 효과적으로 결합하는 핵심 기능',
          'refetchInterval이 정말 필요한지 재평가 필요. 사용자 액션 후 즉시 재조회되므로 실제 사용자 패턴 분석이 중요'
        ]
      }
    },
    {
      id: 'mail',
      title: '2. 메일',
      image: '/projects/alphamail/mail.png',
      features: [
        '스레드 기반 메일 이력 관리',
        'AI 기반 메일 요약',
        '템플릿 기반 자동 답장 생성',
        '벡터 DB 기반 빠른 검색',
      ],
      intent: '메일 화면은 사람들이 보편적으로 메일 서비스에서 기대하는 부분들을 구현하고자 했습니다. 회신을 하면 이전 메일 내용이 첨부되겠구나, 안 읽은 메일을 읽으면 볼드 처리가 풀리겠구나 하는 것들입니다. 최대한 가독성과 직관성에 초점을 두었습니다. AlphaMail이 제공하는 AI 기능을 어떻게 인터페이스를 설계해서 사용자에게 보여줄 지 고민이 많았습니다. 메일을 읽는 메인 흐름을 방해하지 않으면서도 항상 접근 가능한 위치에 인터페이스를 배치하기 위해 사이드 패널 모달로 구현했습니다. 이를 통해 기존 메일 서비스의 기본기에 AI 가치를 덧붙인 차별화된 경험을 제공하고자 했습니다.',
      troubleShooting: {
        title: '컴포넌트 리렌더링으로 인한 입력 지연 현상',
        initialImpl: '메일 작성 폼은 받는 사람, 제목, 본문, 첨부파일 등 여러 개의 입력 필드를 포함한 복잡한 구조였습니다. 초기에는 폼 상태를 개별 useState로 관리했습니다.',
        problem: [
          '각 입력 폼에 뭔가 입력할 때마다 입력 지연이 발생',
          '텍스트나 숫자를 입력할 때 한 글자 씩 끊김',
          '품목을 추가할 때 입력 중인 필드의 포커스가 해제되기도 함'
        ],
        analysis: [
          'React DevTools Profiler로 분석한 결과, 특정 상태 변경 시 전체 MailWriteTemplate 컴포넌트와 그 자식 컴포넌트들(MailWriteForm, MailQuillEditor, MailAttachmentInput 등)이 함께 리렌더링됨',
          '관련 자료를 찾아본 결과, 개별 useState로 관리할 경우 한 필드 변경 시 부모 컴포넌트 전체가 리렌더링되고, 자식 컴포넌트들도 props 업데이트로 인해 함께 리렌더링 될 수 있다는 점을 배움',
        ],
        solution: 'Zustand를 전역 상태 관리 뿐만 아니라 로컬 폼 상태 관리에도 사용했습니다. 상태를 분리해 필요한 부분만 업데이트하여 상태 변경의 영향 범위를 최소화합니다.',
        solutionCode: `// 스토어 생성
interface MailState {
	//상태 및 상태별 setter
}

export const useMailStore = create<MailState>((set) => ({
  recipients: [],
  subject: '',
  content: '',
  threadId: null,
  inReplyTo: null,
  references: '',
  attachments: [],

  setRecipients: (recipients) => set({ recipients }),
  setSubject: (subject) => set({ subject }),
  setContent: (content) => set({ content }),
  setThreadId: (threadId) => set({ threadId }),
  setInReplyTo: (inReplyTo) => set({ inReplyTo }),
  setReferences: (references) => set({ references }),

  addAttachment: (file) => set((state) => ({
    attachments: [...state.attachments, { id: generateId(), file, name: file.name, size: file.size, type: file.type }]
  })),

  removeAttachment: (id) => set((state) => ({
    attachments: state.attachments.filter(a => a.id !== id)
  })),

  clearAttachments: () => set({ attachments: [] }),

  resetMailCompose: () => set({
    recipients: [],
    subject: '',
    content: '',
    threadId: null,
    inReplyTo: null,
    references: '',
    attachments: []
  }),
}));

// 이후 각 컴포넌트 별로 필요한 필드만 구독!

// MailRecipientInput.tsx
const { recipients, setRecipients } = useMailStore((state) => ({
  recipients: state.recipients,
  setRecipients: state.setRecipients,
}));

// MailSubjectInput.tsx
const { subject, setSubject } = useMailStore((state) => ({
  subject: state.subject,
  setSubject: state.setSubject,
}));

// MailQuillEditor.tsx
const { content, setContent } = useMailStore((state) => ({
  content: state.content,
  setContent: state.setContent,
}));

// MailAttachmentInput.tsx
const { attachments, addAttachment, removeAttachment } = useMailStore((state) => ({
  attachments: state.attachments,
  addAttachment: state.addAttachment,
  removeAttachment: state.removeAttachment,
}));`,
        results: [
          '코드 간소화: 부모 컴포넌트는 useState를 지우고, 필요한 필드만 구독',
          '폼 입력 시 입력 지연 제거: 입력 시에 발생하는 끊김 현상과 포커스 해제 현상 제거',
          '유지보수성 강화: 초기 구현에 비해 상태 변경의 영향 범위가 명확해져, 새로운 기능 추가 시 변경할 코드의 범위 예측 용이'
        ],
        lessons: [
          '데이터의 특성에 따라 상태를 분리하자. 상태의 구조와 위치가 성능에 얼마나 큰 영향을 미치는지 체감. 상태를 도메인별로 적절히 분리하면 불필요한 리렌더링을 방지할 수 있었음.',
          '도구를 쓴다면 그 이유와 사용법을 확실히 알자: Zustand가 전역 상태 관리에 좋다고 하여 단순히 그 부분에만 적용했던 것이 실수. 실제로는 상태 구조와 위치만 잘 설계하면 로컬 폼 상태에도 동일하게 적용할 수 있다는 것을 배움',
        ]
      }

    },
    {
      id: 'work',
      title:'3. 문서 관리',
      image: '/projects/alphamail/work.png',
      features: [
        '견적서 자동 생성 및 문서화',
        '발주서 처리',
        '거래처 관리',
        '원클릭 pdf 문서 출력',
      ],
      intent: '문서 작업 화면은 레퍼런스를 찾아보는 데에 가장 많은 시간을 들였던 것 같습니다. 회사원들이 그룹웨어를 이용하며 필요할 만한 기능과, 기능이 위치하길 기대하는 UI를 충실히 구현하는 데 초점을 맞췄습니다. 이를 통해 서비스에 대한 학습 없이도 직관적으로 사용할 수 있도록 설계했습니다.',
    },
    {
      id: 'chatbot',
      title:'4. 챗봇',
      image: '/projects/alphamail/chatbot.png',
      features: [
        '실시간 업무 지원',
        '일정 등록/조회',
        '발주서/견적서 검색',
        '전역 접근성'
      ],
      intent: '"AI가 서비스 전체를 관리하고 있다!" 라는 느낌을 사용자가 받길 원했습니다. 본래 챗봇을 제외한 위 4가지 기능이 1차 MVP 였습니다. 개발 이후 사용자 테스트를 진행해본 결과, 가장 많이 들은 피드백은 AI 서비스인데 AI가 뭔가 하고 있다는 느낌을 받기 어렵다, AI에게 일을 직접 시킬 수 있어야 비서인 것 같다 라는 피드백이었습니다. 챗봇은 이러한 피드백을 반영하여 개발했습니다. AlphaMail 전 화면에 걸쳐 존재하며, 업무 도중 모르는 것이 있다면 챗봇이 안내해주는 가이드를 통해 질문이 가능합니다. 또한 원하는 일정을 등록하고, 오늘 들어온 견적 요청이 몇 건인지 알아보는 등 상세하고 세부적인 업무를 수행할 수 있습니다.',
    }
  ],

  githubUrl: 'https://github.com/mail-coding/AlphaMail',
  // demoUrl: 'https://alphamail.vercel.app'
};
