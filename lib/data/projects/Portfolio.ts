import { Project } from '@/types';

export const portfolio: Project = {
  title: 'Portfolio',
  subtitle: 'Atomic Design과 타입 안정성으로 구축한 개인 포트폴리오 웹사이트',
  description: 'Next.js 15 + TypeScript 기반 개인 포트폴리오 웹사이트',
  longDescription: '최신 웹 기술과 디자인 시스템을 적용하여 완성도 높은 사용자 경험을 제공하는 개인 포트폴리오 웹사이트입니다. **Atomic Design** 패턴으로 체계적인 컴포넌트 구조를 구축하고, **TypeScript**로 타입 안정성을 확보했습니다.',
  image: '/projects/Portfolio.webp',
  imageAspect: 'landscape',
  tags: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS 4', 'Headless UI', 'Atomic Design'],
  duration: '2025.08 - 현재',
  role: '웹 프론트엔드 개발',
  teamSize: '1명 (개인 프로젝트)',

  implementations: [
    {
      text: '**Atomic Design** 아키텍처: **26개 컴포넌트**를 3단계로 구조화 (Atoms 13개, Blocks 7개, Sections 6개)',
    },
    {
      text: '**디자인 시스템** 구축: Tailwind CSS 4의 `@theme` 문법으로 색상·타이포그래피·간격 토큰을 CSS 변수로 관리, TypeScript 타입과 연동',
    },
    {
      text: '**Custom Hooks** 개발: `useModal`, `useScroll`, `useIntersection` 3개 훅으로 로직 재사용성 극대화',
    },
    {
      text: '**SSR-safe Modal** 시스템: `createPortal` + `mounted state` 패턴으로 Next.js SSR 환경에서 Hydration 에러 없이 동작, body 스크롤 잠금·ESC·backdrop 클릭 닫기 지원',
    },
    {
      text: '**성능 최적화**: `requestAnimationFrame` 기반 스크롤 throttle, 동적 임포트, Next.js Image 컴포넌트 lazy loading',
    },
    {
      text: '**접근성** 강화: ARIA 레이블, 키보드 네비게이션(ESC/Tab), 시맨틱 HTML로 웹 접근성 준수',
    }
  ],

  responsibilities: [
    '웹 프론트엔드 개발'
  ],

  techReasons: [
    {
      name: 'Next.js 15',
      reasons: [
        '**App Router**로 최신 서버 컴포넌트 아키텍처 적용 가능, **SEO 최적화**와 빠른 초기 로딩 속도 확보',
        '**Turbopack**으로 개발 속도 대폭 향상, Image/Font 최적화 기능으로 성능 개선',
        '**React 19**의 최신 기능 지원으로 미래 지향적 프로젝트 구축 가능'
      ]
    },
    {
      name: 'TypeScript',
      reasons: [
        '**26개 컴포넌트**와 복잡한 데이터 구조(`Project`, `Skill`, `Experience` 등)에서 타입 안정성 확보',
        '**Props 인터페이스**로 컴포넌트 사용법 명확화, IDE 자동완성으로 개발 생산성 향상',
        '**중앙 타입 관리**로 전체 프로젝트의 일관성 유지 및 리팩토링 용이'
      ]
    },
    {
      name: 'Tailwind CSS 4',
      reasons: [
        '최신 `@theme` 문법으로 **디자인 토큰을 CSS 변수로 관리**, 일관된 디자인 시스템 구축',
        '**Utility-first** 방식으로 빠른 프로토타이핑 가능, 프로덕션 빌드 시 미사용 스타일 자동 제거',
        '**반응형 디자인** 구현이 간결하고 직관적 (sm/md/lg/xl 브레이크포인트)'
      ]
    },
    {
      name: 'Framer Motion',
      reasons: [
        'CSS transition만으로 표현하기 어려운 **진입 애니메이션(stagger, whileInView)**을 선언적으로 구현',
        '`AnimatePresence`로 컴포넌트 언마운트 시 **exit 애니메이션** 처리, 모달 expand 효과 구현',
        '`layoutId`, `scaleX`/`scaleY` 기반으로 **카드 → 모달 확장 애니메이션** 구현'
      ]
    },
    {
      name: 'Atomic Design',
      reasons: [
        '컴포넌트를 **Atoms → Blocks → Sections**로 계층화하여 의존 방향을 단방향으로 고정',
        '**13개 Atoms**(Button, Badge, Modal, Icon 등)가 상위 컴포넌트 전체에서 재사용되어 코드 중복 최소화',
        '**단일 책임 원칙** 준수로 각 컴포넌트의 역할이 명확하여 수정 영향 범위가 제한됨'
      ]
    }
  ],

  reviews: [
    {
      id: 'ssr-modal',
      title: '1. SSR-safe Modal 시스템',
      features: [
        '`createPortal`로 모달을 body 직속으로 렌더링하여 **z-index 문제 해결**',
        '**ESC 키**와 **backdrop 클릭**으로 모달 닫기 지원',
        '모달 오픈 시 **body 스크롤 잠금**으로 사용자 경험 개선',
        '3가지 크기 variant (small/medium/large) 지원',
        '부드러운 **fade-in/fade-out 애니메이션** 적용'
      ],
      intent: '**Next.js SSR** 환경에서 안전하게 동작하는 Modal 컴포넌트를 구현하고자 했습니다. Portal을 사용하면 z-index 관리가 용이하지만, 서버 렌더링 시 `window` 객체가 없어 에러가 발생하는 문제가 있었습니다. 이를 해결하여 모든 환경에서 안정적으로 동작하는 모달을 만들고, 사용자 경험을 해치지 않는 **키보드 접근성**과 **스크롤 제어**를 구현하는 것이 목표였습니다.',
      troubleShooting: {
        title: 'Next.js SSR 환경에서 Portal Hydration Mismatch + body scroll 복원 문제',
        initialImpl: 'Modal 컴포넌트를 `createPortal`로 `document.body`에 직접 렌더링하도록 구현했습니다. **z-index 충돌 없이 최상위에 모달을 올리기 위한 일반적인 방법**이었고, 모달이 열릴 때 body scroll을 잠가 배경 스크롤을 막는 처리도 추가했습니다.',
        problem: [
          '개발 서버 실행 시 **"Hydration failed because the server rendered HTML didn\'t match the client"** 에러 발생',
          '모달을 닫은 직후 **페이지가 스크롤되지 않는 현상** — body scroll lock이 해제되지 않고 남아있음',
        ],
        analysis: [
          '**Hydration mismatch**: `createPortal`은 `document.body`에 접근하는데, 서버 렌더링 시에는 `document`가 존재하지 않아 서버에서는 `null`을 반환하고 클라이언트에서는 Portal을 생성하는 불일치 발생',
          '`typeof window !== \'undefined\'` 체크를 시도했으나 hydration 에러가 여전히 발생. __React의 hydration은 서버 HTML과 클라이언트 첫 렌더를 비교하는데, `typeof window` 체크는 런타임 분기일 뿐 클라이언트 첫 렌더 결과를 바꾸지 않아 불일치가 그대로 남음__',
          '**scroll lock 미해제**: `document.body.style.overflow = ""` 로 단순 초기화하면 원래 overflow 값이 `""`가 아닌 경우 복원이 아닌 덮어쓰기가 됨. 또한 `isOpen`이 false로 바뀔 때 cleanup이 실행되지 않아 모달을 닫아도 lock이 유지되는 케이스 발생',
        ],
        solution: [
          '**`mounted` state 패턴**으로 Hydration 해결 — `useEffect`로 마운트 이후에만 `mounted=true`로 전환. `useEffect`는 서버에서 실행되지 않으므로 서버/클라이언트 첫 렌더 모두 `null`을 반환해 불일치가 없어짐.',
          '**body scroll 복원**: overflow 변경 전 기존 값을 `originalStyle` 변수에 저장하고, `useEffect` cleanup에서 해당 값으로 복원. `isOpen`이 false로 바뀌면 dependency 변경으로 __cleanup이 자동 실행되어 scroll lock이 해제__됨.',
        ],
        solutionCode: `export default function Modal({ isOpen, onClose, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  // SSR 대응: 클라이언트에서만 Portal 렌더링
  // typeof window 체크로는 hydration mismatch가 해결되지 않음.
  // useEffect는 서버에서 실행되지 않으므로 서버/클라이언트 첫 렌더 모두 null을 반환.
  useEffect(() => {
    setMounted(true);
  }, []);

  // body scroll 잠금 — 기존 overflow 값을 저장했다가 cleanup 시 복원
  // overflow = '' 로 단순 초기화하면 원래 값이 아닐 때 복원이 아닌 덮어쓰기가 됨
  // isOpen이 false로 바뀌면 cleanup이 자동 실행되어 lock이 해제됨
  useEffect(() => {
    if (isOpen) {
      const originalStyle = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-grey-opacity-800"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        className={cn('relative bg-white rounded-xl shadow-xl w-full', sizeStyles[size])}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}`,
        results: [
          '**Hydration 에러 해결**: 서버와 클라이언트 첫 렌더 모두 `null`을 반환하여 불일치 없음',
          '**scroll lock 정확히 해제**: 모달 닫기 시 cleanup으로 overflow가 원래 값으로 복원됨',
          '**4가지 size variant**(small/medium/large/full), backdrop 클릭/ESC 닫기, 커스텀 headerAction 슬롯 지원'
        ],
        lessons: [
          '__`typeof window` 체크는 SSR hydration 에러를 막지 못한다.__ React hydration은 서버 HTML과 클라이언트 첫 렌더를 비교하므로, 클라이언트 첫 렌더도 서버와 동일한 결과를 반환해야 한다. **`mounted` state + `useEffect` 패턴**이 이를 보장하는 올바른 방법이다.',
          '`body.style.overflow = ""`로 단순 초기화하지 말고 **열기 전 값을 저장해 복원**해야 한다. 원래 값이 `""`가 아닌 경우 의도치 않게 덮어쓰게 된다.',
          '__`useEffect`의 cleanup 함수는 컴포넌트 언마운트뿐 아니라 dependency 변경 시에도 실행된다.__ `isOpen=false`로 전환될 때 cleanup이 자동 실행되므로, scroll 복원 로직을 별도로 `onClose`에 넣을 필요가 없다.',
        ]
      }
    },
    {
      id: 'component-reusability',
      title: '2. 컴포넌트와 상태 관리 아키텍처',
      features: [
        '재사용 가능한 **Atoms 컴포넌트**: Button (4 variants × 5 colors), Badge (9 colors), Modal (Portal 기반, 4 sizes), SegmentedControl (범용 탭)',
        '범용 **Custom Hooks**: `useIntersection` (모든 섹션의 스크롤 애니메이션), `useScroll` (활성 섹션 감지), `useModal` (모달 상태 관리)',
        '**컴포넌트 합성 패턴**: ProjectCard + ProjectModal 조합으로 복잡한 UI 구성',
        '**`freezeOnceVisible` 패턴**: 한 번 화면에 나타난 요소는 Observer를 해제하여 재실행 방지 및 메모리 효율 확보',
        '**일관된 UX**: hook 옵션(`threshold`, `rootMargin`)을 컴포넌트별로 조정하면서도 동일한 인터페이스 유지'
      ],
      intent: '포트폴리오 전체에서 반복되는 UI 패턴과 로직을 **재사용 가능한 컴포넌트와 커스텀 훅으로 추상화**하여 코드 중복을 최소화하고 유지보수성을 극대화하고자 했습니다. 특히 AboutSection의 3가지 애니메이션(TechParticleStorm, EmpathyRadar, CollaborationMesh) 구현 시, 각 컴포넌트가 독립적으로 스크롤 감지를 해야 했는데, 매번 `IntersectionObserver`를 직접 구현하면 코드 중복뿐만 아니라 `freezeOnceVisible` 로직 구현과 SSR 안전성 처리를 세 번 반복해야 했습니다. 이를 hook으로 추출하는 과정에서 단순히 코드를 줄이는 것을 넘어, **Observer cleanup 타이밍과 frozen 상태 처리 방식을 올바르게 설계하는 것이 핵심 과제**였습니다.',
      troubleShooting: {
        title: 'freezeOnceVisible 구현 — 애니메이션이 스크롤 아웃 후 재진입 시 재실행되는 문제',
        initialImpl: 'AboutSection의 3가지 애니메이션 컴포넌트에 각각 `IntersectionObserver`를 직접 구현했습니다. 각 컴포넌트에서 `useRef`로 DOM을 참조하고, `useEffect` 안에서 Observer를 생성·등록·cleanup하는 구조였습니다.',
        problem: [
          '사용자가 애니메이션 섹션을 지나쳤다가 다시 스크롤해 올라오면 **애니메이션이 처음부터 재실행**됨 — 포트폴리오 특성상 한 번만 실행되어야 자연스러운 인상을 줌',
          '`hasIntersected` 상태를 `useState`로 관리하면 `true`로 전환 시 **리렌더링이 발생**하고, `useEffect` dependency에 포함되어 **Observer가 재등록되는 불필요한 사이클** 발생',
          '각 컴포넌트마다 동일한 Observer 초기화·cleanup·freeze 로직(**약 30줄**)이 반복되어, threshold 조정 같은 사소한 변경도 모든 파일을 수정해야 함'
        ],
        analysis: [
          '`freezeOnceVisible`의 핵심은 __한 번 `isIntersecting=true`가 되면 이후 Observer 콜백을 실행할 필요가 없다는 것__. 단순히 `isIntersecting` 값을 고정하는 것만으로는 부족하고, **Observer 자체를 해제해야 불필요한 콜백 호출이 없어짐**.',
          '초기 구현에서 `hasIntersected`를 `useState`로 관리했을 때의 문제: `isIntersecting=true` → `hasIntersected=true` → 리렌더링 → `useEffect` 재실행 → **Observer 재등록 사이클**. 이 사이클은 freeze가 된 이후에도 threshold 등 다른 dependency 변경 시마다 반복될 수 있음.',
          '`frozen = freezeOnceVisible && isIntersecting`을 `useEffect` dependency에 포함시키면, **`frozen`이 `true`가 되는 순간 `useEffect`가 재실행**되고 `if (!element || frozen) return`이 즉시 반환하여 Observer가 재등록되지 않음. 이전 `useEffect`의 cleanup으로 기존 Observer가 `disconnect`되므로, frozen 상태에서는 **Observer가 아예 존재하지 않게 됨**.'
        ],
        solution: [
          '`frozen = freezeOnceVisible && isIntersecting`을 `useEffect` dependency에 추가. frozen이 `true`가 되는 순간 useEffect가 재실행되고, 함수 최상단에서 frozen 체크로 즉시 반환하여 **Observer가 재등록되지 않음**. 이전 useEffect cleanup이 기존 Observer를 `disconnect`하므로 __freeze 이후에는 Observer가 완전히 제거됨__.',
          '**제네릭 타입 파라미터** 도입: `useIntersection<T extends HTMLElement>()`로 ref 타입을 호출부에서 지정. `HTMLDivElement`, `HTMLSectionElement` 등 요소 타입에 따라 ref를 정확하게 추론하여 잘못된 요소에 ref를 붙이면 **컴파일 에러로 조기 발견**.',
          '**SSR 안전성**은 별도 처리 없이 자동 확보: `IntersectionObserver` 생성을 `useEffect` 내부에서만 수행하므로, 서버에서는 `useEffect`가 실행되지 않아 `document` 접근 에러가 발생하지 않음.',
        ],
        solutionCode: `// hooks/useIntersection.ts — 실제 구현
export function useIntersection<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionOptions = {}
): UseIntersectionReturn<T> {
  const { threshold = 0.1, root = null, rootMargin = '0px', freezeOnceVisible = false } = options;
  const ref = useRef<T>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // freezeOnceVisible: 한 번 교차하면 Observer를 해제하여 재실행 방지
  const frozen = freezeOnceVisible && isIntersecting;

  useEffect(() => {
    const element = ref.current;
    if (!element || frozen) return; // 이미 freeze된 경우 Observer 재등록 안 함

    const observer = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect(); // 언마운트 시 자동 cleanup
  }, [threshold, root, rootMargin, frozen]);

  return { ref, isIntersecting, entry };
}

// 적용 사례 1: TechParticleStorm (AboutSection)
export default function TechParticleStorm() {
  const { ref, isIntersecting } = useIntersection<HTMLDivElement>({
    threshold: 0.2,
    freezeOnceVisible: true,
  });

  return (
    <div ref={ref} className="relative w-full h-full">
      {techIcons.map((icon, index) => (
        <div
          key={icon.name}
          className={isIntersecting
            ? 'animate-[particle-fly-in_1.2s_cubic-bezier(0.34,1.56,0.64,1)_forwards]'
            : 'opacity-0'}
          style={{ animationDelay: \`\${index * 0.05}s\` }}
        />
      ))}
    </div>
  );
}

// 적용 사례 2: EmpathyRadar — 같은 hook, 다른 threshold
export default function EmpathyRadar() {
  const { ref, isIntersecting } = useIntersection<HTMLDivElement>({
    threshold: 0.3,
    freezeOnceVisible: true,
  });
  // ...
}`,
        results: [
          '**Observer 재실행 완전 차단**: `frozen` 이후 Observer가 `disconnect`되어 콜백이 호출되지 않고, 리렌더링도 발생하지 않음',
          '**코드 중복 제거**: 각 컴포넌트의 **30줄 Observer 로직이 `useIntersection` 호출 3줄로 대체**, threshold 조정 같은 변경은 hook 옵션으로만 처리',
          '**SSR 에러 없음**: `useEffect` 내부에서만 `IntersectionObserver`를 생성하므로 서버 렌더링 시 별도 guard 불필요'
        ],
        lessons: [
          '`freezeOnceVisible` 구현에서 핵심은 __"상태를 고정"하는 것이 아니라 "Observer를 제거"하는 것__이다. `frozen`을 `useEffect` dependency에 넣으면 freeze 시점에 cleanup이 자동 실행되어 Observer가 사라지고, 이후 어떤 스크롤 이벤트가 발생해도 콜백이 호출되지 않는다.',
          '`useState`로 Observer 관련 상태를 관리하면 **값이 바뀔 때마다 리렌더링 → `useEffect` 재실행 → Observer 재등록 사이클**이 발생한다. 리렌더링이 불필요한 좌표·플래그 값은 `useRef`로 관리하고, UI에 반영해야 하는 `isIntersecting` 같은 값만 `useState`로 관리하는 것이 맞다.',
          '**제네릭 타입 파라미터**는 hook의 유연성과 타입 안전성을 동시에 확보한다. `useIntersection<HTMLSectionElement>()`처럼 호출부에서 타입을 지정하면 잘못된 요소 타입에 ref를 붙이는 실수를 **컴파일 타임에 잡을 수 있다**.'
        ]
      }
    },
    {
      id: 'custom-hooks',
      title: '3. Custom Hooks 개발',
      features: [
        '`useModal`: 모달 상태 관리 (open/close/toggle), `useCallback`으로 메모이제이션',
        '`useScroll`: 현재 활성 섹션 감지, 스크롤 진행률 계산, **throttle**로 성능 최적화',
        '`useIntersection`: Intersection Observer 래핑, **freeze-once-visible** 옵션 지원'
      ],
      intent: '반복되는 로직을 **Custom Hooks**로 분리하여 컴포넌트 코드를 간결하게 유지하고 재사용성을 높이고자 했습니다. 특히 Navigation의 스크롤 감지 로직이 복잡했기 때문에 `useScroll` hook으로 추출하여 다른 컴포넌트에서도 쉽게 사용할 수 있도록 했습니다.'
    },
    {
      id: 'performance',
      title: '4. 성능 최적화',
      features: [
        '**동적 임포트**: Modal 컴포넌트를 `next/dynamic`으로 초기 번들에서 분리, 필요 시점에 로드',
        '**rAF 기반 스크롤 throttle**: `useScroll` hook 내부에서 `requestAnimationFrame` + 커스텀 interval로 스크롤 이벤트 처리 빈도 제어',
        '**Image 최적화**: Next.js Image 컴포넌트로 WebP 자동 변환, lazy loading, 뷰포트 기반 sizes 최적화',
        '**Font 최적화**: Pretendard 가변 폰트를 로컬에서 호스팅하여 외부 네트워크 요청 제거 및 FOUT 최소화'
      ],
      intent: '사용자에게 **빠른 초기 로딩**과 **부드러운 스크롤 인터랙션**을 제공하기 위해 번들 분리, 스크롤 이벤트 최적화, 이미지/폰트 최적화를 적용했습니다. 특히 스크롤 이벤트는 매 프레임마다 수십 번 발생하므로 `requestAnimationFrame`과 커스텀 throttle interval을 조합해 불필요한 상태 업데이트를 줄였습니다.'
    }
  ],

  githubUrl: 'https://github.com/maintaein/portfolio'
};
