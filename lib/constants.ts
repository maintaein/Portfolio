
export const PERSONAL_INFO = {
    NAME: '김태인',
    NAME_EN: 'Taein Kim',
    ROLE: '프론트엔드 개발자',
    DESCRIPTION: '항상 사용자의 눈과 마음을 고려하는 프론트엔드 개발자',
    EMAIL: 'vostmfvostmf@naver.com',
    GITHUB: 'https://github.com/maintaein',
    LOCATION: '대한민국',
  } as const;
  
  export const SECTION_IDS = {
    HERO: 'hero',
    ABOUT: 'about',
    SKILLS: 'skills',
    PROJECTS: 'projects',
    EXPERIENCE: 'experience',
    CONTACT: 'contact',
  } as const;
  
  export const NAV_ITEMS = [
    { id: SECTION_IDS.HERO, label: 'Home' },
    { id: SECTION_IDS.ABOUT, label: 'About' },
    { id: SECTION_IDS.SKILLS, label: 'Skills' },
    { id: SECTION_IDS.PROJECTS, label: 'Projects' },
    { id: SECTION_IDS.EXPERIENCE, label: 'Experience' },
    { id: SECTION_IDS.CONTACT, label: 'Contact' },
  ] as const;
  
  export const SOCIAL_LINKS = {
    GITHUB: 'https://github.com/maintaein',
    EMAIL: 'mailto:vostmfvostmf@naver.com',
  } as const;
  
  export const ANIMATION = {
    DURATION: 300, 
    EASING: 'ease-in-out',
    SCROLL_OFFSET: 80, 
    SCROLL_BEHAVIOR: 'smooth',
  } as const;
  
  export const BREAKPOINTS = {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536,
  } as const;
  
  export const SITE_CONFIG = {
    TITLE: '김태인 | 프론트엔드 개발자',
    TITLE_TEMPLATE: '%s | 김태인',
    DESCRIPTION:
      '항상 사용자의 눈과 마음을 고려하는 프론트엔드 개발자 김태인의 포트폴리오입니다. Next.js, React, TypeScript를 사용합니다.',
    KEYWORDS: [
      '김태인',
      'Taein Kim',
      '프론트엔드 개발자',
      'Frontend Developer',
      'React',
      'Next.js',
      'TypeScript',
      '포트폴리오',
      'Portfolio',
    ],
    URL: 'https://your-domain.com', 
    LOCALE: 'ko_KR',
    OG_IMAGE: '/og-image.png', 
  } as const;
  
  export const SKILL_CATEGORIES = {
    FRONTEND: 'Frontend',
    BACKEND: 'Backend',
    TOOLS: 'Tools',
    LANGUAGE: 'Language',
  } as const;
  
  export const PROJECT_CATEGORIES = {
    WEB: 'Web',
    MOBILE: 'Mobile',
    LIBRARY: 'Library',
    TOY: 'Toy Project',
  } as const;
  
  export const EXPERIENCE_TYPES = {
    WORK: '업무',
    EDUCATION: '교육',
    PROJECT: '프로젝트',
    ACTIVITY: '활동',
  } as const;
  
  export const CONTACT_METHODS = [
    {
      type: 'email',
      label: 'Email',
      value: PERSONAL_INFO.EMAIL,
      href: SOCIAL_LINKS.EMAIL,
      icon: 'envelope', 
    },
    {
      type: 'github',
      label: 'GitHub',
      value: '@maintaein',
      href: SOCIAL_LINKS.GITHUB,
      icon: 'github',
    },
  ] as const;
  
  export const SECTION_TITLES = {
    [SECTION_IDS.HERO]: '환영합니다',
    [SECTION_IDS.ABOUT]: 'About Me',
    [SECTION_IDS.SKILLS]: 'Skills',
    [SECTION_IDS.PROJECTS]: 'Projects',
    [SECTION_IDS.EXPERIENCE]: 'Experience',
    [SECTION_IDS.CONTACT]: 'Contact',
  } as const;
  
  export const THEME = {
    LIGHT: 'light',
    DARK: 'dark',
  } as const;