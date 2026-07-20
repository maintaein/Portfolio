
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
    AWARDS_CERTIFICATES: 'awards-certificates',
    EXPERIENCE: 'experience',
  } as const;

  // Hero 완료 후 표시되는 섹션의 순서, navigation 정보, 등장 지연을 한곳에서 관리한다.
  export const HOME_SECTION_CONFIG = [
    { id: SECTION_IDS.ABOUT, label: 'About', href: `#${SECTION_IDS.ABOUT}`, revealDelay: 0.1 },
    { id: SECTION_IDS.SKILLS, label: 'Skills', href: `#${SECTION_IDS.SKILLS}`, revealDelay: 0.22 },
    { id: SECTION_IDS.PROJECTS, label: 'Projects', href: `#${SECTION_IDS.PROJECTS}`, revealDelay: 0.34 },
    {
      id: SECTION_IDS.AWARDS_CERTIFICATES,
      label: 'Awards',
      href: `#${SECTION_IDS.AWARDS_CERTIFICATES}`,
      revealDelay: 0.46,
    },
    {
      id: SECTION_IDS.EXPERIENCE,
      label: 'Experiences',
      href: `#${SECTION_IDS.EXPERIENCE}`,
      revealDelay: 0.58,
    },
  ] as const;

  export type HomeSectionConfig = (typeof HOME_SECTION_CONFIG)[number];
  export type HomeSectionId = HomeSectionConfig['id'];
  export type NavigationItem = Pick<HomeSectionConfig, 'id' | 'label' | 'href'>;

  export const NAV_ITEMS: readonly NavigationItem[] = HOME_SECTION_CONFIG.map(
    ({ id, label, href }) => ({ id, label, href }),
  );
  
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
  
  export const THEME = {
    LIGHT: 'light',
    DARK: 'dark',
  } as const;
