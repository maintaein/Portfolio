import { Project } from '@/types';

export const tds: Project = {
  title: 'TDS (Taein Design System)',
  subtitle: '프론트엔드 개발자 \n 김태인의 디자인 시스템',
  image: '/projects/TDS.webp',
  tags: ['React 19', 'TypeScript', 'Vanilla Extract', 'Vite', 'Vitest', 'pnpm Monorepo', 'TDD'],
  duration: '2025.12 - 2026.07',
  phases: [
    { label: '1차 MVP', period: '2025.12 - 2026.07' },
    { label: '고도화', period: '2026.08 - 현재' },
  ],

  role: '1인 설계 및 개발',
  teamSize: '1명 (개인 프로젝트)',

  motivation: '라이브러리 설계자의 입장과 개발자의 입장을 모두 경험했던 기회. shadcn이나 MUI와 같은 라이브러리를 사용하다 보니 컴포넌트들이 어떤 코드로 작동하는지 모른 채 쓰고 있다는 불안감이 있었습니다. 사실 디자인 시스템이 뭘 의미하는지도 잘 모른 채로 프로젝트를 진행해왔었습니다.\n\n 저는 이럴 때 직접 만들어보면서 학습하는게 부족한 점들을 채우는 좋은 방법이었습니다. 동시에, 이후 개인 프로젝트에서도 TDS를 활용해보면 라이브러리 설계자와 개발자 두 경험을 함께 얻을 수 있을 것 같아 이 프로젝트를 시작했습니다.',

  implementations: [
    {
      category: '데모 문서 앱 (packages/demo)',
      items: [
        '라이브 코드 에디터, Props 테이블, 접근성 가이드로 컴포넌트 사용법 확인',
        '문서 앱 자체에 TDS 컴포넌트를 적용해 실제 사용 환경에서 검증',
      ],
      intent: '컴포넌트의 사용법과 접근성, props를 사람이 확인하기 편하도록 만들었습니다. 또한 저같은 주니어 개발자들에게는 디자인 시스템이란 이런 거구나 하고 함께 배워가는 기회가 되길 의도했습니다.',
      video:'/projects/TDS/demoApp.mp4'
    },
    {
      category: 'UI컴포넌트',
      items: [
        '버튼, 입력, 표시, 피드백, 오버레이, 레이아웃 등 제품 개발에 필요한 UI 컴포넌트 제공',
        'FormField를 통해 label/id/ARIA를 자동으로 연결하고, Modal·Popover 등에 포커스 트랩과 닫기 동작 적용',
      ],
      intent: 'UI컴포넌트를 일관된 인터페이스와 접근성 기준으로 사용할 수 있도록 구성했습니다.',
      video:'/projects/TDS/Components.mp4'
    },
    {
      category: '디자인 토큰 시스템',
      items: [
        'Theme Contract 기반 색상·타이포그래피·간격·그림자·애니메이션 토큰과 8pt Grid System 제공',
        'TypeScript 자동완성으로 토큰 사용을 돕고, 존재하지 않는 토큰 참조를 컴파일 타임에 차단',
      ],
      intent: '디자인 기준을 토큰으로 관리해 컴포넌트 간 시각적 일관성을 유지하고 확장도 안전하게 할 수 있도록 설계했습니다.',
      video:'/projects/TDS/designTokens.mp4'
    },
    {
      category: '빌드·배포 인프라',
      items: [
        '컴포넌트별 모듈 빌드로 필요한 컴포넌트만 소비자 번들에 포함되도록 구성',
        '모노레포에서 라이브러리와 데모 앱을 함께 개발하고, Vercel 자동 배포와 llms.txt 문서 제공',
      ],
      intent: '필요한 컴포넌트만 가볍게 사용할 수 있고, 라이브러리와 문서 앱을 안정적으로 개발·배포할 수 있도록 구성했습니다.',
      video:'/projects/TDS/treeShaking.mp4'
    },
  ],

  reviews: [
    {
      title: 'Button 하나만 import해도 컴포넌트 전체가 번들에 포함된 현상',
      problem: 'UI 컴포넌트 라이브러리는 필요한 컴포넌트만 가져다 쓸 수 있어야 한다고 생각했습니다. 그런데 npm 패키지를 만들어 실제로 가져다 쓰는 상황을 재현해보니, Button 하나만 import해도 컴포넌트 전체가 그대로 번들에 실렸습니다.',
      analysis: [
        '**진단: 번들러에게 "지워도 안전하다"는 근거가 없었다**: Button 하나만 쓰는 소비자 예제를 만들고 `npm pack`으로 실제 배포 패키지를 설치해 재보니, 30개 중 21개 컴포넌트가 들어간 45KB였습니다. 같은 패키지에서 컴포넌트 파일을 직접 경로로 import하면 4.3KB였습니다. 두 수치의 차이로 문제를 barrel 진입점으로 좁혔고, 원인은 두 가지가 겹쳐 있었습니다. 하나는 barrel에 남아 있던 `export const version = \'0.1.0\'`이 빌드 결과에 값 할당 코드로 남은 것이고, 다른 하나는 Vanilla Extract가 생성한 `.css.mjs` 모듈들이었습니다. Rollup의 `moduleSideEffects` 기본값은 `true`라서, 번들러는 이 모듈들을 **지우면 무슨 일이 생길지 알 수 없는 코드**로 보고 barrel이 끌어온 것을 전부 남겨두고 있었습니다. 라이브러리가 번들러에게 제거해도 안전하다는 근거를 주지 못한 셈입니다.',
        '**선택지 1: 컴포넌트별 import 경로를 공개한다**: `@scope/core/Button`처럼 진입점을 쪼개 공개하면 번들러의 판단에 기대지 않고 import 경로만으로 필요한 것만 가져올 수 있습니다. MUI나 lodash가 쓰는 방식입니다. 다만 단일 진입점에서 named import로 가져오는 익숙한 사용법이 깨지고, 컴포넌트가 늘 때마다 `exports` 맵을 같이 관리해야 합니다. 무엇보다 이건 원인을 고치는 게 아니라 우회하는 쪽이라 기본 import 경로는 여전히 45KB로 남습니다. 나중에 보완으로 얹을 수는 있다고 보고 현재 대응에서는 제외했습니다.',
        '**선택지 2: 패키지 전체를 side effect 없음으로 선언한다**: `sideEffects: false` 한 줄이면 번들러는 모든 모듈을 지워도 되는 것으로 보고 가장 공격적으로 tree-shaking합니다. 하지만 Vanilla Extract가 뽑아낸 `core.css`까지 지워도 되는 대상이 되어, 소비자가 CSS를 직접 import하지 않으면 스타일이 통째로 사라집니다. 빌드는 성공하고 화면만 깨지는 종류의 실패라 소비자가 원인을 찾기 어렵습니다. 몇 KB를 더 깎자고 이런 실패 모드를 만들 이유는 없다고 판단해 선택하지 않았습니다.',
        '**선택지 3: 모듈 경계를 살리고 side effect 범위를 정확히 좁힌다 (선택)**: barrel에는 순수 re-export만 남기고, `preserveModules`로 컴포넌트별 파일 구조를 유지하고, side effect는 `core.css` 하나로만 한정해 선언합니다. 그러면 번들러가 "CSS는 남기고 안 쓰는 컴포넌트 JS는 지운다"를 파일 단위로 판단할 수 있습니다. 대신 dist 파일 수가 140개를 넘어 빌드 산출물을 눈으로 훑기 어려워집니다. 소비자에게 추가 설정도 낯선 import 경로도 요구하지 않으면서 원인 두 가지를 모두 없애는 방향이라 이쪽을 택했습니다.',
      ],
      action: [
        'Button 하나만 import하는 소비자 예제를 만들고 `npm pack`으로 배포 패키지를 설치해 측정했습니다. 로컬 소스가 아니라 배포본 기준이어야 소비자가 겪는 상황과 같아집니다.',
        '`preserveModules`는 이미 켜져 있었지만 출력이 `index.esm2.js`처럼 dist 루트에 평평하게 쏟아지고 있었습니다. `fileName`이 엔트리에만 적용되고 나머지 청크는 Vite 자동 생성 이름을 쓰던 탓이라, ESM은 `.mjs`·CJS는 `.cjs`로 나눠 디렉토리 구조가 실제로 보존되게 고쳤습니다.',
        '파일명이 바뀐 만큼 `main`·`module`·`exports` 경로를 함께 맞춰 소비자 진입점 해석이 깨지지 않도록 했습니다.',
        'barrel(`src/index.ts`)에서 `export const version`을 제거해 re-export만 남겼습니다.',
        '`sideEffects: ["./dist/core.css"]`로 side effect를 CSS 한 파일에 한정해, JS 컴포넌트 모듈은 tree-shaking 대상이 되도록 했습니다.',
      ],
      resultHeadline: 'Button 하나만 import한 번들 45KB → 4.17KB',
      result: [
        { label: '번들 크기', before: '45KB — Button 하나만 import했는데 30개 중 21개 컴포넌트 포함', after: '4.17KB (gzip 1.43KB) — Button과 내부 의존인 LoadingSpinner만 포함', delta: '-91%', measuredBy: 'npm pack 배포 패키지 + Vite 프로덕션 빌드' },
      ],
      tradeOffs: [
        'side effect 판단을 `package.json`의 `sideEffects` 필드에 맡겼기 때문에, 이 필드를 읽는 번들러에서만 효과가 있습니다. Vite와 webpack은 참조하지만 이 필드를 보지 않는 설정에서는 문제가 해결되지 않았을 것입니다. Vite·webpack이 주요 환경이긴 하나, 추후에 어떻게 해야 모든 번들러에서 유효한 설정을 만들 수 있을지에 대한 추가 설계가 필요합니다.',
        '학습을 위해 만들었다고는 하나, 직접 사용해보니 기존 오픈소스 라이브러리들에 비해 사용 가치가 크지 않다고 느꼈습니다. 이에 현재 GSAP, three.js를 도입하여 각 컴포넌트마다 독창적인 애니메이션 효과를 추가하는 고도화 진행 중에 있습니다. 이번 트러블 슈팅과 관련된 트레이드 오프는 아니지만, 투자한 시간에 비해 가치가 크지 않은 제품을 만드는 것은 비용이 있었다고 생각하여 작성했습니다.'
      ],
    },
  ],
  githubUrl: 'https://github.com/maintaein/TDS_TaeinDesignSystem',
};
