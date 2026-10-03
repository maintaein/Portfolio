import { Award, Certificate, Contact, CoreValue } from "@/types";

export const coreValues: CoreValue[] = [
    {
      id: '1',
      title: '기본을 튼튼히 길러온 개발자',
      label: 'BASICS',
      description: '약 2년 반 동안 개발 기초를 쌓고 프로젝트에 활용했습니다.\n\nWebGL 배경을 지연 로딩해 First Load JS를 369.7KB에서 166.3KB로 55% 줄여 LightHouse Performance를 90점 이상으로 개선했습니다.',
      logoSrc: '/icons-mono/react.svg',
      evidenceStyle: 'metric',
      evidence: [
        { label: '개발 경험', value: '2년 6개월' },
        { label: '주요 스택', value: 'React, TS' },
      ],
    },
    {
      id: '2',
      title: '구현 이후를 고민하는 개발자',
      label: 'QUALITY',
      description: '기능 구현을 프로젝트의 끝이라고 생각하지 않습니다.\n\n 파수에서 JS로 구현된 관리자페이지를 TS로 고도화해 타입 안정성을 확보하였으며, 반복적인 버전 업그레이드 작업의 효율성을 높였습니다.',
      logoSrc: '/about/fixtool.webp',
      evidenceStyle: 'metric',
      evidence: [
        { label: '타입 오류', value: '-90%' },
        { label: '작업 시간', value: '-50%' },
      ],
    },
    {
      id: '3',
      title: '원활한 소통과 협업 역량을 가진 개발자',
      label: 'TEAMWORK',
      description: '팀이 효율적인 방식으로 일할 구조를 고민합니다.\n\nAlphamail 프로젝트에서 프론트엔드 리더를 맡아 git과 jira 컨벤션을 설정하여 팀의 협업 효율성을 끌어올린 경험이 있습니다.',
      logoSrc: '/about/handshake.webp',
      evidenceStyle: 'detail',
      evidence: [
        { label: 'ROLE', value: '프론트엔드 리더' },
        { label: 'CONVENTION', value: 'git · jira' },
      ],
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
      description: 'AI 기반 업무 자동화 웹 서비스, 프론트엔드 담당으로 수상'
    },
    {
      id: '2',
      title: '삼성청년SW아카데미 특화프로젝트',
      organization: '삼성전자',
      date: '2025. 04',
      rank: '우수상',
      project: 'ReBirth',
      logo: 'ssafy',
      description: '카드 혜택 기반으로 효율적 소비를 도와주는 모바일 금융 서비스, 프론트엔드 담당으로 수상'
    },
    {
      id: '3',
      title: '한국경제 SW개발 경진대회',
      organization: '한국경제',
      date: '2024. 06',
      rank: '장려상',
      project: 'PoseTive',
      logo: 'hankyung',
      description: '이미지의 포즈를 사용자가 그리는 대로 변환할 수 있는 AI 서비스, AI 모델링 담당으로 수상'
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
