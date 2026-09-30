import { Experience } from "@/types";

export const experiences: Experience[] = [
    {
      id: '1',
      company: 'FASOO',
      logo: 'FASOO',
      position: 'SW엔지니어 / 사원',
      period: '2025년 8월 ~ 현재',
      type: 'full-time',
      description: '파수의 풀스택 SW 엔지니어로서 파수의 솔루션 개발 및 고객사 기술 지원을 수행하고 있습니다.',
      responsibilities: [
        '파수 솔루션 개발 및 고도화(FILM, FED 담당)',
        '고객사 기술 지원, 솔루션 운영 및 유지보수',
        '소스코드/앱 보안 취약점 진단 및 개선'
      ],
      skills: ['Java', 'SQL', 'Spring Framework', 'React', 'Typescript', 'Linux', 'AI Workflow']
    },
    {
      id: '2',
      company: '삼성청년SW아카데미',
      logo: 'SSAFY',
      position: '웹 개발 / 교육생',
      period: '2024년 7월 ~ 2025년 6월',
      type: 'student',
      description: '삼성전자 주관 SW 교육을 이수했습니다. 코딩 및 알고리즘, 웹 개발에 대해 학습하고 프로젝트를 진행했습니다',
      responsibilities: [
        'Java 문법, 알고리즘, 객체지향 학습',
        '데이터베이스, SQL언어, MySQL 학습',
        'HTML/CSS/JS 학습',
        'AI 기초(통계, 데이터 분석) 및 AI 기술(머신러닝, 딥러닝) 학습',
        '웹 개발 프레임워크(Spring Framework, Vue) 학습 및 실습',
        '웹 개발 라이브러리(React) 학습 및 실습'
      ],
      skills: ['React', 'Typescript', 'Javascript', 'HTML', 'CSS', 'Java', 'MySQL', 'Spring Framework', 'AI']
    },
    {
      id: '3',
      company: '지능정보SW아카데미',
      logo: 'KUA',
      position: 'AI 개발 / 교육생',
      period: '2024년 3월 ~ 2024년 6월',
      type: 'student',
      description: '고려대학교 주관 SW 및 AI 교육을 이수했습니다. 머신러닝과 딥러닝에 대해 학습하고 프로젝트를 진행했습니다.',
      responsibilities: [
        'Python 문법, 알고리즘 학습',
        '데이터 분석 도구 Pandas, Numpy 학습',
        '머신러닝 알고리즘(linear regression, SVM 등) 학습',
        '딥러닝 알고리즘(CNN 등) 학습 및 실습'
      ],
      skills: ['Python', 'Pandas', 'Numpy', 'Scikit-learn', 'Pytorch', 'Machine Learning', 'Deep Learning']
    }

];
  