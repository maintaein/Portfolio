import { Award, Certificate, CoreValue } from "@/types";

export const coreValues: CoreValue[] = [
    {
      id: '1',
      title: '새로움을 즐기는 개발자',
      description: '새로운 기술과 트렌드를 빠르게 습득하고, 프로젝트에 적극 도입합니다. React와 Typescript를 주로 사용하며, 최근 Next.js와 테스트 자동화에 관심이 많습니다.',
      imagePlaceholder: 'tech-stack'
    },
    {
      id: '2',
      title: '사용자의 눈과 마음으로',
      description: '사용자 경험을 최우선으로 생각하며, 직관적이고 아름다운 인터페이스를 만듭니다. 개발 시 성능 최적화와 직관성있는 디자인을 함께 고려합니다.',
      imagePlaceholder: 'ux-focus'
    },
    {
      id: '3',
      title: '원활한 소통과 협업 역량',
      description: '팀원들과 적극적으로 소통하며, 협업 도구를 활용해 효율적으로 일합니다. 코드 리뷰와 문서화를 통해 팀의 생산성을 높입니다.',
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
      organization: '한국산업인력공단',
      date: '2025. 03',
      validUntil: '2027. 03',
    },
    {
      id: '2',
      name: 'TOEIC 850',
      organization: 'Amazon Web Services',
      date: '2024. 03',
      validUntil: '2026. 03',
    },
  ];
  