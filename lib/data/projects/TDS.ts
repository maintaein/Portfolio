import { Project } from '@/types';

export const tds: Project = {
  title: 'TDS (Taein Design System)',
  subtitle: '프론트엔드 개발자로서 나만의 디자인 일관성을 \n 갖기 위해 제작한 디자인 시스템',
  image: '/projects/TDS.webp',
  imageAspect: 'landscape',
  tags: ['React 19', 'TypeScript', 'Vanilla Extract', 'Vite', 'Vitest', 'pnpm Monorepo', 'TDD'],
  duration: '2025.12 - 2026.03',
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
        '**진단 — 무엇이 Tree-shaking을 막고 있는가**: Button 하나만 사용하는 소비자 예제를 만들고 번들 결과물을 확인했습니다. 목표는 Button에 필요한 코드만 남고, Modal·BottomSheet·Slider처럼 사용하지 않은 컴포넌트 코드는 제거되는 것이었습니다. 그런데 실제 번들에는 사용하지 않은 컴포넌트 코드까지 함께 포함되어 있었습니다. 원인은 세 가지로 나눠 확인했습니다.\n- ESM과 CJS 산출물이 명확히 분리되지 않으면 소비자 번들러가 어떤 진입점을 기준으로 최적화해야 하는지 헷갈릴 수 있었습니다.\n- 진입 파일에 컴포넌트 export 외의 실행 코드나 값 export가 섞이면, 번들러가 "이 파일은 실행 결과가 있을 수 있다"고 보고 사용하지 않은 코드까지 남겨둘 수 있었습니다.\n- Vanilla Extract가 만든 CSS는 실제로 필요한 스타일 파일입니다. 하지만 package.json에 "CSS 파일만 반드시 남기고, 사용하지 않는 JS 컴포넌트 코드는 제거해도 된다"는 정보를 주지 않으면, 번들러가 스타일 누락을 피하려고 관련 JS 코드까지 함께 남겨둘 수 있었습니다.',
        '**선택지 1 — 번들 구성을 수동으로 통제하기**: 이 방식은 Button 번들, Modal 번들처럼 결과물을 미리 나눠 제공하므로 소비자 환경과 관계없이 결과를 통제하기 쉽습니다. 하지만 라이브러리가 소비자 번들러의 역할까지 대신하게 되고, 사용자가 원하는 번들 전략에 개입하게 됩니다. TDS는 최종 앱 번들링은 소비자 도구에 맡기는 방향이 더 적절하다고 판단해 선택하지 않았습니다.',
        '**선택지 2 — CSS를 JS에 인라인하기**: CSS 파일이 별도로 존재하지 않으면 CSS side effect 표기를 고민할 필요가 줄어듭니다. 그러나 이 경우 Vanilla Extract를 선택한 이유였던 정적 CSS 파일 제공 장점이 약해지고, 런타임 JS 번들에 스타일 관련 코드가 섞일 수 있습니다. TDS의 방향은 런타임 스타일 엔진을 줄이고 정적 CSS를 제공하는 것이었기 때문에 선택하지 않았습니다.',
        '**선택지 3 — 번들러에게 정확한 메타데이터 제공 (선택)**: 최종적으로는 라이브러리 쪽에서 “어떤 파일은 안전하게 제거해도 되고, 어떤 파일은 스타일 적용 때문에 남겨야 하는지”를 명확히 알려주는 방식을 선택했습니다. ESM과 CJS를 분리하고, 컴포넌트 단위 모듈 구조를 유지했습니다. 또한 CSS 파일만 부수효과가 있음을 명시하고, 진입 파일은 컴포넌트와 토큰 export 중심으로 단순화했습니다. 이렇게 하면 Vite나 webpack 같은 소비자 번들러가 사용하지 않는 JS 컴포넌트를 제거할 근거를 갖게 됩니다.',
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
        { label: '전체 테스트', after: '1,074 / 1,074 통과 — Tree-shaking 수정 후 기존 컴포넌트 동작 이상 없음 확인', measuredBy: 'pnpm test' },
      ],
      tradeOffs: [
        '`preserveModules`를 적용하면 dist 파일 수가 140개 이상으로 늘어납니다. 다만 npm 배포 크기는 `files` 필드로 dev 산출물을 제외해 상쇄했고, 파일 수 자체는 소비자 번들러가 트리 쉐이킹 후 합치므로 런타임에는 영향이 없습니다.',
        'Vite·webpack처럼 package.json의 `sideEffects` 메타데이터를 적극적으로 활용하는 번들러에서는 개선 효과를 확인했지만, 모든 Rollup 직접 설정에서 같은 결과를 보장한다고 단정하지 않았습니다. 라이브러리 쪽에서는 표준 메타데이터를 제공하고, 특수한 소비자 번들 설정은 문서화가 필요한 후속 과제로 남겼습니다.',
      ],
    },
    {
      id: 'bottomsheet',
      title: '2. BottomSheet 드래그 인터랙션',
      image: '/projects/TDS/bottomsheet.webp',
      problem:
        'BottomSheet에 드래그로 닫기 기능을 추가했지만, 실제 사용감은 자연스럽지 않았습니다. 시트가 드래그 위치를 안정적으로 따라오지 못했고, 닫을 때 CSS 애니메이션과 JS로 넣은 transform이 충돌해 원위치로 튕기거나 한 프레임 깜빡이는 문제가 생겼습니다. 핵심은 "사용자가 끄는 동안에는 손가락을 따라오고, 손을 떼면 그 위치에서 자연스럽게 닫히거나 복귀해야 한다"는 요구를 React 상태 업데이트, 브라우저 이벤트, CSS 애니메이션 중 어디에 맡길지 정하는 문제였습니다.',

      analysis: [
        '**진단 — 드래그 중 위치 제어권이 흩어져 있었음**: BottomSheet는 기본적으로 CSS 애니메이션으로 열리고 닫힙니다. 그런데 드래그 기능은 사용자가 움직이는 동안 매 프레임 `transform`을 바꿔야 합니다. 즉 같은 `transform` 값을 CSS 애니메이션과 JS 드래그 로직이 동시에 다루게 되었고, 드래그 종료 시점에는 React의 `open` 상태 변경과 DOM 스타일 정리까지 겹쳤습니다. 그래서 문제를 "좌표를 어디에 저장할 것인가", "드래그 종료 이벤트를 어디서 받을 것인가", "드래그 중에는 CSS와 JS 중 누가 transform을 제어할 것인가"라는 하나의 설계 문제로 정리했습니다.',

        '**선택지 1 — React state로 드래그 위치를 렌더링하기**: 드래그 거리를 state에 저장하고, 그 값을 style에 반영하는 방식입니다. React 흐름 안에서 상태를 추적할 수 있어 이해하기 쉽고 DevTools로 확인하기 좋다는 장점이 있습니다. 하지만 드래그 중에는 `touchmove`나 `mousemove`가 매우 자주 발생하므로 매번 리렌더가 일어납니다. BottomSheet 위치는 입력 이벤트에 즉시 반응해야 하는 값이라, React 렌더 사이클에 태우면 움직임이 늦거나 불필요한 렌더 비용이 생길 수 있다고 판단해 선택하지 않았습니다.',

        '**선택지 2 — 시트 내부 이벤트와 기존 CSS 애니메이션만 활용하기**: 드래그 시작·이동·종료 이벤트를 모두 BottomSheet 요소에만 등록하고, 닫힘은 기존 CSS exit 애니메이션에 맡기는 방식입니다. 구현 범위가 작고 기존 애니메이션 구조를 거의 유지할 수 있다는 장점이 있습니다. 하지만 마우스로 드래그하다가 시트 밖에서 버튼을 떼면 종료 이벤트를 놓칠 수 있고, 드래그 중 JS가 넣은 위치와 CSS exit 애니메이션의 시작 위치가 어긋나 원위치로 튕기는 문제가 남았습니다. 사용자가 놓은 위치에서 이어서 닫히는 경험을 만들기 어려워 선택하지 않았습니다.',

        '**선택지 3 — 드래그 중에는 JS가 위치를 직접 제어하기 (선택)**: 드래그 중 위치는 React state가 아니라 ref와 인라인 `transform`으로 관리하고, 마우스 이동과 종료는 document에서 추적하는 방식입니다. 드래그가 시작되면 CSS 애니메이션을 끄고 JS가 transform을 단독으로 제어하게 하며, 일정 거리 이상 내려가면 현재 위치에서 `translateY(100%)`로 이어서 닫습니다. 전역 이벤트 cleanup과 인라인 스타일 정리 경로를 직접 관리해야 한다는 단점이 있지만, 드래그 위치 반영·시트 밖 종료 감지·닫힘 애니메이션 연결을 모두 해결할 수 있어 이 방식을 선택했습니다.',
      ],

      action: [
        '드래그 시작 위치와 진행 여부를 `startYRef`, `isDraggingRef`로 관리해 이동 중 리렌더 없이 좌표를 갱신',
        '마우스 드래그의 `mousemove`와 `mouseup`을 document에 등록해 시트 밖에서 손을 떼도 종료를 감지하도록 수정',
        '드래그 시작 시 `sheet.style.animation = "none"`을 설정해 CSS 애니메이션과 JS transform 제어가 충돌하지 않도록 처리',
        '드래그 거리가 100px을 넘으면 `translateY(100%)`로 닫기 전환을 실행하고, `transitionend` 이후 `onClose`를 호출하도록 변경',
        '`isClosingViaDragRef`를 추가해 드래그 닫기 중에는 일반 닫기 정리 로직이 transform을 먼저 지우지 않도록 분기',
        '드래그 가능/불가능, 아래 방향 드래그, 위 방향 드래그에 대한 회귀 테스트를 추가',
      ],

      result: [
        {
          label: '드래그 동작',
          before: '드래그 중 시트가 입력 위치를 안정적으로 따라오지 않거나, 시트 밖에서 종료 이벤트를 놓칠 수 있음',
          after: '마우스 드래그는 시트 밖에서도 종료를 감지하고, 드래그 거리에 따라 닫기/복귀가 분기됨',
          measuredBy: '수동 재현 + BottomSheet 드래그 테스트',
        },
        {
          label: '닫기 애니메이션',
          before: '드래그 후 CSS 애니메이션과 JS transform이 충돌해 원위치로 튕기는 동작이 발생',
          after: '드래그 중에는 JS가 transform을 제어하고, 닫기 전환이 끝난 뒤 onClose를 호출하도록 정리',
          measuredBy: '수동 재현 + transitionend 테스트',
        },
        {
          label: '회귀 안전망',
          after: '드래그 가능/불가능, 위 방향 드래그, ESC, backdrop, 포커스, 스크롤 관련 BottomSheet 테스트로 주요 동작을 검증',
          measuredBy: 'Vitest BottomSheet.test.tsx',
        },
      ],

      tradeOffs: [
        '`useRef`는 리렌더를 줄이는 대신 React DevTools에서 값 변화를 추적하기 어렵습니다. 드래그 좌표처럼 화면 상태라기보다 이벤트 처리 중 필요한 임시 값에는 적합하다고 판단했습니다.',
        '현재 마우스 이동/종료는 document에서 추적하지만 터치 이동/종료는 시트 요소에 등록되어 있습니다. 모바일 드래그를 더 안정적으로 만들려면 Pointer Events로 통합하거나 touch 이벤트도 document 범위로 확장하는 개선 여지가 있습니다.',
        '`isClosingViaDragRef`로 닫기 경로를 분기하면서 상태가 하나 늘었습니다. 닫기 경로가 더 늘어나면 boolean 플래그 대신 명시적인 상태 머신으로 바꾸는 편이 더 안전할 수 있습니다.',
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
        '**선택지 3 — 컴포넌트에 따라 제공 방식을 나누기(선택)**: 컴포넌트가 표현하는 것이 하나의 값이나 상태인지 아닌지를 기준으로 제공 방식을 나눴습니다. 예를 들어, Button은 하나의 행동, Badge는 하나의 상태, TextField는 하나의 입력값이라 내부 레이아웃이 달라질 이유가 없습니다 . 반면 Card·Modal처럼 이미지가 들어갈 수도 없을 수도 있고 푸터 버튼 구성이 상황마다 달라지는 컴포넌트는 내부 구조를 고정하는 순간 사용자가 원하는 조합을 표현할 수 없게 됩니다. 전자는 Flat 방식을 유지하고, 후자는 Compound 방식으로 전환했습니다. Compound로 전환한 컴포넌트에는 단순하게 쓸 수 있도록 제목·푸터 props가 있으면 자동으로 Flat 모드로 동작하는 자동 감지를 추가해, 단순한 경우는 props 하나로 끝나고 복잡한 경우는 Compound로 자유롭게 구성할 수 있도록 했습니다.',
      ],
      action: [
        '단순 컴포넌트 (Button, TextField, Badge 등)에 Flat props 방식 적용',
        '레이아웃 조합 컴포넌트(Card, Modal, SideSheet, BottomSheet)에 `Card.Header` 형태의 네임스페이스 조합 API 적용',
        '레이아웃 조합 컴포넌트에 Hybrid 자동 감지 추가 — Card는 title/header/footer/image, Modal은 title/footer, SideSheet·BottomSheet는 title prop이 있으면 Flat 모드로 동작',
        '30개 컴포넌트 전체에 variant·size·disabled 네이밍 규칙 통일',
      ],
      result: [
        { label: '컴포넌트 확장성 및 유지보수 편의성', after: '컴포넌트들이 역할에 맞는 API를 갖게 되어, 새로운 조합이 필요할 때 기존 컴포넌트를 수정하지 않고 Compound로 확장 가능', measuredBy: '데모 앱 제작 중 Modal·Card 실사용 확인' },
        { label: '사용 방식 분리', after: '단일 값/행동을 표현하는 컴포넌트는 Flat API로 유지하고, 내부 구성이 달라지는 컴포넌트는 Compound API를 함께 제공해 단순 사용성과 확장성을 분리', measuredBy: 'core 컴포넌트 API와 demo 사용 예제 대조' },
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
