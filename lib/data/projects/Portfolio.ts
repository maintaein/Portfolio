import { Project } from '@/types';

export const portfolio: Project = {
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
          '클��이언트: Modal 컴포넌트가 Portal을 생성하여 실제 DOM에 렌더링',
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
          '각 애니메이션 컴포넌트가 독립적으로 ��크롤 위치를 추적해야 하지만, 로직은 동일',
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
};
