import { Project } from '@/types';

export const portfolio: Project = {
  title: 'Portfolio',
  subtitle: 'Next.js 15 + TypeScript 기반 포트폴리오 웹사이트',
  image: '/projects/Portfolio.webp',
  tags: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS 4', 'GSAP', 'Atomic Design'],
  duration: '2025.08 - 현재',
  phases: [
    { label: '1차 MVP', period: '2025.08 - 2025.12' },
    { label: '고도화', period: '2026.03 - 현재' },
  ],
  role: '웹 프론트엔드 개발',
  teamSize: '1명 (개인 프로젝트)',

  motivation: '프론트엔드 개발자로서 쌓아온 이력을 관리하기 위한 프로젝트. 프론트엔드 개발자라면 웹으로 포트폴리오를 구성하는게 역량을 보여주기 제일 좋지 않을까 싶었습니다. 마침 SSR이라는 개념에 대해 공부하면서 Next.js에 관심이 생겼는데, 포트폴리오 사이트는 SEO가 중요할 테니 Next.js로 개발해보기 딱이겠다고 생각했습니다.',

  implementations: [
    {
      category: 'Hero + About 섹션',
      items:['Hero 랜딩 페이지와 프론트엔드 개발자 김태인 소개'],
      intent: '간단한 애니메이션, 어디론가 빨려들어가는듯한 배경의 페이지로 시각적 흥미를 드리고자 했습니다.',
      video: '/projects/Portfolio/about.mp4'
    },
    {
      category: 'Projects 섹션',
      items:['진행한 프로젝트 목록, 상세 페이지에서 자세한 구현 사항 확인 가능'],
      intent: '프로젝트 섹션은 이미지와 텍스트를 한 화면에 보여드림으로써 한눈에 봐도 프로젝트를 파악하실 수 있도록 구성했습니다.',
      video: '/projects/Portfolio/about.mp4'
    },
    {
      category: 'Exp + Skill + Awards 섹션',
      items:['경력 사항, 기술 스택, 수상 내역을 정리'],
      intent: '제가 쌓아온 경험, 기술 역량, 수상 내역들을 빠르게 훑고 넘어갈 수 있게끔 구성했습니다.',
      video: '/projects/Portfolio/exp_skill_awards.mp4'
    },
  ],

  reviews: [
    {
      title: '배경을 지연 로딩하니 배경에 구현해둔 기능이 사라진 현상',
      problem: '화면 뒤에서 도는 배경은 three.js 라이브러리로 그렸습니다. 그래픽 카드를 직접 쓰는 코드라 서버에서 미리 그려 둘 수 없었습니다. 그렇다고 첫 화면에 로딩시키면 **210KB**나 따라붙기에 Next.js의 지연 로딩으로 처리했습니다. \n\n이 배경에 섹션을 옮기면 반응하여 속도가 달라지는 효과가 있었는데, 지연 로딩으로 수정하니 **배경에 구현해둔 섹션 이동 시 속도변화 기능이 사라진** 현상입니다.',
      analysis: [
        '**진단: ref가 배경까지 가지 않는다**: 공식 문서에서 지연 로딩으로 인해 기능이 사라지는 현상에 대해 찾아볼 수 없었습니다. 이에 설치된 Next.js 코드를 열어봤습니다. 그 결과 next/dynamic(지연 로딩)이 돌려주는 것은 **배경 컴포넌트가 아니라 Next.js가 만든 래퍼**였습니다. 이 래퍼는 ref에 본인을 다시 불러오는 retry만 채워두어서 청크가 도착해 배경을 렌더할 때는 props만 넘기고 ref는 넘기지 않습니다.',
        '**선택지 1: 지연 로딩을 포기하고 처음부터 같이 싣는다**: 제일 간단한 방법이고 기능 복구도 바로 됩니다. 대신 three.js 203.4KB가 첫 화면으로 옮겨와 166.3KB이던 첫 화면이 두 배를 넘습니다. WebGL이 안 되는 브라우저나 모션 줄이기를 켠 사용자는 실행되지도 않을 코드를 받게 되어 비용이 크다고 판단했습니다.',
        '**선택지 2: ref 없이 배경이 알아서 하게 둔다**: 배경이 현재 섹션과 탭 상태를 직접 구독하면 바깥에서 부를 일이 없다고 생각했습니다. 하지만 같은 값을 본문과 배경이 따로 구독하게 됩니다. 두 구독이 한 프레임만 어긋나도 섹션 전환 중에 배경 속도가 눈에 띄게 튀었습니다.',
        '**선택지 3: ref 대신 props로 받는다 (선택)**: 래퍼가 버리는 것은 ref뿐이니 props는 그대로 도착하지 않을까 싶었습니다. 그래서 동적 import 안에 컴포넌트를 하나 끼웠습니다. 이 컴포넌트가 props로 받은 콜백을 배경의 ref로 걸어 줍니다. 첫 화면 용량을 지키면서도 버려지는 코드 없이 기능을 구현할 수 있을 것이라고 판단했습니다.',
      ],
      action: [
        '동적 import 안에 컴포넌트를 하나 끼우고 바깥에서는 ref 대신 onHandle이라는 prop으로 핸들을 받습니다. 배경 컴포넌트 자체는 한 줄도 고치지 않았습니다.',
        '핸들은 청크가 풀린 뒤에 도착합니다. 빈 ref를 만들어 두고 기다리는 대신 React가 핸들을 붙이는 순간 한 번 불리는 콜백 ref로 받았습니다.',
        '배경이 안 보이는 이유를 네 가지로 나눠 data 속성에 적었습니다. 로딩 중, 모션 줄이기, 청크 실패, WebGL 컨텍스트 손실. 모션 줄이기를 켠 사용자에게는 청크를 아예 요청하지 않습니다.',
        '지연 로딩한 청크는 First Load JS에 잡히지 않아 조용히 커져도 모릅니다. 빌드 매니페스트에서 이 청크를 찾아 따로 재고 상한을 넘으면 CI가 빌드를 실패시킵니다.',
      ],
      resultHeadline: '배경 구현 기능 복구, 첫 화면은 166.3KB 그대로',
      result: [
        { label: '배경에 걸리는 핸들 메서드', before: 'retry 1개 (Next.js 것)', after: '7개 (boost, settle, pause, resume, setQuality 등)', measuredBy: '지연 로딩 후 실제로 도착한 객체와 배경이 노출하는 인터페이스 대조' },
        { label: 'First Load JS', before: '369.7KB (지연 로딩을 포기했을 때)', after: '166.3KB', delta: '-55%', measuredBy: '빌드 매니페스트의 첫 화면 파일 gzip 합계' },
        { label: '지연 로딩한 청크', after: '210.3KB (three.js 203.4KB + 씬 6.9KB, gzip)', measuredBy: '빌드 매니페스트의 동적 import 목록에서 이 청크만 골라 측정' },
      ],
      tradeOffs: [
        'ref 대신 props라서 사용법이 기존과 다릅니다. 지금의 next/dynamic 동작에 기댄 우회라서 추후 Next.js 업데이트가 이뤄지면 코드 수정이 필요할 수 있습니다.',
        'CI 상한을 본래 정해둔 수치보다 더 높여서 지정했습니다. 성능은 당연히 포기하면 안되지만, 포트폴리오 페이지의 특성 상 시각적 효과가 더 중요하다고 판단했습니다.',
      ],
    }
  ],

  githubUrl: 'https://github.com/maintaein/portfolio'
};
