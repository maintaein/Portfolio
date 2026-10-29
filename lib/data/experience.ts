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
      skills: ['Java', 'SQL', 'Spring Framework', 'React', 'Typescript', 'Linux', 'AI Workflow'],
      metrics: [
        { from: 0, to: -30, suffix: '%', label: '장애 발생률 평균' },
        { from: 20, to: 3, suffix: '분', label: '장애 시 평균 복구 시간 (20분 → 3분)' }
      ],
      evidence: [
        {
          demo: 'inspect',
          label: '자동 정기점검 툴',
          wide: true,
          summary: 'CPU, 메모리, 디스크 용량, 에러 로그, 암/복호화 사용량을 차례로 점검하고 암/복호화 사용량에서 이상치를 찾는다. 도입 뒤 장애 발생률은 평균 30% 줄고 장애 시 평균 복구 시간은 20분에서 3분이 됐다.'
        },
        {
          demo: 'security',
          label: '보안 취약점 진단',
          note: '소스코드 · 앱 진단과 개선',
          wide: true,
          summary: '소스코드와 앱의 보안 취약점을 항목별로 진단하고, 취약한 항목을 개선한다.'
        }
      ],
      highlight: '자동 정기점검 툴 개발로 장애 발생률 평균 30% 하락, 장애 시 평균 복구 시간 20분 → 3분'
    },
    {
      id: '2',
      company: '삼성청년SW아카데미',
      logo: 'SSAFY',
      position: '웹 개발 / 교육생',
      period: '2024년 7월 ~ 2025년 6월',
      type: 'student',
      description: '삼성전자 주관 SW 교육을 이수했습니다. 코딩 및 알고리즘, 웹 개발에 대해 학습하고 프로젝트를 진행했습니다.',
      responsibilities: [
        'Java 문법, 알고리즘, 객체지향 학습',
        '데이터베이스, SQL언어, MySQL 학습',
        'HTML/CSS/JS 학습',
        'AI 기초(통계, 데이터 분석) 및 AI 기술(머신러닝, 딥러닝) 학습',
        '웹 개발 프레임워크(Spring Framework, Vue) 학습 및 실습',
        '웹 개발 라이브러리(React) 학습 및 실습'
      ],
      skills: ['React', 'Typescript', 'Javascript', 'HTML', 'CSS', 'Java', 'MySQL', 'Spring Framework', 'AI'],
      metrics: [
        { from: 0, to: 1620, suffix: 'h', label: '학습 시간' },
        { from: 0, to: 2, suffix: '회', label: '우수상 수상' }
      ],
      evidence: [
        {
          demo: 'calendar',
          label: '1년의 학습 기록',
          note: '2024년 7월 ~ 2025년 6월 · 총 1620시간',
          wide: true,
          summary: '2024년 7월 Java, 8월 알고리즘, 9월 MySQL, 10월 JavaScript와 Spring, 11~12월 Spring과 Vue 프로젝트, 2025년 1~5월 React와 TypeScript로 Ttabong, ReBirth, AlphaMail 프로젝트, 6월 AI를 학습했다.'
        }
      ],
      highlight: '우수상 2회 수상, 학습 1620시간'
    },
    {
      id: '3',
      company: '지능정보SW아카데미',
      logo: 'KUA',
      position: 'AI 개발 / 교육생 · 고려대학교 주관',
      period: '2024년 3월 ~ 2024년 6월',
      type: 'student',
      description: '고려대학교 주관 SW 및 AI 교육을 이수했습니다. 머신러닝과 딥러닝에 대해 학습하고 프로젝트를 진행했습니다.',
      responsibilities: [
        'Python 문법, 알고리즘 학습',
        '데이터 분석 도구 Pandas, Numpy 학습',
        '머신러닝 알고리즘(linear regression, SVM 등) 학습',
        '딥러닝 알고리즘(CNN 등) 학습 및 실습'
      ],
      skills: ['Python', 'Pandas', 'Numpy', 'Scikit-learn', 'Pytorch', 'Machine Learning', 'Deep Learning'],
      evidence: [
        {
          demo: 'loss',
          label: '학습 곡선',
          note: 'epoch마다 줄어드는 loss',
          wide: false,
          summary: 'epoch 1부터 50까지 train과 val loss 곡선이 내려간다.'
        },
        {
          demo: 'cnn',
          label: 'CNN',
          note: '커널이 만드는 특징 맵',
          wide: false,
          summary: '3×3 커널이 입력 위를 미끄러지며 특징 맵을 채운다.'
        }
      ]
    }

];
  