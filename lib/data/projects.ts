// lib/data/projects.ts
import { Project } from '@/types';

export const projects: Project[] = [
  {
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
  },

  {
    title: 'ReBirth',
    subtitle: '카드 사용 방식을 새롭게 정의하는 모바일 금융 서비스',
    description: '카드 혜택 기반 소비관리를 지원하는 모바일 금융 서비스',
    longDescription: 'ReBirth는 사용자가 결제를 할 때, 해당 결제 항목에 대한 최적의 카드를 자동으로 골라서 결제해주고, 소비 관리에 대한 전반적인 지원까지 해주는 모바일 금융 서비스입니다.',
    image: '/projects/Rebirth.png',
    imageAspect: 'landscape',
    tags: [ 'Android Studio', 'Figma' , 'Kotlin', 'Jetpack Compose', 'Coroutines', 'MVVM', 'Retrofit', 'material3'],
    duration: '2025.02 - 2025.04',
    role: '모바일 프론트엔드 개발',
    teamSize: '6명',

    implementations: [
      {
        text: '💳 스마트 결제 시스템: 결제 시점에 최적 혜택 카드 자동 선택, QR 코드 결제와 다중 인증 방식 지원',
      },
      {
        text: '🎯 개인화 서비스: AI 기반 소비패턴 분석을 통해 최적 카드 제안, 월별 소비 패턴 분석 및 리포트 제공 ',
      },
      {
        text: '📊 데이터 관리: 마이데이터 연동으로 실시간 거래 내역 동기화, 카드 혜택 요약 및 관리',
      }
    ],

    responsibilities: [
      '모바일 프론트엔드 개발'
    ],

    techReasons: [
      {
        name: 'Kotlin',
        reasons: [
          '모바일 개발에서 많이 사용되는 언어 중 하나. 카드 관리 및 결제 최적화 모바일 앱이라는 특성상 안전성이 매우 중요했음.',
          'Kotlin의 null-safety, sealed class 등은 런타임에 발생할 수 있는 충돌을 컴파일 단계에서 방지할 수 있어, 금융을 다루는 프로젝트에 적합하다고 판단'
        ]
      },
      {
        name: 'Jetpack Compose',
        reasons: [
          '기존 XML 기반 View 시스템과 달리 Compose는 선언적 UI로 상태 변화에 따른 UI 업데이트를 직관적으로 구현할 수 있음.',
          '동적인 UI 요소들이 많았기 때문에, Compose의 recomposition 메커니즘으로 효율적인 상태 관리가 가능하다고 판단.'
        ]
      },
      {
        name: 'Coroutines',
        reasons: [
          'Kotlin Coroutines의 suspend 함수와 launch, async 빌더를 통해 선언적이고 읽기 쉬운 비동기 코드를 작성하고, 콜백이 반복되는 이슈를 방지.',
          '네트워크 요청(API 호출) 특히 결제 시 SSE(Server-Sent Events) 연결 등 비동기 작업이 매우 많은 프로젝트에 적합.'
        ]
      },
      {
        name: 'Retrofit',
        reasons: [
          '기본적으로, 안드로이드 환경에서의 데이터 통신은 Retrofit을 기본적으로 이용한다고 알고있음.',
          'Retrofit의 @Interceptor를 통해 모든 요청에 자동으로 인증 토큰을 주입하도록 구현, Converter를 통해 JSON 응답을 Kotlin 객체로 자동 변환하여 타입 안전성을 확보'
        ]
      },
      {
        name: 'MVVM',
        reasons: [
          '비즈니스 로직과 UI를 명확하게 분리하기 위해 MVVM 아키텍처를 선택. Repository 패턴과 함께 사용.',
          '단방향 데이터 흐름으로 상태 관리가 예측 가능하고, 유지보수 하기 용이해질 것이라고 판단.'
        ]
      },
      {
        name: 'Material Design 3',
        reasons: [
          'ReBirth는 사용자의 시각적 경험에 많은 공을 들인 프로젝트. 이를 위해 일관된 컴포넌트와 스타일링이 필요.',
          '색상 시스템, 타이포그래피, 그림자 효과 등을 활용하면 빠르게 프로토타입을 만들 수 있음. 개발 속도 향상.'
        ]
      }
    ],
    reviews: [
      {
        id: 'payment',
        title: '1. 결제',
        image: [
          '/projects/rebirth/payment1.png',
          '/projects/rebirth/payment2.png',
          '/projects/rebirth/payment3.png'
        ],
        features: [
          '현재 결제 항목의 정보를 읽고, 이를 바탕으로 가장 혜택을 많이 볼 수 있는 카드를 자동으로 선택',
          '바코드/QR 코드 탭으로 결제 방식을 선택하여 적절한 결제 프로세스 제공',
          'OCR 기술로 카드 뒷면을 촬영하여 자동으로 카드 정보를 인식하고 등록, 수동 입력도 지원',
          '선택한 카드로 토큰을 발급받아 보안성을 높인 일회용 거래 수행'
        ],
        intent: '결제 화면은 Rebirth의 핵심 가치인 최적의 카드로 최대 혜택 얻기를 구현한 파트입니다. 추천 카드를 선택해서 결제하면, 현재 결제 항목에 대한 정보를 바탕으로 최적의 카드를 골라줍니다. 만약 카드가 아직 등록이 안되어 있더라도, OCR 기반 카드 등록으로 쉽고 빠르게 새로운 카드를 추가할 수 있습니다. 또한 결제 시 바코드와 QR 코드 두 가지 방식을 지원해서, 사용자는 상황에 맞는 결제 수단을 선택할 수 있습니다. 각 카드에는 고유한 별자리가 생성됩니다. 우주의 무수한 별처럼 흩어져 있는 혜택을 하나로 이어준다는 느낌을 위해, 별과 별을 이어서 별자리를 만들어 주었습니다. 각 카드가 고유의 정체성을 가진 존재이고, 결제라는 일상적 행동을 특별한 순간으로 변환하고자 했습니다.',
        troubleShooting: {
          title: '동시 결제 트랜잭션 시 대기 시간 증가 & 결제 실패 현상 ',
          initialImpl: '결제 시스템은 사용자가 QR 코드를 스캔한 후 Server-Sent Events(SSE)를 통해 실시간으로 결제 완료 이벤트를 받아야 합니다. 초기에는 즉시 상태 변경하도록 구현했습니다.',
          problem: [
            '동시에 여러 사용자가 결제를 진행하도록 테스트를 진행하면서 문제 발견',
            '사용자 수가 많아질수록 결제 완료까지의 대기 시간이 눈에 띄게 증가',
            '일부 사용자의 결제가 타임아웃으로 실패'
          ],
          analysis: [
            '문제의 원인을 파악하기 위해 SSE 연결 안정성을 확인 -> SSE는 짧은 시간 동안 연결을 유지, 재연결 로직 필요',
            '스레드 측면에서: 사용자 A의 상태 변경이 즉시 일어나면서 UI 업데이트 -> 메인 스레드가 이 업데이트 작업으로 인해 블로킹됨',
            '블로킹 되는 시간 동안 다른 사용자 B의 다른 작업이 대기할 수 있음'
          ],
          solution: 'SSE heartbeat 감지와 재연결 로직을 추가해 타임아웃을 방지, 메인 스레드의 여유를 확보하기 위해 결제 상태 변경 전 지연 처리',
          solutionCode: `private var isReconnecting = false
private val reconnectDelay = 1000L

private fun connectToPaymentEvents() {
    viewModelScope.launch {
        paymentRepository.connectToPaymentEvents()
            .catch { e ->
                // 타임아웃 감지 시 자동 재연결
                if (e.message?.contains("timeout") == true && !isReconnecting) {
                    isReconnecting = true
                    Log.d("PaymentViewModel", "SSE 타임아웃으로 인한 재연결 시도")
                    delay(reconnectDelay)
                    isReconnecting = false
                    connectToPaymentEvents()  // 재귀 호출로 재연결
                }
            }
            .collect { event ->
                //그 외 등등..
            }
    }
}
          
          // SSE 이벤트 수신 후
event.message?.startsWith("TXN") == true -> {
    try {
        val paymentData = event.message.split(",")
        _paymentResult.value = PaymentResult(
            amount = paymentData[1].toIntOrNull() ?: 0,
            createdAt = formatDateTime(paymentData[2]),
            approvalCode = paymentData[0]
        )

        viewModelScope.launch {
            if (_paymentState.value is PaymentState.Processing) {
                delay(3000)  // ← 최소 3초 지연
                _paymentState.value = PaymentState.Completed
                Log.d("PaymentViewModel", "결제 완료 상태로 변경")
            }
        }
    } catch (e: Exception) {
        Log.e("PaymentViewModel", "결제 데이터 파싱 오류: {e.message}")
    }
}

fun completePayment(token: String) {
    viewModelScope.launch {
        try {
            _paymentState.value = PaymentState.Processing
            val startTime = System.currentTimeMillis()
            val response = paymentRepository.completePayment(token)
            
            if (response.isSuccessful && response.body()?.success == true) {
                _paymentResult.value = PaymentResult(...)
                
                // 경과 시간을 고려한 동적 지연
                val elapsedTime = System.currentTimeMillis() - startTime
                val remainingTime = 3000 - elapsedTime
                
                if (remainingTime > 0) {
                    delay(remainingTime)  // ← 동적 3초 지연
                }
                _paymentState.value = PaymentState.Completed
            }
        } catch (e: Exception) {
            _paymentState.value = PaymentState.Error(...)
        }
    }
}`,
          results: [
            'SSE 연결 안정성 강화: 타임아웃이 발생하더라도 자동으로 재연결 하도록 만들어 SSE 연결 해제로 인한 결제 실패 문제를 방지',
            '메인 스레드 여유 확보:  여러 사용자의 결제 작업을 각각의 coroutine에서 병렬적으로 처리. 이를 통해 결제 대기 시간을 이전에 비해 절반 이하로 줄일'
          ],
          lessons: [
            '비동기 처리의 중요성: 적절한 지연 처리로 시스템에 쉬는 시간을 제공하는 것의 중요성을 확인',
            '연결 기반 통신의 안정성: SSE는 단순 REST API 통신과는 달리, 연결을 유지해야 하는 방식. invalidateQueries는 API 요청과 뮤테이션을 효과적으로 결합하는 핵심 기능',
            '3초 지연에 대한 의문. 3초라는 시간은 임의로 설정한 시간. 모든 상황에서 최적의 조건인지 사용자 패턴 분석이 더 필요'
          ]
        }
      },
      {
        id: 'myCard',
        title: '2. 내 카드',
        image: [
          '/projects/rebirth/myCard1.png',
          '/projects/rebirth/myCard2.png',
          '/projects/rebirth/myCard3.png'
        ],
        features: [
          '가로 스크롤로 여러 카드를 확인하며, 각 카드의 이번 달 사용액과 받은 혜택을 한눈에 파악',
          '선택한 월의 거래 기록을 날짜별로 그룹화하여 표시하고, 각 거래에서 받은 혜택을 함께 노출',
          '해당 카드를 통해 받은 혜택을 세분화하여 표시하고, 각 카테고리의 혜택 사용 현황을 시각화',
          '전월 실적도 시각화, 몇 구간 혜택을 받을 수 있는지 표시'
        ],
        intent: '내 카드 화면은 사용자가 자신의 카드 사용 패턴을 상세하게 되돌아볼 수 있는 공간입니다. 단순한 거래 기록이 아닌, 각 거래마다 받은 혜택을 함께 표시함으로써 사용자에게 "이 거래에서 나는 이만큼의 가치를 얻었다"는 인식을 심어줍니다. 이를 통해 Rebirth를 통한 결제 생활 만족감을 높이고자 의도했습니다. 또한 실적 관리도 함께 진행함으로써, 어떤 카드로 소비를 해야겠다는 소비 계획 수립에도 도움이 되고자 했습니다.',
        troubleShooting: {
          title: '카드 상세의 소비 내역 상태 관리 불량 현상 ',
          initialImpl: '카드 상세 화면에서 사용자가 월을 선택하거나 탭(내역/혜택)을 전환할 때, Compose의 LaunchedEffect와 remember를 통해 상태를 관리했습니다. 초기에는 월 변경(selectedMonth)만을 dependency로 감지하여 데이터를 로드했습니다.',
          problem: [
            '월별 탭 전환 시 해당 월과 불일치하는 데이터가 표시되는 현상 발생',
            '1. 10월에서 시작 → 9월로 월 변경 (내역과 혜택 모두 9월 표시) ✓',
            '2. 9월 상태에서 혜택 탭으로 전환 (9월 혜택 표시) ✓',
            '3. 다시 내역 탭으로 돌아옴 (10월 내역이 표시) ❌',
            '내역 탭에서만 이 현상이 발생, 혜택 탭은 올바르게 동작'
          ],
          analysis: [
            '캐시를 도입한 이후 이 현상이 발생했었기 때문에,  Compose의 remember/recomposition 캐시 메커니즘 분석',
            '탭 전환 시 UI는 리컴포지션되지만, 거래 내역 데이터(transactionHistoryState)는 이전 상태 그대로 유지되는 Compose의 캐시 메커니즘이 작동함.',
            '내역 탭으로 돌아올 때도 selectedMonth는 변하지 않으므로 LaunchedEffect가 재실행되지 않음. 화면에 렌더링되는 것은 remember의 캐시된 상태값임.'
          ],
          solution: 'LaunchedEffect의 dependency 배열에 selectedTab을 추가하고, 탭 변경 시 상태 재평가 로직을 추가',
          solutionCode: `LaunchedEffect(key1 = cardId, key2 = selectedMonth, key3 = selectedTab) {
    val monthChanged = selectedMonth != viewModel.selectedMonth.value
    val cardChanged = cardId != viewModel.selectedCardId.value
    
    if (monthChanged || cardChanged) {
        viewModel.resetTransactionPagination()
        viewModel.getCardTransactionHistory(cardId, selectedMonth, 0, 50)
    }
    else if (selectedTab == 0) {
        val currentState = transactionHistoryState
        if (currentState !is MyCardViewModel.TransactionHistoryState.Success ||
            currentState.allTransactions.isEmpty()) {
            viewModel.getCardTransactionHistory(cardId, selectedMonth, 0, 50)
        }
    }
}`,
          results: [
            'UI 상태 일관성 유지: 어떤 경로로 탭을 전환하든 선택된 월의 올바른 데이터가 표시되도록 개선, 선택된 월의 내역이 유지',
            '상태 관리 안정성:  여러 사용자의 결제 작업을 각각의 coroutine에서 병렬적으로 처리. 이를 통해 결제 대기 시간을 이전에 비해 절반 이하로 줄일'
          ],
          lessons: [
            'UI 상태와 데이터 상태의 분리 필요성:  단순히 변수가 변했으니 재로드 가 아니라, 개발자가 원하는 상태 변화 를 정확히 정의해둬야 함함',
            '명시적 검증의 필요: 검증 단계를 추가함으로써 예상치 못한 캐시 불일치를 방지, 하지만 검증 단계도 추가적인 비용이 소모되므로 사용 여부를 신중히 결정',
          ]
        }
      },
      {
        id: 'home',
        title:'3. 홈',
        image: [
          '/projects/rebirth/home1.png',
          '/projects/rebirth/home2.png',
          '/projects/rebirth/home3.png'
        ],
        features: [
          '이번 달 소비 현황, 사용자 월 지출액 and 받은 혜택과 놓친 혜택 표시',
          '최근 소비 리뷰, 가장 최근의 소비에서 받은 혜택 or 놓친 혜택과 추천 카드 표시',
          '추천 카드 홍보, 3개월 소비 통계를 기반으로 가장 혜택을 많이 볼 수 있는 카드를 추천',
        ],
        intent: 'Rebirth는 사용자가 카드의 가치를 재발견하는 경험을 핵심으로 삼았습니다. 홈 화면에서는 사용자가 카드의 가치를 잘 누리고 있는지 바로 확인할 수 있도록 구성했습니다. 복잡한 네비게이션 없이도 이번 달 나는 얼마를 썼고, 어느 정도의 혜택을 보았는지 확인할 수 있습니다. 또한 3개월동안 사용자의 소비 통계를 기반으로, 추가적인 혜택을 볼 수 있는 카드를 추천합니다. 이를 통해 소비 관리를 한 화면 안에서도 수행할 수 있도록 만들고자 했습니다. 홈의 행성은 사용자의 소비 통계를 기반으로 나타납니다. 태양계 행성들 중 하나의 행성을 받게되며, 우주적인 느낌을 살리고자 반영했습니다. 모든 네비게이션은 마치 우주를 여행하듯이 진행되며, 이를 통해 디자인 컨셉을 유지하고자 했습니다.',
      },
      {
        id: 'report',
        title:'4. 소비 리포트',
        image: [
          '/projects/rebirth/report1.png',
          '/projects/rebirth/report2.png',
          '/projects/rebirth/report3.png'
        ],
        features: [
          '월별 캘린더 기반 거래내역 조회, 특정 날짜 선택 시 그날의 거래내역을 상세히 확인.',
          '결제 성향 분석, 태양계 행성에 빗대어 사용자의 월별 결제 패턴과 특성을 시각적으로 분석하고 설명',
          '소비그룹 벤치마킹, 사용자의 월간 사용액 구간과 동일한 구간의 다른 사용자들이 받은 혜택과 비교하여 자신의 혜택 수준을 평가',
        ],
        intent: '소비 리포트는 사용자가 자신의 상세한 소비 데이터를 직관적으로 확인할 수 있도록 만든 화면입니다. 가계부는 토스의 월별 소비 내역에서 많은 레퍼런스를 얻었습니다. 일반적인 리스트 형식 대신 캘린더를 사용함으로써 월간 소비를 좀 더 한눈에 볼 수 있도록 만들어봤습니다. 또한 소비 리포트를 통해 지금까지의 소비에 대한 인사이트를 제공하고자 했습니다.',
      }
    ],

    githubUrl: 'https://github.com/Xylitol311/ReBirth',

  },
  {
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
      // 봉사자 계정
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
      // 봉사 기관 계정
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

  },
  {
    title: 'PoseTive',
    subtitle: '이미지의 포즈를 사용자가 그리는 대로 변환할 수 있는 AI 기반 웹 서비스',
    description: '이미지의 포즈를 사용자가 그리는 대로 변환할 수 있는 AI 기반 웹 서비스',
    longDescription: `PoseTive는 이미지에서 사람의 포즈를 인식하고, 이 사람의 포즈를 사용자가 업로드한 이미지나 그린 그림에서 추출한 포즈로 바꿔주는 Image recognition 모델 기반 웹 서비스입니다.`,
    image: '/projects/Posetive.png',
    imageAspect: 'landscape',
    tags: ['Python', 'PyTorch', 'Image Recognition', 'Pose Estimation', 'Pandas', 'NumPy'],
    duration: '2024.03 - 2024.06',
    role: 'AI 모델링',
    teamSize: '6명',

    implementations: [
      {
        text:'자체 데이터셋 약 3,000장을 활용한 포즈 추정 모델 파인튜닝.'
      },
      {
        text:'모델 레이어 분석을 통한 과적합 문제 해결.'
      },
      {
        text:'전이 학습 기법 적용 (특징 추출 레이어 동결 후 출력층만 학습)'
      },
      {
        text:'제한된 학습 환경에서의 효율적인 모델 최적화'
      }
    ],

    responsibilities: [
      'AI 모델링'
    ],

    techReasons: [
      {
        name: 'Python',
        reasons: [
          '딥러닝 모델 개발과 이미지 처리 작업에 최적화된 언어.',
          '풍부한 데이터 처리 라이브러리 생태계와 빠른 프로토타이핑이 가능하여, 제한된 개발 기간 내에 효율적으로 모델을 구축가능.'
        ]
      },
      {
        name: 'Pytorch',
        reasons: [
          '사전 학습된 이미지 인식 모델을 기반으로 포즈 추정 모델을 파인튜닝하기 위해 도입.',
          '동적 계산 그래프와 직관적인 API로 복잡한 전이 학습 과정을 유연하게 구현 가능, 모델 레이어를 세밀하게 제어할 수 있어 과적합 문제 해결에 효과적'
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
        name: 'Pandas & NumPy',
        reasons: [
          '데이터셋 전처리와 이미지 텐서 연산, 수치 계산을 위해 활용. 대규모 데이터를 효율적으로 처리하고, NumPy의 벡터화 연산으로 학습 속도를 크게 향상시킴.'
        ]
      }
    ],

    keyLearnings: [
      '코드가 움직이는 경험의 감동: AI 모델을 학습시키고 실제로 사용자의 드로잉을 자세로 변환하는 것을 직접 눈으로 보며 "내 코드가 실제로 뭔가를 만들어낸다"는 것을 깨달음. 단순히 프로그래밍을 배우는 것에서 프로그래밍으로 의미 있는 것을 만든다는 마음가짐으로 변화',
      '문제 해결의 즐거움: GPU 메모리 부족, 느린 추론 속도 같은 현실적인 문제들을 마주했을 때 그것을 해결하는 과정 자체가 즐거웠음. 검색하고, 시도하고, 실패하고, 다시 시도하는 과정에서 프로그래밍은 결국 문제 해결임을 체감',
      '기술 선택 능력의 중요성: PyTorch를 선택한 이유, TensorFlow가 아닌 이유, 왜 양자화를 했는지 등을 모두 고민함. 단순히 "이 기술이 유명하니까"가 아니라 "우리 문제에 왜 이게 최적인가"를 생각하는 것이 개발의 핵심임을 배움',
      '팀 프로젝트의 가치: 웹 개발자와 협업하면서 내가 만든 모델이 누군가의 코드와 연결되고 그것이 사용자에게 전달된다는 것을 체험. 개발은 혼자 하는 것이 아니라 함께 하는 것이라는 깨달음과 함께 개발 커뮤니티에 대한 흥미가 생김'
    ],

    reviews: [
      {
        id: 'end-to-end-learning',
        title: '1. End-to-End 학습 기법의 적용',
        features: [
          '사전 학습된 ResNet의 초기 레이어(layer1, layer2) 동결, 후반부 레이어(layer3, layer4)만 학습 가능하게 설정',
          '입력 이미지부터 최종 출력까지 전체 파이프라인을 한 번에 학습',
          'Colab GPU 환경에서 30 Epoch 학습 시 약 60시간 단축',
          'GPU 사용률 최적화 달성'
        ],
        intent: '제한된 학습 환경(Colab GPU)에서 효율적으로 모델을 학습시키되, 입력부터 출력까지의 전체 파이프라인이 일관되게 동작하도록 설계했습니다. 초기 레이어의 일반적인 특징들은 이미 학습되어 있으므로 이를 활용하고, 포즈 추정에 필요한 후반부 특징들만 새로 학습하여 학습 시간과 데이터 요구량을 모두 줄일 수 있었습니다.'
      },
      {
        id: 'single-pass-training',
        title: '2. Single-pass 학습 방식',
        features: [
          '각 배치마다 전체 데이터를 한 번에 통과시키는 방식 도입',
          '각 에포크마다 전체 검증셋을 한 번에 평가',
          '성능이 더 이상 개선되지 않으면 조기 종료(Early Stopping)하여 과적합 차단',
          '검증 정확도 88% 달성, 범용 정확도 87% 수준 유지',
          '사용자의 다양한 드로잉 스타일에 대한 일관된 성능 보장'
        ],
        intent: '모델이 학습 데이터에만 치우쳐 실제 사용 환경에서의 성능 저하를 방지하기 위해 고안되었습니다. 각 에포크마다 전체 검증셋을 한 번에 평가하고, 성능이 더 이상 개선되지 않으면 조기 종료하여 과적합을 사전에 차단합니다. 이를 통해 테스트셋뿐만 아니라 실제 사용자의 다양한 드로잉 입력에도 안정적으로 대응할 수 있었습니다.'
      },
      {
        id: 'model-optimization',
        title: '3. 모델 최적화 및 성능 개선',
        features: [
          '고해상도(1920x1080) 이미지를 640x480으로 단계적 축소하여 GPU 메모리 사용량 50% 감소',
          '모델 가중치를 32-bit에서 8-bit로 양자화하여 모델 크기 180MB → 45MB로 축소',
          '추론 시간: 15초 → 7.8초로 개선 (약 48% 단축)',
          '최종 모델 크기: 450MB → 180MB로 축소'
        ],
        intent: '제한된 서버 환경에서 많은 동시 사용자의 요청을 처리하면서도 빠른 응답 시간을 보장하기 위해 고안되었습니다. 이미지 해상도와 모델 정밀도를 전략적으로 조정하여 성능 손실을 최소화하면서도 실질적인 속도 향상을 달성했습니다.'
      }
    ],

    githubUrl: 'https://github.com/Kim-Taein/9jodae_pose'
  },
  {
    title: 'Portfolio',
    subtitle: 'Atomic Design과 타입 안정성으로 구축한 개인 포트폴리오 웹사이트',
    description: 'Next.js 15 + TypeScript 기반 개인 포트폴리오 웹사이트',
    longDescription: '최신 웹 기술과 디자인 시스템을 적용하여 완성도 높은 사용자 경험을 제공하는 개인 포트폴리오 웹사이트입니다. Atomic Design 패턴으로 체계적인 컴포넌트 구조를 구축하고, TypeScript로 타입 안정성을 확보했습니다.',
    image: '/projects/Portfolio.png',
    imageAspect: 'landscape',
    tags: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS 4', 'Headless UI', 'Atomic Design'],
    duration: '2024.10 - 2025.10',
    role: '웹 프론트엔드 개발',
    teamSize: '1명 (개인 프로젝트)',

    implementations: [
      {
        text: '⚛️ Atomic Design 아키텍처: 23개 컴포넌트를 3단계로 구조화 (Atoms 13개, Blocks 4개, Sections 6개)',
      },
      {
        text: '🎨 디자인 시스템 구축: Tailwind CSS 4의 @theme 문법과 TypeScript로 이중 디자인 토큰 시스템 구현',
      },
      {
        text: '🪝 Custom Hooks 개발: useModal, useScroll, useIntersection 3개 훅으로 로직 재사용성 극대화',
      },
      {
        text: '🚪 SSR-safe Modal 시스템: Portal 기반 모달과 Navigation을 Next.js SSR 환경에서 안전하게 동작하도록 구현',
      },
      {
        text: '⚡ 성능 최적화: Turbopack 빌드, 동적 임포트, 이미지 최적화, throttle 적용으로 빠른 로딩 속도 달성',
      },
      {
        text: '♿ 접근성 강화: ARIA 레이블, 키보드 네비게이션, 시맨틱 HTML로 웹 접근성 준수',
      }
    ],

    responsibilities: [
      '웹 프론트엔드 개발'
    ],

    techReasons: [
      {
        name: 'Next.js 15',
        reasons: [
          'App Router로 최신 서버 컴포넌트 아키텍처 적용 가능, SEO 최적화와 빠른 초기 로딩 속도 확보',
          'Turbopack으로 개발 속도 대폭 향상, Image/Font 최적화 기능으로 성능 개선',
          'React 19의 최신 기능 지원으로 미래 지향적 프로젝트 구축 가능'
        ]
      },
      {
        name: 'TypeScript',
        reasons: [
          '23개 컴포넌트와 복잡한 데이터 구조(Project, Skill, Experience 등)에서 타입 안정성 확보',
          'Props 인터페이스로 컴포넌트 사용법 명확화, IDE 자동완성으로 개발 생산성 향상',
          '중앙 타입 관리로 전체 프로젝트의 일관성 유지 및 리팩토링 용이'
        ]
      },
      {
        name: 'Tailwind CSS 4',
        reasons: [
          '최신 @theme 문법으로 디자인 토큰을 CSS 변수로 관리, 일관된 디자인 시스템 구축',
          'Utility-first 방식으로 빠른 프로토타이핑 가능, 프로덕션 빌드 시 미사용 스타일 자동 제거',
          '반응형 디자인 구현이 간결하고 직관적 (sm/md/lg/xl 브레이크포인트)'
        ]
      },
      {
        name: 'Headless UI',
        reasons: [
          '접근성이 기본 내장된 컴포넌트로 ARIA 속성, 키보드 네비게이션 자동 처리',
          'Unstyled 컴포넌트로 Tailwind와 완벽히 결합 가능, 커스터마이징 자유도 극대화',
          'Modal, Menu 등 복잡한 상호작용 컴포넌트를 안정적으로 구현'
        ]
      },
      {
        name: 'Atomic Design',
        reasons: [
          '컴포넌트를 Atoms → Blocks → Sections로 계층화하여 명확한 구조 확립',
          '13개 Atoms가 모든 상위 컴포넌트에서 재사용되어 코드 중복 최소화',
          '단일 책임 원칙 준수로 각 컴포넌트의 역할이 명확하여 유지보수성 향상'
        ]
      }
    ],

    keyLearnings: [
      'Next.js SSR 환경의 이해: 서버와 클라이언트는 다른 환경이며, Portal이나 브라우저 API 사용 시 mounted state로 클라이언트 렌더링 확인이 필수임을 체득',
      '성능 최적화 기법: throttle, 동적 임포트, 이미지 최적화 등 실제로 적용 가능한 최적화 방법들을 프로젝트에 통합',
      'Custom Hooks의 가치: 반복 로직을 Hook으로 추출하면 컴포넌트가 간결해지고 테스트도 용이해진다는 것을 실감',
      '단일 책임 원칙(SRP): 각 컴포넌트가 하나의 역할만 담당하도록 설계하면 변경의 영향 범위가 최소화되어 유지보수가 쉬워짐',
    ],

    reviews: [
      {
        id: 'ssr-modal',
        title: '1. SSR-safe Modal 시스템',
        features: [
          'createPortal로 모달을 body 직속으로 렌더링하여 z-index 문제 해결',
          'ESC 키와 backdrop 클릭으로 모달 닫기 지원',
          '모달 오픈 시 body 스크롤 잠금으로 사용자 경험 개선',
          '3가지 크기 variant (small/medium/large) 지원',
          '부드러운 fade-in/fade-out 애니메이션 적용'
        ],
        intent: 'Next.js SSR 환경에서 안전하게 동작하는 Modal 컴포넌트를 구현하고자 했습니다. Portal을 사용하면 z-index 관리가 용이하지만, 서버 렌더링 시 window 객체가 없어 에러가 발생하는 문제가 있었습니다. 이를 해결하여 모든 환경에서 안정적으로 동작하는 모달을 만들고, 사용자 경험을 해치지 않는 키보드 접근성과 스크롤 제어를 구현하는 것이 목표였습니다.',
        troubleShooting: {
          title: 'Next.js SSR 환경에서 Portal Hydration Mismatch 에러',
          initialImpl: 'Modal 컴포넌트를 구현할 때 createPortal을 사용하여 document.body에 직접 렌더링하도록 했습니다. 이는 z-index 문제를 해결하고 모달을 DOM 트리 최상위에 배치하기 위한 일반적인 방법입니다.',
          problem: [
            '개발 서버 실행 시 "Hydration failed" 에러 발생',
            '서버에서 렌더링된 HTML과 클라이언트에서 렌더링된 HTML이 일치하지 않음',
            '모달이 열릴 때 콘솔에 경고 메시지가 반복적으로 출력'
          ],
          analysis: [
            'createPortal은 브라우저의 document 객체에 접근하는데, Next.js 서버 렌더링 시에는 document가 존재하지 않음',
            '서버: Modal 컴포넌트가 null을 반환 (document 없음)',
            '클라이언트: Modal 컴포넌트가 Portal을 생성하여 실제 DOM에 렌더링',
            '이러한 불일치로 인해 React가 hydration 과정에서 에러를 발생시킴'
          ],
          solution: 'mounted 상태를 추가하여 클라이언트 렌더링이 완료된 후에만 Portal을 생성하도록 수정했습니다.',
          solutionCode: `import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 my-8 w-full max-w-2xl">
        {children}
      </div>
    </div>,
    document.body
  );
}`,
          results: [
            'Hydration 에러 완전히 제거: 서버와 클라이언트가 동일한 결과(null)를 반환하도록 하여 불일치 해소',
            'SSR 환경에서 안정적 동작: 모든 Modal 컴포넌트가 Next.js 환경에서 에러 없이 작동',
            '클라이언트 렌더링 후 정상 동작: mounted가 true가 된 후 Portal이 생성되어 의도한 대로 동작'
          ],
          lessons: [
            'Next.js SSR의 핵심 이해: 서버와 클라이언트는 다른 환경이며, document/window 같은 브라우저 API는 클라이언트에서만 접근 가능',
            'useEffect의 활용: useEffect는 클라이언트에서만 실행되므로, 브라우저 API 접근 시 useEffect 내부에서 처리하는 것이 안전',
            'Portal 사용 시 주의사항: createPortal을 사용할 때는 항상 클라이언트 렌더링 여부를 확인하는 guard가 필요',
            '점진적 향상 원칙: 서버에서는 기본 기능만 제공하고, 클라이언트에서 점진적으로 기능을 추가하는 방식이 안정적'
          ]
        }
      },
      {
        id: 'component-reusability',
        title: '2. 효율적인 컴포넌트 재사용과 상태 관리 아키텍처',
        features: [
          '재사용 가능한 Atoms 컴포넌트: Button (7 variants), Badge (8 colors), Modal (Portal 기반), SegmentedControl (범용 탭)',
          '범용 Custom Hooks: useIntersection (모든 섹션의 스크롤 애니메이션), useScroll (활성 섹션 감지), useModal (모달 상태 관리)',
          '컴포넌트 합성 패턴: ProjectCard + ProjectModal 조합으로 복잡한 UI 구성',
          '단 3줄로 스크롤 애니메이션 구현: useIntersection hook으로 로직 재사용성 극대화',
          '일관된 UX: 동일한 threshold, freezeOnceVisible 옵션으로 통일된 애니메이션'
        ],
        intent: '포트폴리오 전체에서 반복되는 UI 패턴과 로직을 재사용 가능한 컴포넌트와 커스텀 훅으로 추상화하여 코드 중복을 최소화하고 유지보수성을 극대화하고자 했습니다. 특히 AboutSection의 3가지 크리에이티브 애니메이션(TechParticleStorm, EmpathyRadar, CollaborationMesh) 구현 시, 각 컴포넌트가 독립적으로 스크롤 감지를 해야 했는데, 매번 IntersectionObserver를 직접 구현하면 코드 중복이 심각할 것이라 판단했습니다. 이를 해결하기 위해 useIntersection hook을 개발하여 모든 컴포넌트에서 일관되게 사용할 수 있도록 설계했습니다.',
        troubleShooting: {
          title: '반복되는 스크롤 애니메이션 로직과 SSR 환경 대응',
          initialImpl: 'AboutSection의 3가지 크리에이티브 애니메이션 (TechParticleStorm, EmpathyRadar, CollaborationMesh) 구현 시, 각 컴포넌트마다 IntersectionObserver를 직접 구현했습니다. 화면에 진입하면 애니메이션이 시작되고, 한 번만 실행되어야 하는 요구사항이 있었습니다.',
          problem: [
            '각 애니메이션 컴포넌트마다 IntersectionObserver 로직이 중복됨 (약 30줄씩 3번 반복)',
            'SSR 환경에서 window, document 접근 시 에러 발생 위험',
            'freezeOnceVisible 옵션 구현 시 상태 관리 로직이 복잡해짐',
            'threshold, rootMargin 같은 옵션을 각 컴포넌트마다 다르게 설정하여 일관성 부족'
          ],
          analysis: [
            'IntersectionObserver API는 브라우저 전용 API로 서버에서 실행 불가',
            '각 애니메이션 컴포넌트가 독립적으로 스크롤 위치를 추적해야 하지만, 로직은 동일',
            'freezeOnceVisible 옵션: 한 번 화면에 나타나면 다시 스크롤해도 애니메이션이 재실행되지 않아야 함',
            '컴포넌트마다 동일한 Observer 로직을 복사-붙여넣기하면 유지보수 시 모든 파일을 수정해야 함'
          ],
          solution: '범용 useIntersection hook을 구축하여 SSR 안전성을 확보하고, 모든 스크롤 애니메이션 로직을 재사용 가능하게 만들었습니다.',
          solutionCode: `// hooks/useIntersection.ts
import { useEffect, useRef, useState } from 'react';

interface UseIntersectionOptions {
  threshold?: number;
  freezeOnceVisible?: boolean;
  rootMargin?: string;
}

export function useIntersection({
  threshold = 0,
  freezeOnceVisible = false,
  rootMargin = '0px',
}: UseIntersectionOptions = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || (freezeOnceVisible && hasIntersected)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting;
        setIsIntersecting(isElementIntersecting);

        if (isElementIntersecting && freezeOnceVisible) {
          setHasIntersected(true);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, freezeOnceVisible, hasIntersected]);

  return { ref, isIntersecting };
}

// 적용 사례 1: TechParticleStorm
export default function TechParticleStorm() {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.2,
    freezeOnceVisible: true
  });

  return (
    <div ref={ref} className="relative w-full h-full">
      {/* 192개 배경 그리드 셀 */}
      {Array.from({ length: 192 }).map((_, i) => (
        <div
          key={i}
          className={isIntersecting ? 'animate-[grid-pulse_4s_ease-in-out_infinite]' : 'bg-purple-200/30'}
          style={{ animationDelay: \`\${(i * 0.02) % 3}s\` }}
        />
      ))}

      {/* 8개 기술 아이콘 */}
      {techIcons.map((icon, index) => (
        <div
          key={icon.name}
          className={isIntersecting ? 'animate-[particle-fly-in_1.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards]' : 'opacity-0'}
          style={{ animationDelay: \`\${index * 0.05}s\` }}
        />
      ))}
    </div>
  );
}

// 적용 사례 2: ProjectCard (순차 애니메이션)
function ProjectCard({ project, index, onOpenModal }: ProjectCardProps) {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.2,
    freezeOnceVisible: true
  });

  return (
    <div
      ref={ref}
      className={\`transition-all duration-700 \${
        isIntersecting
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-95 translate-y-8'
      }\`}
      style={{ transitionDelay: \`\${index * 0.1}s\` }}
      onClick={() => onOpenModal(project)}
    >
      {/* 프로젝트 카드 내용 */}
    </div>
  );
}`,
          results: [
            '코드 재사용성: 약 30줄의 Observer 로직이 단 3줄(useIntersection 호출)로 축소',
            '일관성: 동일한 threshold(0.2), freezeOnceVisible(true) 옵션으로 통일된 UX',
            '성능: IntersectionObserver 자동 cleanup (useEffect return)으로 메모리 누수 방지',
            'SSR 안전: useEffect 내부에서만 DOM 접근하여 Next.js 환경에서 에러 없음',
            '유지보수성: 애니메이션 로직 변경 시 hook만 수정하면 전체 프로젝트에 반영'
          ],
          lessons: [
            '추상화의 힘: 반복되는 로직을 hook으로 추출하면 코드량이 1/10로 줄어들고 가독성이 극대화됨',
            '컴포넌트 합성: Atomic Design 패턴을 따르면 복잡한 UI도 조립식으로 쉽게 구축 가능',
            'TypeScript의 가치: 커스텀 hook의 타입 정의로 개발자 경험이 크게 향상됨 (자동완성, 타입 안전성)',
            '성능 최적화: freezeOnceVisible 옵션 하나로 불필요한 재렌더링을 완전히 제거',
            '확장성: 새로운 섹션 추가 시 단 3줄로 스크롤 애니메이션 적용 가능하여 개발 속도 향상'
          ]
        }
      },
      {
        id: 'custom-hooks',
        title: '3. Custom Hooks 개발',
        features: [
          'useModal: 모달 상태 관리 (open/close/toggle), useCallback으로 메모이제이션',
          'useScroll: 현재 활성 섹션 감지, 스크롤 진행률 계산, throttle로 성능 최적화',
          'useIntersection: Intersection Observer 래핑, freeze-once-visible 옵션 지원'
        ],
        intent: '반복되는 로직을 Custom Hooks로 분리하여 컴포넌트 코드를 간결하게 유지하고 재사용성을 높이고자 했습니다. 특히 Navigation의 스크롤 감지 로직이 복잡했기 때문에 useScroll hook으로 추출하여 다른 컴포넌트에서도 쉽게 사용할 수 있도록 했습니다.'
      },
      {
        id: 'performance',
        title: '4. 성능 최적화',
        features: [
          'Turbopack: Next.js 15의 번들러로 빌드 속도 대폭 향상',
          '동적 임포트: Modal 컴포넌트를 dynamic import로 초기 번들 크기 감소',
          'Image 최적화: Next.js Image 컴포넌트로 자동 최적화 및 lazy loading',
          'Throttle: 스크롤 이벤트를 100ms throttle 처리하여 불필요한 리렌더링 방지',
          'Font 최적화: Pretendard 가변 폰트를 로컬에서 호스팅하여 외부 요청 제거'
        ],
        intent: '사용자에게 빠른 로딩 속도와 부드러운 인터랙션을 제공하기 위해 다양한 최적화 기법을 적용했습니다. 특히 스크롤 이벤트는 매우 빈번하게 발생하므로 throttle을 적용하여 성능 저하를 방지하고, 이미지와 폰트는 Next.js의 내장 최적화 기능을 활용했습니다.'
      }
    ],

    githubUrl: 'https://github.com/maintaein/portfolio'
  },
];
