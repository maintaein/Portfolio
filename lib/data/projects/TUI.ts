import { Project } from '@/types';

export const tui: Project = {
  title: 'TUI (Taein UI)',
  subtitle: '개발자 \n 김태인의 UI컴포넌트 라이브러리',
  image: '/projects/TUI.webp',
  tags: ['React 19', 'TypeScript', 'Vanilla Extract', 'Vite', 'Vitest', 'pnpm Monorepo', 'TDD'],
  duration: '2025.12 - 2026.07',
  phases: [
    { label: '1차 MVP', period: '2025.12 - 2026.06' },
    { label: '고도화', period: '2026.09 - 현재' }
  ],

  role: '1인 설계 및 개발',
  teamSize: '1명 (개인 프로젝트)',

  motivation: '재미있고 인터랙티브한 효과를 추구한 React UI 컴포넌트 라이브러리. \n\n 웹사이트를 방문하면 항상 특별한 애니메이션이 있는지, 인터랙션 효과는 어떻게 만들었는지에 관심이 많았습니다. 이에 제 느낌을 담은 UI컴포넌트를 하나하나 설계하여 라이브러리로 만들었습니다. 사용자가 별다른 레퍼런스나 고민 없이도 제 라이브러리 하나면 독특한 모션과 인터랙션이 담긴 웹사이트를 만들 수 있도록 하고자 했습니다.',

  implementations: [
    {
      category: 'UI컴포넌트',
      items: [
        '제품 개발에 필요한 UI 컴포넌트 제공, 주된 모션들은 GSAP으로 구현됨.',
        '단, 오버엔지니어링을 방지하기 위해 CSS로 되는 건 CSS로 두고, CSS가 못 하는 것에만 GSAP을 사용',
      ],
      intent: '평소 UI에 대해 탐구하며 좋다고 느낀 모션과 인터랙션을 컴포넌트로 구현했습니다. ',
      video:'/projects/TUI/Components.mp4'
    },
    {
      category: '문서 웹사이트',
      items: [
        'TUI 컴포넌트의 사용법과 접근성을 확인할 수 있는 문서 웹사이트',
        'AI활용한 개발이 수월하도록 llms.txt 문서 제공',
      ],
      intent: '컴포넌트의 사용법과 접근성, props를 사람과 AI가 동시에 확인하기 편하도록 만들고자 했습니다.',
      video:'/projects/TUI/demoApp.mp4'
    },
    {
      category: '디자인 토큰 시스템',
      items: [
        'Theme Contract 기반 디자인 토큰 제공',
        'TypeScript 자동완성으로 토큰 사용을 돕고, 존재하지 않는 토큰 참조를 컴파일 타임에 차단',
      ],
      intent: '디자인 기준을 토큰으로 관리해 컴포넌트 간 시각적 일관성을 유지하고 확장도 안전하게 할 수 있도록 설계했습니다.',
      video:'/projects/TUI/designTokens.mp4'
    },
    {
      category: '빌드·배포 인프라',
      items: [
        '컴포넌트별 모듈 빌드로 필요한 컴포넌트만 소비자 번들에 포함되도록 구성',
        '모노레포에서 라이브러리와 문서 웹을 함께 관리하고, Vite로 빌드·테스트·배포',
      ],
      intent: '필요한 컴포넌트만 가볍게 사용할 수 있고, 라이브러리와 문서 웹을 안정적으로 개발·배포할 수 있도록 구성했습니다.',
      video:'/projects/TUI/treeShaking.mp4'
    },
  ],

  reviews: [
    {
      title: 'Button 하나만 import해도 컴포넌트 전체가 번들에 포함된 현상',
      problem: 'UI 컴포넌트 라이브러리는 필요한 컴포넌트만 가져다 쓸 수 있어야 한다고 생각했습니다. 그런데 npm 패키지를 만들어 실제로 가져다 쓰는 상황을 재현해보니, Button 하나만 import해도 컴포넌트 전체가 그대로 번들에 실렸습니다.',
      analysis: [
        '**진단: 번들러에게 "지워도 안전하다"는 근거가 없었다**: Button 하나만 쓰는 예제를 `npm pack`으로 설치해 재보니 45KB, 30개 중 21개가 딸려 왔습니다. 컴포넌트 파일을 직접 경로로 가져오면 4.3KB였습니다. 범인은 barrel 진입점이었고, 원인은 둘이었습니다. barrel에 남은 `export const version = \'0.1.0\'`, 그리고 Vanilla Extract가 만든 `.css.mjs` 모듈들입니다. Rollup은 `moduleSideEffects` 기본값이 `true`라 이 둘을 **지우면 무슨 일이 생길지 알 수 없는 코드**로 보고, barrel이 끌어온 것을 전부 남겼습니다.',
        '**선택지 1: 컴포넌트별 import 경로를 공개한다**: `@scope/core/Button`처럼 진입점을 쪼개는 MUI · lodash 방식입니다. 번들러의 판단에 기대지 않아도 되지만, 익숙한 named import가 깨지고 컴포넌트가 늘 때마다 `exports` 맵을 손봐야 합니다. 원인을 고치는 게 아니라 피해 가는 쪽이라 기본 경로는 여전히 45KB입니다.',
        '**선택지 2: 패키지 전체를 side effect 없음으로 선언한다**: `sideEffects: false` 한 줄이면 번들러가 가장 공격적으로 깎습니다. 대신 Vanilla Extract가 뽑아낸 `core.css`까지 지울 대상이 되어, 소비자가 CSS를 직접 import하지 않으면 스타일이 통째로 사라집니다. 빌드는 성공하고 화면만 깨지니 원인을 찾기도 어렵습니다.',
        '**선택지 3: 모듈 경계를 살리고 side effect 범위를 좁힌다 (선택)**: barrel은 순수 re-export만, 파일 구조는 `preserveModules`로 유지, side effect는 `core.css` 하나만 선언합니다. 그러면 번들러가 "CSS는 남기고 안 쓰는 컴포넌트 JS는 지운다"를 파일 단위로 판단합니다. dist 파일이 140개를 넘는 대신, 소비자는 새 설정도 낯선 경로도 배울 필요가 없습니다.',
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
        '`preserveModules`로 모듈 경계를 살리면서 dist 파일이 140개를 넘는 대신, 소비자는 새 설정도 낯선 경로도 배울 필요가 없습니다. 다만 dist 파일이 많아지면 배포 패키지 용량이 커지고, npm install 시 파일 수가 많아져 설치 속도가 느려질 수 있습니다.',
      ],
    },
  ],
  githubUrl: 'https://github.com/maintaein/TUI_TaeinUI',
  liveUrl: 'https://tui-taein-ui.vercel.app/',
};
