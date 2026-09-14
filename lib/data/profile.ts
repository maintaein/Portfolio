import { Award, Certificate, Contact, CoreValue } from "@/types";

export const coreValues: CoreValue[] = [
    {
      id: '1',
      title: '기본을 튼튼히 길러온 개발자',
      label: 'BASICS',
      description: '약 2년 반의 기간 동안 학습과 6개의 프로젝트를 거치며 react, typescript 등 프론트엔드 역량을 꾸준히 쌓아왔습니다. 이를 기반으로 쇼핑몰 구축 프로젝트에서 AI가 작성한 코드를 분석하여 관리자 페이지의 상태 오류를 조기에 잡아내었습니다.',
      imagePlaceholder: 'tech-stack'
    },
    {
      id: '2',
      title: 'AI를 이해하고 활용하는 개발자',
      label: 'AI WORKFLOW',
      description: 'AI에 대한 이해를 바탕으로 프로젝트에 도입하여 효율성을 끌어올렸습니다. AI 각각의 subagent가 맡은 작업의 범위를 벗어나지 않으면서도, 해당 작업에서 기대한 결과를 내도록 skill.md를 작성하여 적용했습니다. AI의 코드를 직접 작성했다면 18,230줄의 코드를 작성해야 했으며, 이는 작성 코드의 약2배의 양입니다.',
      imagePlaceholder: 'AI-Workflow'
    },
    {
      id: '3',
      title: '원활한 소통과 협업 역량을 가진 개발자',
      label: 'TEAMWORK',
      description: '팀이 효율적인 방식으로 일할 구조를 고민합니다. Alphamail 프로젝트에서 프론트엔드 리더를 맡아 git과 jira 컨벤션을 설정하여 팀의 협업 효율성을 끌어올린 경험이 있습니다.',
      imagePlaceholder: 'collaboration'
    }
  ];
  

export const awards: Award[] = [
    {
      id: '1',
      title: '삼성청년SW아카데미 자율프로젝트',
      organization: '삼성전자',
      date: '2025. 05',
      rank: '우수상',
      project: 'AlphaMail',
      logo: 'ssafy',
      description: 'AI 기반 업무 자동화 웹 서비스의 프론트엔드 담당으로 수상'
    },
    {
      id: '2',
      title: '삼성청년SW아카데미 특화프로젝트',
      organization: '삼성전자',
      date: '2025. 04',
      rank: '우수상',
      project: 'ReBirth',
      logo: 'ssafy',
      description: '카드 혜택 기반으로 효율적 소비를 도와주는 모바일 금융 서비스의 프론트엔드 담당으로 수상'
    },
    {
      id: '3',
      title: '한국경제 SW개발 경진대회',
      organization: '한국경제',
      date: '2024. 06',
      rank: '장려상',
      project: 'PoseTive',
      logo: 'hankyung',
      description: '이미지의 포즈를 사용자가 그리는 대로 변환할 수 있는 AI 서비스'
    },
  ];
  
export const certificates: Certificate[] = [
    {
      id: '1',
      name: 'OPIC',
      organization: 'ACTFL',
      date: '2025. 03',
      grade: 'IH',
      logo: 'opic',
      validUntil: '2027. 03',
    },
  ];

export const contact: Contact = {
  name: '김태인',
  email: 'vostmfvostmf@naver.com',
  githubUrl: 'https://github.com/maintaein',
};
