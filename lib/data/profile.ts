import { Award, Certificate, Contact, CoreValue } from "@/types";

export const coreValues: CoreValue[] = [
    {
      id: '1',
      title: '새로움을 즐기는 개발자',
      description: '처음 접하는 개념도 직접 만들며 이해합니다. 디자인 시스템을 밑바닥부터 구축해 번들러·접근성·타입 시스템을 익히고 Tree-shaking 91% 감소를 실측 검증했으며, 포트폴리오 프로젝트에서는 SSR/Hydration 원리를 파고들어 렌더링 에러를 0건으로 잡았습니다.',
      imagePlaceholder: 'tech-stack'
    },
    {
      id: '2',
      title: '사용자의 눈과 마음으로',
      description: '쓰는 사람의 입장에서 성능과 사용 방식을 다듬습니다. 디자인 시스템에서 단순한 컴포넌트는 Flat, 레이아웃 조합 컴포넌트는 Compound로 API를 나눠 단순한 경우는 props 하나로, 복잡한 경우는 자유롭게 조합하도록 설계했습니다.',
      imagePlaceholder: 'ux-focus'
    },
    {
      id: '3',
      title: '원활한 소통과 협업 역량',
      description: '팀이 효율적인 방식으로 일할 구조를 고민합니다. Alphamail 프로젝트에서 프론트엔드 리더를 맡아 git과 jira 컨벤션을 설정하여 팀의 협업 효율성을 끌어올리고, FSD·Atomic 기반 구조를 잡아 기능별 독립 개발 환경을 만든 경험이 있습니다.',
      imagePlaceholder: 'collaboration'
    }
  ];
  

export const awards: Award[] = [
    {
      id: '1',
      title: '삼성청년SW아카데미 자율프로젝트',
      organization: '삼성전자',
      date: '2025. 05',
      rank: '🏆 우수상',
      description: 'AI 기반 업무 자동화 웹 서비스 AlphaMail의 프론트엔드 담당으로 수상'
    },
    {
      id: '2',
      title: '삼성청년SW아카데미 특화프로젝트',
      organization: '삼성전자',
      date: '2025. 04',
      rank: '🏆 우수상',
      description: '카드 혜택 기반으로 효율적 소비를 도와주는 모바일 금융 서비스 Rebirth의 프론트엔드 담당으로 수상'
    },
    {
      id: '3',
      title: '한국경제 SW개발 경진대회',
      organization: '한국경제',
      date: '2024. 06',
      rank: '🏆 장려상',
      description: '이미지의 포즈를 사용자가 그리는 대로 변환할 수 있는 AI 서비스'
    },
  ];
  
export const certificates: Certificate[] = [
    {
      id: '1',
      name: 'OPIC IH',
      organization: 'ACTFL',
      date: '2025. 03',
      validUntil: '2027. 03',
    },
  ];

export const contact: Contact = {
  name: '김태인',
  email: 'vostmfvostmf@naver.com',
  githubUrl: 'https://github.com/maintaein',
};
