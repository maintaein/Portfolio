import { Project } from '@/types';

export const tds: Project = {
  title: 'TDS (Taein Design System)',
  subtitle: '일관된 UI와 효율적 개발을 위한 React 기반 디자인 시스템 라이브러리',
  description: '30개 컴포넌트, Zero-runtime CSS, Tree-shakable, AI 친화적 디자인 시스템',
  longDescription: 'TDS는 개인 서비스 개발 시 일관된 UI와 효율적인 개발을 위해 만든 React 기반 디자인 시스템입니다. Vanilla Extract를 활용한 Zero-runtime CSS, 엄격한 TypeScript, TDD 기반 개발, 접근성 준수, 그리고 AI 친화적 설계가 특징입니다.',
  image: '/projects/TDS.png',
  imageAspect: 'landscape',
  tags: ['React', 'TypeScript', 'Vanilla Extract', 'Vite', 'Vitest', 'pnpm', 'Monorepo', 'TDD'],
  duration: '2025.12 - 2026.03',
  role: '1인 설계 및 개발',
  teamSize: '1명',

  implementations: [
    {
      text: '30개 UI 컴포넌트: Button, Modal, Card 등 디자인 컴포넌트를 일관된 API(variant/size/disabled) 패턴으로 제공',
    },
    {
      text: '디자인시스템 가이드 웹: 라이브 코드 에디터, Props 테이블, 접근성 가이드를 갖춘 데모 앱',
    },
    {
      text: '디자인 토큰 시스템: 8pt Grid 간격, 색상·타이포그래피·그림자·애니메이션 토큰을 Theme Contract로 관리',
    },
    {
      text: 'AI 친화 설계: llms.txt/llms-full.txt 제공, AI 도구와의 협업 최적화',
    }
  ],

  responsibilities: [
    '디자인 시스템 설계 및 전체 아키텍처 구축',
    '30개 React 컴포넌트 TDD 기반 개발',
    '데모 문서 앱 개발',
    'NPM 패키지 배포 및 빌드 최적화'
  ],

  techReasons: [
    {
      name: 'React',
      reasons: [
        '가장 널리 사용되는 UI 라이브러리로 사용자 기반이 넓어 디자인 시스템의 접근성을 높임',
        'forwardRef, Compound Component 등 라이브러리 제작에 필요한 패턴을 네이티브로 지원'
      ]
    },
    {
      name: 'TypeScript (strict, no any)',
      reasons: [
        '컴포넌트 Props의 자동완성과 타입 추론을 통해 사용자 DX를 극대화',
        'any를 완전히 배제하고 제네릭, Union, 타입 가드로 해결하여 런타임 에러 방지'
      ]
    },
    {
      name: 'Vanilla Extract CSS',
      reasons: [
        'Zero-runtime: 빌드 타임에 CSS를 생성하여 런타임 오버헤드 제로',
        'TypeScript로 스타일을 작성해 토큰 참조 시 타입 안전성을 보장하고, 존재하지 않는 토큰 참조를 컴파일 타임에 방지'
      ]
    },
    {
      name: 'Vite',
      reasons: [
        'preserveModules 옵션으로 컴포넌트별 개별 번들을 생성해 Tree-shaking 지원',
        'ESM/CJS 듀얼 포맷 라이브러리 빌드와 Vanilla Extract 플러그인 통합이 자연스러움'
      ]
    },
    {
      name: 'Vitest + Testing Library',
      reasons: [
        'Vite 기반 테스트 러너로 빌드 설정을 공유하여 환경 불일치 방지',
        '사용자 관점의 테스트로 접근성과 실제 동작을 함께 검증'
      ]
    },
    {
      name: 'pnpm Monorepo',
      reasons: [
        'core, demo, docs 패키지를 하나의 저장소에서 관리하면서도 독립적 빌드/배포 가능',
        'workspace:* 프로토콜로 패키지 간 실시간 연동, dog-fooding 워크플로우 지원'
      ]
    }
  ],

  reviews: [
    {
      id: 'treeshaking',
      title: '1. Tree-shaking 검증 및 최적화',
      image: '/projects/TDS/tree-shaking.png',
      features: [
        'preserveModules로 컴포넌트별 개별 모듈 분리',
        'ESM(.mjs)/CJS(.cjs) 듀얼 포맷 빌드',
        'sideEffects 필드 기반 CSS-only 사이드이펙트 선언',
        'barrel file 사이드이펙트 제거'
      ],
      intent: '디자인 시스템 라이브러리의 핵심 가치 중 하나는 사용자가 Button 하나만 import해도 나머지 29개 컴포넌트가 번들에 포함되지 않는 것입니다. "Tree-shakable 라이브러리"라고 말할 수 있으려면 실제로 검증해야 한다고 판단해, Vite 프로덕션 빌드에서 단일 컴포넌트 import 시 번들 크기를 측정했습니다.',
      troubleShooting: {
        title: 'Button 단일 import 시 45KB 번들 — Tree-shaking이 동작하지 않음',
        initialImpl: 'Vite의 preserveModules: true 설정으로 컴포넌트별 개별 청크를 생성했으나, 실제 소비자 프로젝트에서 Button만 import해도 전체 라이브러리(21개 컴포넌트, 45KB)가 포함됨.',
        problem: [
          'Button만 import했는데 번들에 21개 컴포넌트가 모두 포함 (45KB)',
          '빌드 출력 파일명이 index.esm9.js, index.cjs2.js 같은 플랫 구조로 생성되어 모듈 경계 파괴',
          'Rollup이 barrel file(index.ts)을 side-effectful로 판단하여 전체 re-export를 포함'
        ],
        analysis: [
          'fileName 함수가 format 구분 없이 동일 디렉토리에 ESM/CJS를 생성 → 파일명 충돌로 숫자 접미사 추가됨',
          'barrel file에 export const version = "0.1.0"이 있어 Rollup이 "이 모듈은 re-export만 하는 게 아니라 자체 코드가 있다"고 판단 → side-effect로 취급',
          'Vanilla Extract의 /* empty css */ 주석도 Rollup의 moduleSideEffects: true 기본값에서 사이드이펙트로 인식'
        ],
        solution: '3가지 원인을 각각 수정하여 해결했습니다.',
        solutionCode: `// 1. 파일명 함수 수정 — .mjs/.cjs 확장자로 포맷 구분
fileName: (format, entryName) => {
  const ext = format === 'es' ? 'mjs' : 'cjs';
  return \`\${entryName}.\${ext}\`;
}

// 2. barrel file에서 version export 제거
// Before: export const version = '0.1.0';  ← side-effect 유발
// After: re-export만 남김

// 3. package.json에 sideEffects 명시
// Vite/webpack은 이 필드를 참고하여 CSS만 side-effect로 취급
{
  "sideEffects": ["./dist/core.css"]
}`,
        results: [
          'Button 단일 import: 45KB → 4.17KB (gzip 1.43KB) — 91% 감소',
          '전체 테스트 1,048개 통과, 데모 앱 빌드 정상 동작',
          'npm pack 검증: 384 files, 165KB 패키지로 정리'
        ],
        lessons: [
          'Tree-shaking은 설정만으로 되지 않는다. preserveModules를 켜도 파일명 충돌, barrel side-effect, CSS 주석 등 예상 밖의 요인이 있었다. "동작할 것이다"가 아닌 실측 검증이 필수.',
          'barrel file(index.ts)은 re-export 전용이어야 한다. 단 한 줄의 export const도 번들러가 전체 모듈을 side-effectful로 판단하게 만들 수 있다.',
          '라이브러리 제작자는 사용자의 빌드 환경을 시뮬레이션해야 한다. 라이브러리 자체 빌드가 성공해도, 사용자 프로젝트에서 tree-shaking이 되는지는 별개 문제.'
        ]
      }
    },
    {
      id: 'bottomsheet',
      title: '2. BottomSheet 드래그 인터랙션',
      image: '/projects/tds/bottomsheet.png',
      features: [
        'useRef 기반 드래그 상태 관리로 클로저 stale 참조 및 리스너 재등록 문제 해결',
        'document 레벨 이벤트 등록으로 시트 영역 밖 마우스 이탈 처리',
        'isClosingViaDragRef 플래그로 드래그/버튼 닫기 경로를 명시적으로 분리',
        'JS transition 기반 드래그 닫기로 CSS exit 애니메이션 충돌 제거'
      ],
      intent: '모바일 UX에서 BottomSheet는 드래그로 닫을 수 있어야 자연스럽습니다. 이 인터랙션은 React 렌더링 모델, 브라우저 이벤트 시스템, CSS와 JS 애니메이션 우선순위가 모두 교차하는 복잡한 문제였습니다. 하나의 버그를 고치면 다른 닫기 경로가 깨지는 연쇄 충돌을 반복하면서, 결국 닫기 경로를 플래그로 명시적으로 분리하는 구조적 해결책에 도달했습니다.',
      troubleShooting: {
        title: 'BottomSheet 드래그 구현 중 발생한 4가지 연쇄 버그',
        initialImpl: 'useState로 드래그 상태(startY, isDragging)를 관리하고, BottomSheet 요소에 mousedown/mousemove/mouseup 이벤트를 바인딩하는 방식으로 구현.',
        problem: [
          '이슈 1: 드래그가 동작하지 않음 — useState 변경마다 useEffect 재실행으로 이벤트 리스너가 초기화되고, 클로저 stale 참조로 isDragging이 항상 false',
          '이슈 2: 마우스가 시트 영역 밖으로 나가면 드래그가 해제되지 않고 시트가 마우스에 매달림 — mousemove/mouseup이 요소에만 바인딩',
          '이슈 3: 드래그로 닫을 때 시트가 원위치로 snap-back한 뒤 다시 내려가는 이중 애니메이션 — JS transition과 CSS exit 애니메이션이 충돌',
          '이슈 4: X 버튼으로 닫을 때 바텀시트가 화면에 그대로 남아 먹통 상태 발생 — 드래그 시 주입한 인라인 스타일이 CSS exit 애니메이션을 막아 언마운트 트리거가 실행되지 않음'
        ],
        analysis: [
          '이슈 1: useState로 드래그 좌표를 관리하면 매 변경마다 리렌더링 → useEffect 재실행 → 리스너 재등록. 재등록 시점에 새 클로저가 생성되어 이전 isDragging=true 값을 참조하지 못함',
          '이슈 2: mousemove/mouseup을 BottomSheet DOM에만 등록하면 마우스가 요소 밖으로 나갈 때 이벤트를 수신 못해 isDraggingRef가 true로 영구히 잔류',
          '이슈 3: 드래그 완료 시 JS로 translateY(100%) 이동 후 onClose() 호출 → open=false → 인라인 스타일 초기화 useEffect가 transform을 리셋(snap-back) → CSS slideDown 애니메이션이 translateY(0)에서 다시 실행됨. 단순 fix를 적용할 때마다 다른 닫기 경로(X버튼)가 깨지는 연쇄 충돌이 반복됨',
          '이슈 4: mousedown 핸들러가 시트 전체에 바인딩되어 X버튼 클릭 시에도 animation: none이 인라인으로 주입됨 → CSS exit 애니메이션 실행 불가 → onAnimationEnd가 발화하지 않아 shouldRender가 false로 전환되지 않음 → 투명한 시트 DOM이 잔류하여 화면 전체 클릭 차단'
        ],
        solution: '닫기 경로(드래그 vs 버튼)를 isClosingViaDragRef 플래그로 명시적으로 분리하여, 각 경로가 독립적인 언마운트 흐름을 갖도록 재설계했습니다.',
        solutionCode: `// 이슈 1 해결: useState → useRef로 드래그 상태 관리
// 리렌더링 없이 값을 추적하여 클로저 stale 참조와 리스너 재등록 문제를 동시에 해결
const startYRef = useRef(0);
const isDraggingRef = useRef(false);

// 이슈 2 해결: document 레벨 이벤트 등록
// 마우스가 어디서 놓이든 드래그 종료 감지 가능
const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return;
  // X버튼 등 인터랙티브 요소 클릭 시 드래그 시작 차단 (이슈 4 예방)
  if ((e.target as HTMLElement).closest('button, a, input')) return;
  startYRef.current = e.clientY;
  isDraggingRef.current = true;
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// 이슈 3, 4 핵심: 닫기 경로를 플래그로 분리
const isClosingViaDragRef = useRef(false);

// open=false 시 인라인 스타일 초기화 — 드래그 중일 때는 건드리지 않음
useEffect(() => {
  if (!open && sheetRef.current && !isClosingViaDragRef.current) {
    sheetRef.current.style.transform = '';
    sheetRef.current.style.transition = '';
    sheetRef.current.style.animation = '';
  }
}, [open]);

// 드래그 완료: JS transition으로 직접 닫고 CSS exit 애니메이션을 생략
const finishDrag = (diff: number) => {
  if (diff > THRESHOLD) {
    isClosingViaDragRef.current = true;
    sheet.style.transition = 'transform 0.2s ease-out';
    sheet.style.transform = 'translateY(100%)';

    sheet.addEventListener('transitionend', function handler() {
      sheet.removeEventListener('transitionend', handler);
      setShouldRender(false);   // CSS 애니메이션 틈 없이 즉시 언마운트
      onClose();
    });
  }
};

// 결과적인 닫기 경로 분리
// X버튼/ESC/백드롭: open=false → 인라인 스타일 초기화 → CSS exit 애니메이션 → onAnimationEnd → 언마운트
// 드래그:          JS transition → transitionend → 즉시 setShouldRender(false) + onClose()`,
        results: [
          '4번의 이슈를 거치며 드래그/버튼 두 닫기 경로가 완전히 독립적으로 동작',
          '애니메이션 연속성: 드래그 위치 → JS transition → 언마운트가 하나의 흐름으로 연결',
          '엣지 케이스 처리: 영역 밖 마우스, X버튼, 빠른 연타 등 모두 안정적으로 동작'
        ],
        lessons: [
          'useState vs useRef의 선택은 "리렌더링이 필요한가?"로 판단한다. 드래그 좌표처럼 매 프레임 변하지만 UI에 직접 반영하지 않는 값은 useRef가 맞다. useState를 쓰면 클로저 stale 참조와 이벤트 리스너 재등록 문제가 동시에 발생한다.',
          'JS 인라인 스타일과 CSS 클래스 애니메이션이 공존할 때는 "어떤 경로로 닫혔는가"를 명시적으로 추적해야 한다. 하나의 버그를 고치면 다른 경로가 깨지는 연쇄 충돌을 막으려면 경로별 분기가 필수다.',
          '이벤트 핸들러를 컴포넌트 전체에 바인딩하면 내부 버튼 클릭도 핸들러가 실행된다. closest()로 인터랙티브 요소를 걸러내거나, 핸들러를 드래그 핸들 영역에만 바인딩하는 것이 안전하다.'
        ]
      }
    },
    {
      id: 'component-api-design',
      title: '3. 컴포넌트 API 설계 전략',
      image: '/projects/TDS/API.png',
      features: [
        'Flat API: 단순 props로 기본 일반 케이스 처리 (variant, title, footer)',
        'Compound API: 서브컴포넌트 조합으로 복잡한 레이아웃 표현 (Card.Header, Card.Body)',
        'Hybrid 자동 감지: props 존재 여부로 Flat/Compound 모드를 자동 전환',
        'Render Prop 패턴: FormField가 접근성 인프라(id, aria 속성)를 자식에게 위임'
      ],
      intent: '디자인 시스템에서 가장 어려운 결정은 컴포넌트 API를 어떤 형태로 노출할 것인가입니다. Flat API는 쓰기 쉽지만 복잡한 레이아웃을 표현하기 어렵고, Compound API는 유연하지만 학습 비용이 높습니다. TDS는 Card, Modal, SideSheet, BottomSheet 4개 컴포넌트에 두 패턴을 혼합한 Hybrid API를 적용했습니다. 단순한 사용은 Flat으로, 복잡한 레이아웃은 Compound로 동일한 컴포넌트에서 처리할 수 있도록 설계했습니다.',
      troubleShooting: {
        title: 'Flat API만으로는 커버되지 않는 복잡한 레이아웃 요구사항',
        initialImpl: 'Card, Modal 등 복합 컴포넌트를 처음에는 Flat API(title, header, footer props)로만 설계. 단순한 경우는 문제없었으나, 이미지 오버레이·중첩 섹션·다중 액션 버튼처럼 레이아웃 자유도가 필요한 케이스에서 props 조합이 폭발적으로 증가했습니다.',
        problem: [
          'Flat API만으로는 커버 불가한 레이아웃이 발생 — 이미지 위에 텍스트 오버레이, 커스텀 헤더 배치 등',
          'props 추가로 대응하면 컴포넌트 인터페이스가 비대해지고 사용법이 복잡해짐',
          'Compound API만 사용하면 단순한 Card 하나에도 서브컴포넌트를 여러 개 나열해야 해 DX 저하'
        ],
        analysis: [
          '실제 사용 패턴을 분석하면 약 80%는 title/content/footer 정도의 단순 구조, 20%만 커스텀 레이아웃이 필요했음',
          'Flat과 Compound 중 하나를 선택하는 게 아니라, 두 모드를 하나의 컴포넌트에서 자동 감지하면 두 케이스를 모두 커버할 수 있다고 판단',
          'props 존재 여부로 렌더링 분기를 결정하는 isFlat 로직이 핵심: title/header/footer가 있으면 Flat 모드, 없으면 children을 그대로 받는 Compound 모드'
        ],
        solution: 'Hybrid API 패턴으로 설계를 전환. props 감지 로직과 Compound 서브컴포넌트를 병행 제공합니다.',
        solutionCode: `// Flat API: 80%의 간단한 사용 케이스
<Card title="프로필" footer={<Button>수정</Button>}>
  사용자 정보 내용
</Card>

// Compound API: 복잡한 레이아웃
<Card variant="elevated">
  <Card.Image src={coverImg}>
    <Card.ImageOverlay>Featured</Card.ImageOverlay>
  </Card.Image>
  <Card.Header>
    <Card.Title>커스텀 레이아웃</Card.Title>
  </Card.Header>
  <Card.Body padding="lg">복잡한 내용</Card.Body>
  <Card.Footer>여러 액션 버튼들</Card.Footer>
</Card>

// Card.tsx 내부 — isFlat 자동 감지 로직
const isFlat = !!(title || header || footer || image);
const content = isFlat ? (
  <>
    {image && <div>{/* 이미지 렌더링 */}</div>}
    {header && <header>{header}</header>}
    <div>{children}</div>
    {footer && <footer>{footer}</footer>}
  </>
) : children; // Compound 모드: children을 그대로 전달

// Render Prop 패턴 — FormField가 접근성 인프라를 자식에게 위임
<FormField label="이메일" error={hasError} errorMessage="올바르지 않습니다">
  {({ inputId, helperId, hasHelper, isError }) => (
    <input
      id={inputId}
      aria-describedby={hasHelper ? helperId : undefined}
      aria-invalid={isError}
    />
  )}
</FormField>`,
        results: [
          'Card, Modal, SideSheet, BottomSheet 4개 컴포넌트에 Hybrid API 적용',
          'FormField는 Render Prop으로 label-input 연결, 에러 메시지, 헬퍼 텍스트를 일관되게 처리',
          '단순 케이스와 복잡한 케이스 모두 하나의 컴포넌트로 커버 — 학습 비용을 낮추면서 유연성 확보'
        ],
        lessons: [
          '"Flat vs Compound" Hybrid 패턴은 props 감지로 두 모드를 자동 전환해 사용자가 익숙한 방식부터 시작하고 필요할 때 복잡한 조합으로 넘어갈 수 있게 한다.',
          '컴포넌트 API는 사용 패턴 분포를 먼저 분석해야 한다. 단순히 커스터마이징 자유도를 위해 Compound 전용으로 만들면 불필요한 학습 비용을 요구하게 된다.',
          'FormField 같은 인프라 컴포넌트는 UI를 직접 렌더링하지 않고 접근성 속성만 생성·위임하는 역할로 분리하면, 여러 컴포넌트(TextField, TextArea)가 일관된 접근성을 재사용할 수 있다.'
        ]
      }
    }
  ],

  githubUrl: 'https://github.com/maintaein/TDS_TaeinDesignSystem',
  demoUrl: 'https://tds-taein-design-system.vercel.app'
};