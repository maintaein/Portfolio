import { Project } from '@/types';

export const tds: Project = {
  title: 'TDS (Taein Design System)',
  subtitle: '프론트엔드 개발자로서 나만의 디자인 일관성을 \n 갖기 위해 제작한 디자인 시스템',
  image: '/projects/TDS.webp',
  imageAspect: 'landscape',
  tags: ['React 19', 'TypeScript', 'Vanilla Extract', 'Vite', 'Vitest', 'pnpm Monorepo', 'TDD'],
  duration: '2025.12 - 2026.07',
  role: '1인 설계 및 개발',
  teamSize: '1명 (개인 프로젝트)',

  motivation: '프론트엔드를 시작하면서 어려웠던 부분 중 하나가 디자인 시스템에 대한 이해입니다. MUI나 Headless UI를 써봤지만, 컴포넌트 내부 구조를 알 수없어 스타일을 원하는 대로 바꾸기 어려웠습니다. 또한 컴포넌트들이 어떤 코드로 작동하는지 모른 채 쓰고 있다는 불안감이 있었고, 디자인 시스템이 뭘 의미하는지도 잘 몰랐습니다.\n\n직접 만들어보면 번들러·접근성·테스트·타입 시스템처럼 라이브러리 제작에 필요한 영역을 한꺼번에 경험할 수 있겠다고 판단했습니다. 동시에, 이후 개인 프로젝트에서도 Button이나 Modal을 매번 처음부터 만드는 대신 가져다 쓸 수 있으면 개발 속도와 디자인 일관성 두 가지를 함께 얻을 수 있을 것 같아 이 프로젝트를 시작했습니다.',

  implementations: [
    {
      category: '핵심 컴포넌트 (30개)',
      items: [
        '버튼/입력: Button, IconButton, SegmentedButtons, TextField, TextArea, Checkbox, Switch, Slider, NumericSpinner',
        '표시/피드백: Text, Badge, Chip, Avatar, Icon, Loader, LoadingSpinner, Skeleton, Snackbar, Tooltip',
        '오버레이: Modal, BottomSheet, SideSheet, Popover (포커스 트랩·ESC·backdrop 닫기)',
        '레이아웃: Card, List, BoardRow, Divider, Border, HeaderBar',
        '폼 인프라: FormField (render prop 패턴으로 label/id/ARIA 자동 연결)',
      ],
    },
    {
      category: '디자인 토큰 시스템',
      items: [
        'Theme Contract 기반 색상·타이포·간격·그림자·애니메이션 토큰 (`.css.ts`로 타입 안전)',
        '8pt Grid System, TypeScript 자동완성으로 존재하지 않는 토큰 참조를 컴파일 타임 차단',
      ],
    },
    {
      category: '데모 문서 앱 (packages/demo)',
      items: [
        '라이브 코드 에디터(EditableCodeBlock): Sucrase 런타임 JSX 트랜스파일 + React Hooks 지원',
        'Props 테이블, 접근성 가이드, Dog-fooding 적용(UI라이브러리를 활용해 개발)',
      ],
    },
    {
      category: '빌드·배포 인프라',
      items: [
        '컴포넌트 하나만 가져다 써도 나머지가 번들에 딸려오지 않도록, 빌드 시 컴포넌트별로 파일을 쪼개어 소비자 번들러가 실제로 쓰는 것만 골라갈 수 있게 구성.',
        '디자인 시스템과 데모 앱을 하나의 저장소에서 함께 개발하면서도 독립적으로 빌드·배포할 수 있도록 모노레포 구조를 채택. 코드를 올리면 Vercel이 자동으로 배포.',
        'AI 코딩 도구가 이 라이브러리의 API를 올바르게 이해하고 추천할 수 있도록, 모든 컴포넌트 사용법을 구조화한 문서 파일(llms.txt)을 함께 제공.',
      ],
    },
  ],

  techReasons: [
    {
      name: 'React 19',
      reasons: [
        '디자인 시스템은 라이브러리를 사용하는 사람이 많을수록 가치가 있습니다. 가장 넓은 사용자 기반을 가진 React를 선택함으로써 다양한 프로젝트에서 곧바로 쓸 수 있도록 했습니다.',
        '개발·검증 환경은 React 19를 기준으로 두었으나, 라이브러리 소비자는 기존 React 18 프로젝트에서도 설치할 수 있도록 peerDependencies 범위를 React 18/19로 열어두었습니다.',
      ],
    },
    {
      name: 'TypeScript (strict, no-any)',
      reasons: [
        '라이브러리를 쓰는 사람의 경험은 "내가 넣은 값이 맞는지 바로 알 수 있냐"에서 갈립니다. 타입을 느슨하게 두면 그 지점부터 자동완성이 멈추기 때문에, 프로젝트 전체에 strict 모드를 강제하고 예외를 허용하지 않았습니다.',
        '복잡한 컴포넌트에서 타입 충돌이 생길 때마다 제네릭으로 해결하는 규칙 덕분에, 사용자가 잘못된 props를 넘기면 편집기에서 즉시 빨간 줄로 알려줍니다.',
      ],
    },
    {
      name: 'Vanilla Extract CSS',
      reasons: [
        '스타일을 빌드 시점에 CSS 파일로 미리 만들어두기 때문에, 브라우저에서 스타일을 계산하고 주입하는 JavaScript 코드가 전혀 필요 없습니다. Emotion 같은 런타임 방식은 이 과정에서 추가 비용이 발생해 모바일 환경에서 로딩이 느려질 수 있습니다.',
        '디자인 토큰(색상, 간격 등)을 TypeScript로 정의하기 때문에, 존재하지 않는 토큰을 참조하면 코드를 저장하는 순간 바로 오류가 납니다. 디자인 시스템에서 토큰 일관성이 깨지는 것은 가장 큰 위험 중 하나라 이 방식을 선택했습니다.',
        '단, 이 선택이 빌드 최적화(Tree-shaking)와 충돌하는 문제가 발생해 별도로 해결해야 했고, 이 과정이 첫 번째 트러블슈팅이 되었습니다.',
      ],
    },
    {
      name: 'Vite 7',
      reasons: [
        '스타일 도구, 테스트 도구가 모두 같은 빌드 설정을 공유하기 때문에, 테스트는 통과했는데 실제로는 안 된다는 환경 불일치가 구조적으로 발생하지 않습니다.',
        '라이브러리를 소비하는 프로젝트가 실제로 쓰는 컴포넌트만 번들에 담을 수 있도록, 컴포넌트별로 파일을 분리해서 빌드하는 방식을 선택했습니다. 어떻게 합칠지는 소비자 번들러에게 위임하는 것이 라이브러리 설계 관습에 맞다고 판단했습니다.',
      ],
    },
    {
      name: 'Vitest + @testing-library/react',
      reasons: [
        '테스트를 작성할 때 버튼이 "화면에 보이는가", "클릭하면 반응하는가"처럼 사용자 시각으로 검증하기 때문에, role·ARIA·키보드 포커스 같은 접근성 관련 동작을 컴포넌트 회귀 테스트에 함께 묶을 수 있었습니다.',
        'Vite 빌드 설정을 공유하여, 테스트 환경과 실제 빌드 환경의 차이로 인한 예상치 못한 오류를 줄였습니다.',
      ],
    },
    {
      name: 'pnpm Monorepo',
      reasons: [
        '디자인 시스템과 데모 앱을 하나의 저장소에서 함께 개발하면서, 코어 패키지가 바뀌면 데모 앱이 즉시 그 변화를 반영합니다. 실제 사용자 입장에서 직접 써보는 Dog-fooding 구조를 만들기 위해 필수적인 선택이었습니다.',
        '패키지 간 공유 의존성을 한 번만 설치해 디스크를 효율적으로 사용하고, 타입 변경이 즉시 다른 패키지에 반영됩니다.',
      ],
    },
  ],

  keyMetrics: [
    {
      label: 'Tree-shaking 실측',
      before: '45KB (21 컴포넌트)',
      after: '4.17KB (gzip 1.43KB)',
      measuredBy: 'npm pack + esbuild를 통한 실측',
      learned: '버튼을 import 하면 버튼과 연관된 코드만 불러올 수 있도록 하는 tree-shaking을 구현했습니다.\n\n라이브러리를 만드는 사람은 그 라이브러리를 가져다 쓰는 사람의 환경에서도 검증해야 한다는 원칙을 가지게 되었습니다.',
    },
    {
      label: '테스트 커버리지',
      after: '1,074 tests / Statements·Lines 91.17%, Branches 87.94%',
      measuredBy: 'pnpm test:coverage (Vitest v8 coverage provider)',
      learned: '코드를 짜기 전에 먼저 이 기능이 어떻게 동작해야 하는가를 테스트로 정의하고, 그 테스트를 통과하는 코드를 작성한 뒤 개선하는 TDD의 Red → Green → Refactor 사이클에 대해 이해를 쌓았습니다.\n\n단순 테스트 개수보다 어떤 동작과 분기를 검증하는지가 더 중요하다는 점도 확인했습니다.',
    },
    {
      label: 'Dog-fooding',
      after: '소개 문서를 직접 TDS 컴포넌트로 구성',
      measuredBy: 'packages/demo/src 경로 내 core 외 UI 라이브러리 의존성 0건',
      learned: '직접 만든 라이브러리로 소개 문서 페이지를 만들어보면서, 문서나 코드 리뷰에서는 보이지 않던 불편함이 실사용에서 드러났습니다.\n\nModal에 닫기 버튼을 외부에서 커스터마이즈할 방법이 없다, Card의 안쪽 여백을 조정하기 어렵다.. 와 같이, 실제로 써봐야 알 수 있는 지점들이 컴포넌트 개선에 가장 큰 영향을 줬습니다.',
    },
    {
      label: '접근성',
      after: '주요 컴포넌트의 role·ARIA·키보드 포커스 동작을 테스트로 검증',
      measuredBy: '테스트 코드 내 getByRole, aria-* 속성, 포커스 이동 검증 쿼리 확인',
      learned: '접근성을 나중에 추가하려고 하면 컴포넌트 구조 자체를 바꿔야 하는 경우가 많았습니다.\n\n처음 설계할 때부터 키보드로도 쓸 수 있는지, 스크린 리더가 읽을 이름과 관계가 있는지를 기준으로 두면 컴포넌트 구조를 더 안정적으로 잡을 수 있었습니다.',
    },
  ],

  reviews: [
    {
      id: 'treeshaking',
      title: '1. Tree-shaking 검증 및 빌드 최적화',
      image: '/projects/TDS/tree-shaking.webp',
      problem: '디자인 시스템의 가치 중 하나는 필요한 컴포넌트만 골라 쓸 수 있다는 점입니다. 그런데 npm 패키지를 만들어 실제 소비자 환경을 시뮬레이션해보니, Button 한 개만 import해도 컴포넌트 전체가 그대로 번들에 실렸습니다. Tree-shakable이라는 목표를 실측으로 뒷받침하지 못하면 라이브러리의 핵심 가치가 지켜지지 못하는 상황이었습니다.',
      analysis: [
        '**진단 — 번들러가 "지워도 안전하다"고 판단할 근거가 없었음**: Button 하나만 사용하는 소비자 예제로 실측하니 30개 중 21개 컴포넌트가 포함된 45KB가 나왔습니다. barrel 진입점(`index.mjs`)으로 import하면 45KB, 컴포넌트 파일을 직접 import하면 4.3KB가 나오는 대조 실험으로 문제를 barrel로 좁혔고, 핵심 원인은 barrel의 `export const version = \'0.1.0\'` 한 줄이었습니다. 진입 파일에 re-export 외의 값 export가 있으면 Rollup은 "자체 실행 코드가 있는 모듈"로 판단해 side effect가 있는 것으로 취급하고, barrel이 import하는 모든 모듈을 지우지 않고 남깁니다. 즉 라이브러리가 번들러에게 "이 모듈들은 제거해도 안전하다"는 근거를 주지 못하고 있던 것이 문제였습니다.',
        '**선택지 1 — 번들 구성을 수동으로 통제하기**: Button 번들, Modal 번들처럼 결과물을 미리 나눠 제공하면 소비자 환경과 관계없이 결과를 통제할 수 있습니다. 하지만 라이브러리가 소비자 번들러의 역할까지 대신하게 되고, 단일 진입점에서 named import로 가져다 쓰는 익숙한 사용 방식도 깨집니다. 최종 앱 번들링은 소비자 도구에 맡기는 것이 라이브러리 설계 관습에 맞다고 판단해 선택하지 않았습니다.',
        '**선택지 2 — CSS를 JS에 인라인하기**: CSS 파일이 별도로 존재하지 않으면 side effect 표기를 고민할 필요 자체가 줄어듭니다. 그러나 정적 CSS 파일 제공이라는 Vanilla Extract 선택 이유가 무너지고, 런타임 JS 번들에 스타일 코드가 섞입니다. 런타임 스타일 엔진을 줄이는 것이 TDS의 방향이었기 때문에 선택하지 않았습니다.',
        '**선택지 3 — 번들러에게 정확한 메타데이터 제공 (선택)**: 진단에서 확인한 문제는 결국 "번들러에게 주는 정보가 부정확하다"로 수렴합니다. barrel을 순수 re-export 전용으로 유지하고, ESM/CJS를 확장자로 구분하고, 컴포넌트별 모듈 구조를 보존하고, CSS만 side effect임을 선언하면 소비자 번들러가 사용하지 않는 컴포넌트를 제거할 근거를 갖게 됩니다. 원인과 직접 대응하는 유일한 방향이면서 소비자에게 아무 설정도 요구하지 않기 때문에 이 방식을 선택했습니다.',
      ],
      action: [
        'Button 하나만 import하는 예제를 만들고 `npm pack` + esbuild로 실제 배포 패키지 기준 번들 크기를 측정',
        'ESM은 `.mjs`, CJS는 `.cjs`로 분리해 소비자 번들러가 import/require 진입점을 명확히 구분하도록 수정',
        '`preserveModules`로 컴포넌트별 모듈 구조를 유지해 사용하지 않는 컴포넌트를 제거할 수 있는 형태로 빌드',
        '`sideEffects: ["./dist/core.css"]`를 명시해 CSS는 유지하되 JS 컴포넌트 모듈은 tree-shaking 대상이 되도록 수정',
        '진입 파일을 컴포넌트·토큰 export 중심으로 단순화해 불필요한 실행 코드가 섞이지 않도록 정리',
      ],
      result: [
        { label: '번들 크기', before: '45KB (컴포넌트 1개 import에 전체 포함)', after: '4.17KB (gzip 1.43KB) — 사용한 컴포넌트만 번들에 포함', delta: '-91%', measuredBy: 'npm pack + esbuild 예제 시뮬레이션' },
        { label: '회귀 방지', after: 'CI에서 dist 진입점 gzip 크기 상한을 검사하고, 컴포넌트 단위 소비자 번들 크기는 수동 실측으로 확인', measuredBy: 'GitHub Actions gzip size check + npm pack/esbuild 수동 실측' },
        { label: '전체 테스트', after: '1,068 / 1,068 통과 (당시 전체 테스트 수 기준) — Tree-shaking 수정 후 기존 컴포넌트 동작 이상 없음 확인', measuredBy: 'pnpm test' },
      ],
      tradeOffs: [
        '`preserveModules`를 적용하면 dist 파일 수가 140개 이상으로 늘어납니다. 다만 npm 배포 크기는 `files` 필드로 dev 산출물을 제외해 상쇄했고, 파일 수 자체는 소비자 번들러가 트리 쉐이킹 후 합치므로 런타임에는 영향이 없습니다.',
        'Vite·webpack처럼 package.json의 `sideEffects` 메타데이터를 적극적으로 활용하는 번들러에서는 개선 효과를 확인했지만, 모든 Rollup 직접 설정에서 같은 결과를 보장한다고 단정하지 않았습니다. 라이브러리 쪽에서는 표준 메타데이터를 제공하고, 특수한 소비자 번들 설정은 문서화가 필요한 후속 과제로 남겼습니다.',
      ],
    },
    {
      id: 'recipe-build',
      title: '2. recipe 도입과 소비자 빌드 호환성 확보',
      image: '/projects/TDS/recipe-build.webp',
      problem:
        'Button·IconButton은 두 축의 스타일(buttonStyle: fill/weak × variant: primary/dark/danger/light)이 조합되는 컴포넌트인데, 한 축의 나열만 표현할 수 있는 styleVariants로는 조합을 담을 수 없어 fillVariants/weakVariants 같은 병렬 맵을 만들고 컴포넌트 코드의 삼항 연산자로 골라 쓰는 구조였습니다. Chip은 더 심각해서 variantStyles/colorStyles가 빈 객체로 죽어 있고 실제 값은 별도 맵과 헬퍼 함수에 흩어져 있었습니다. 조합 로직이 스타일 정의 밖(컴포넌트 코드)으로 새어 나와 새 variant 하나를 추가하려면 여러 맵과 분기를 동시에 고쳐야 했고, 이를 해결하기 위해 조합별 스타일을 스타일 정의 안에서 선언적으로 표현할 수 있는 `recipe()`(variants + compoundVariants)를 도입해 세 컴포넌트를 마이그레이션했습니다. 마이그레이션 후 core의 빌드·테스트는 모두 통과했지만, 전체 검증 단계에서 demo 앱의 프로덕션 빌드만 `[vanilla-extract] Invalid exports` 에러로 실패했습니다. demo는 core를 실제 npm 소비자와 같은 경로(package exports → dist)로 소비하는 유일한 워크스페이스였기 때문에, 이 실패는 내부 설정 문제가 아니라 자기 빌드에 vanilla-extract를 쓰는 모든 외부 소비자의 빌드가 깨진다는 신호였습니다.',
      analysis: [
        '**진단 — 산출물이 소비자 도구의 감지 규칙과 충돌**: 에러 발생 지점이 core의 소스가 아니라 빌드 산출물(`dist/components/Button/Button.css.mjs`)이라는 점에서 출발해, 원인 사슬을 플러그인 소스 코드까지 내려가 확인했습니다.\n- `recipe()`는 컴파일되면 함수(`createRuntimeFn` 호출 결과)를 export합니다. 기존 `styleVariants()`의 컴파일 결과는 순수 문자열·객체라 이 문제가 없었습니다.\n- `@vanilla-extract/vite-plugin`의 transform 훅 소스를 직접 열어 확인한 결과, 처리 대상 판단이 `cssFileFilter` 정규식(`.css.js`/`.css.mjs`/`.css.ts` 등 매칭) 하나뿐이고 node_modules 제외 로직이 전혀 없었습니다.\n- core가 preserveModules로 `Button.css.ts`를 `Button.css.mjs`로 미러링하면서 이 정규식과 정확히 겹쳤고, demo의 vanilla-extract 플러그인이 남의 빌드 산출물을 "새로 컴파일할 소스"로 착각해 재처리하다 함수 export를 만나 실패한 것입니다.',
        '**선택지 1 — alias로 src 직접 참조**: docs처럼 demo에도 core를 src로 잇는 alias를 걸면 빌드는 즉시 통과합니다. 하지만 이는 소스에 접근할 수 있는 워크스페이스 내부에서만 가능한 방법입니다. 진짜 npm 소비자는 dist만 받으므로 alias 자체가 불가능하고, 배포 결함은 그대로 남습니다 — 문제를 해결하는 게 아니라 안 보이게 만드는 방향입니다.',
        '**선택지 2 — recipe 도입 회귀**: 가장 손쉬운 회피는 recipe 도입 자체를 되돌리는 것입니다. 함수 export가 사라지므로 충돌도 사라지지만, 죽은 placeholder 스타일과 삼항 분기 중복이라는 이번 마이그레이션이 해결하려던 원래 문제로 되돌아갑니다. 산출물 파일명이라는 표면적 충돌 때문에 스타일 아키텍처 결정을 뒤집는 것은 본말전도라고 판단했습니다.',
        '**선택지 3 — 라이브러리 산출물 쪽에서 충돌 제거 (선택)**: 충돌의 구성 요소는 "함수 export"와 "감지 정규식에 걸리는 파일명" 두 가지인데, 함수 export는 recipe의 본질이므로 남는 변수는 파일명입니다. 산출물명이 `.css.mjs` 패턴만 벗어나면 소비자 플러그인의 재처리가 원천적으로 발생하지 않습니다. 문제의 소유자는 산출물을 만드는 라이브러리 쪽이고, 소비자에게 아무런 설정도 요구하지 않는 유일한 방향이라 이 방식을 선택했습니다.',
      ],
      action: [
        '1차 대응으로 demo에 alias 우회를 적용해 전체 검증을 통과시켰으나, 외부에서 사용 시에는 가치 없는 내용임 — alias를 제거해 `Invalid exports` 실패를 baseline으로 재현한 뒤 근본 수정으로 전환',
        '`build.lib.fileName`에서 `.css`로 끝나는 산출물명을 `.vanilla`로 교체 (`Button.css.mjs` → `Button.vanilla.mjs`) — 소비자 플러그인의 감지 정규식과 매칭 자체를 차단',
        '수정 중 추가 결함 발견: `@vanilla-extract/recipes`가 external에 빠져 런타임 헬퍼가 번들에 포함되면서, 로컬 pnpm 스토어의 절대 경로 구조가 `dist/node_modules/.pnpm/...` 형태로 배포판에 그대로 유출되고 있었음 — `rollupOptions.external`을 함수형으로 바꿔 recipes 패키지를 외부화',
        '`@vanilla-extract/recipes`의 package.json exports를 열어 `createRuntimeFn`이 메인 진입점이 아니라 `./createRuntimeFn` 서브패스에서만 export됨을 확인하고, `output.paths`를 이 정확한 서브패스로 재매핑 — 메인 진입점으로 매핑했다면 빌드는 성공해도 존재하지 않는 export를 참조하는 산출물이 됐을 것',
      ],
      result: [
        { label: '소비자 빌드 호환성', before: 'vanilla-extract 플러그인을 쓰는 소비자의 프로덕션 빌드가 Invalid exports로 실패 (alias 제거 baseline에서 재현 확인)', after: 'alias 없이 demo 프로덕션 빌드 성공 — 소비자와 동일한 dist 경로 소비로 검증', measuredBy: 'alias 제거 → 실패 재현 → 수정 → demo 빌드 성공의 전후 대조' },
        { label: '배포 산출물 오염', before: '`dist/node_modules/.pnpm/...` 로컬 절대 경로 구조가 배포판에 포함', after: 'dist 내 node_modules 0건 — 산출물 import가 `@vanilla-extract/recipes/createRuntimeFn` 표준 서브패스로 정리', measuredBy: '빌드 산출물 디렉터리 확인 + ESM/CJS import문 grep 실측' },
        { label: '회귀 안전망', after: '1,074/1,074 테스트 통과, 마이그레이션한 컴포넌트별 번들 1.3~2.2KB로 3KB 목표 유지', measuredBy: 'pnpm test + 컴포넌트별 번들 크기 실측' },
      ],
      tradeOffs: [
        '`.vanilla` 개명은 vanilla-extract 감지 정규식의 현재 형태에 의존하는 회피책입니다. 정공법은 플러그인이 node_modules 산출물을 제외하는 것이지만 라이브러리가 통제할 수 없는 영역이라, 통제 가능한 산출물 쪽에서 해결했습니다. 플러그인의 감지 규칙이 바뀌면 재검토가 필요한 의존입니다.',
        '검증 범위는 워크스페이스 안(demo가 dist를 소비)까지입니다. 워크스페이스 소비와 실제 npm 설치는 심볼릭 링크 처리 등 미묘한 차이가 있어, npm pack 결과물을 설치하는 외부 최소 재현 프로젝트 검증을 배포 전 후속 과제로 남겼습니다.',
      ],
    },
    {
      id: 'api-design',
      title: '3. 컴포넌트 API 설계 전략',
      image: '/projects/TDS/API.webp',
      problem: '사용자가 "이 라이브러리는 일관된 방식으로 쓰는구나"라고 느끼도록, 초기에는 모든 컴포넌트를 props만으로 조작하는 Flat방식으로 통일했습니다. Flat 방식이 사용 방법이 간결하여 사용자의 편의성도 높여줄 것이라고 판단했습니다. 실제로 Button·TextField처럼 단순한 컴포넌트는 문제없었지만, 직접 라이브러리를 써서 데모 앱을 만들어보니 Modal·Card처럼 내부 레이아웃을 자유롭게 구성해야 하는 컴포넌트에서 문제가 드러났습니다. 커스터마이징 요구사항이 있을 때마다 props를 늘려야 했고, 이는 사용자 경험 뿐만아니라 확장 및 유지보수에서 불편함을 느끼게 하여 문제가 되었습니다.',
      analysis: [
        '**진단 — props만으로는 레이아웃 자유도를 보장할 수 없음**: 제목·내용·버튼처럼 내부 구조가 고정된 컴포넌트는 props로 값을 받는 방식이 직관적입니다. 그런데 Modal 푸터에 버튼을 두 개 넣거나, Card 안에 커스텀 레이아웃을 구성하는 경우처럼, 내부 구조를 사용자가 결정해야 하는 상황에서는 props가 몇개가 될지, 어떤 props가 필요할지 미리 알기 어렵습니다. 굳이 구현한다면 JSX 조각을 props 값으로 전달하는 방법이 있었지만, 이는 컴포넌트 바깥에서 컴포넌트 내부 구조를 직접 밀어넣는 방식이라 가독성도 타입 안전성도 모두 나빠졌습니다.',
        '**선택지 1 — 모두 Compound 방식으로 바꾸기**: 서브 컴포넌트를 조합하는 방식으로 전환하면 내부 레이아웃을 사용자가 자유롭게 결정할 수 있습니다. 그런데 제목과 본문만 있는 단순한 카드를 쓰려고 해도 서브 컴포넌트를 항상 나열해야 합니다. 기존에 Flat으로 쓰던 단순한 컴포넌트들까지 전부 바꿔야 하는 비용도 있었고, 단순한 케이스에 불필요한 복잡도를 강요하는 방향이라 폐기했습니다.',
        '**선택지 2 — Flat 방식을 유지하되, 복잡한 컴포넌트에만 오버로드 추가**: 기존 API를 유지하면서 복잡한 케이스를 위한 props 경로를 추가로 만드는 방법입니다. 하지만 이 방법 역시 JSX를 객체로 묶어 받는 방식으로 기존 문제와 다를 게 없었고, props 수가 더 늘어나기만 하여 진단에서 발견한 문제가 해결되지 않았습니다.',
        '**선택지 3 — 컴포넌트의 성격에 따라 제공 방식을 나누기 (선택)**: 컴포넌트가 표현하는 것이 하나의 값·행동·상태인지를 기준으로 삼았습니다. Button은 하나의 행동, Badge는 하나의 상태, TextField는 하나의 입력값이라 내부 레이아웃이 달라질 이유가 없습니다. 반면 Card·Modal처럼 이미지가 들어갈 수도 안 들어갈 수도 있고 푸터 구성이 상황마다 달라지는 컴포넌트는 내부 구조를 고정하는 순간 사용자가 원하는 조합을 표현할 수 없게 됩니다. 전자는 Flat을 유지하고 후자만 Compound를 제공하되, 단순한 경우까지 서브 컴포넌트 나열을 강요하지 않으려면 "제목·푸터 같은 Flat props가 있으면 Flat 모드, 없으면 Compound 모드"로 동작하는 자동 감지가 필요하다고 판단했습니다.',
      ],
      action: [
        '단순 컴포넌트 (Button, TextField, Badge 등)에 Flat props 방식 적용',
        '레이아웃 조합 컴포넌트(Card, Modal, SideSheet, BottomSheet)에 `Card.Header` 형태의 네임스페이스 조합 API 적용',
        '레이아웃 조합 컴포넌트에 Hybrid 자동 감지 추가 — Card는 title/header/footer/image, Modal은 title/footer, SideSheet·BottomSheet는 title prop이 있으면 Flat 모드로 동작',
        '`Object.assign(Root, { Header, Title, ... })`로 서브 컴포넌트를 네임스페이스로 묶고, 루트 내부의 isFlat 분기 하나로 Flat/Compound 모드를 전환하는 단일 파일 구조로 구현',
        '30개 컴포넌트 전체에 variant·size·disabled 네이밍 규칙 통일',
      ],
      result: [
        { label: '컴포넌트 확장성 및 유지보수 편의성', after: '새로운 레이아웃 조합이 필요할 때 기존 컴포넌트(core)를 수정하지 않고 사용자 측 Compound 조합으로 해결', measuredBy: '데모 앱 제작 중 Modal·Card 실사용 확인' },
        { label: '사용 방식 분리', after: '단일 값/행동을 표현하는 컴포넌트는 Flat API로 유지하고, 레이아웃 조합 4개(Card·Modal·SideSheet·BottomSheet)만 Compound API를 병행 제공해 단순 사용성과 확장성을 분리', measuredBy: 'core 컴포넌트 API와 demo 사용 예제 대조' },
        { label: '접근성 보강', after: 'Flat API에서 title이 있을 때 자동으로 aria-labelledby와 연결되도록 보강해 단순 사용 경로에서도 dialog 이름이 누락되지 않도록 개선', measuredBy: 'Modal/SideSheet/BottomSheet 접근성 테스트' },
      ],
      tradeOffs: [
        'Hybrid 자동 감지는 두 모드를 섞어 쓰면 Compound 하위 컴포넌트가 의도와 다른 위치에 중첩될 수 있습니다. 타입 레벨에서 원천 차단하려면 Flat props와 Compound children을 discriminated union으로 분기해야 하지만, 현재는 API 단순성과 구현 비용을 고려해 후속 과제로 남겼습니다.',
        'Compound API는 `Card`를 import하면 서브 컴포넌트 전체가 번들에 딸려옵니다. 서브 컴포넌트를 별도 export로 분리하면 Tree-shaking이 가능하지만, 그 순간 `Card.Header` 네임스페이스 문법이 깨져 사용성이 나빠집니다. 네임스페이스를 유지하는 쪽이 디자인 시스템 관습에 맞다고 판단해 이 비용을 감수했습니다.',
      ],
    },
  ],

  githubUrl: 'https://github.com/maintaein/TDS_TaeinDesignSystem',
  demoUrl: 'https://tds-taein-design-system.vercel.app/',
};
