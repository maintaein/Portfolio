
export const PERSONAL_INFO = {
    NAME: '김태인',
    NAME_EN: 'KIM TAEIN',
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
    { id: SECTION_IDS.PROJECTS, label: 'Projects', href: `#${SECTION_IDS.PROJECTS}`, revealDelay: 0.22 },
    {
      id: SECTION_IDS.EXPERIENCE,
      label: 'Experience',
      href: `#${SECTION_IDS.EXPERIENCE}`,
      revealDelay: 0.34,
    },
    { id: SECTION_IDS.SKILLS, label: 'Skills', href: `#${SECTION_IDS.SKILLS}`, revealDelay: 0.46 },
    {
      id: SECTION_IDS.AWARDS_CERTIFICATES,
      label: 'Awards',
      href: `#${SECTION_IDS.AWARDS_CERTIFICATES}`,
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

  // 부팅 안무(BootSequence)와 배경(HyperspeedBackground)이 각자 소유한 두
  // GSAP 타임라인/카메라 애니메이션이 같은 총 길이를 참조해야 "하나의
  // 제스처"로 읽힌다(부팅 안무 브리프 1절). 값을 두 파일에 따로 하드코딩하면
  // 나중에 한쪽만 바뀌어 어긋나기 쉬우므로 여기 하나로 둔다.
  export const BOOT_DURATION_SECONDS = 2;

// 첫 진입 hero. overview에서 처음 섹션으로 넘어갈 때 배경이 흐림에서
// 풀리며 오버뷰 밝기로 떠오르고, 밀도와 속도가 치솟았다가, 섹션 밝기까지
// 서서히 어두워지면서 속도도 가라앉는다. 그 어두워짐이 끝나는 순간에 셸과
// 섹션 내용이 들어온다. HomeClient가 단계(HeroPhase)를 소유하고,
// HyperspeedBackground가 반응하며, CSS 지연(--hero-delay)도 같은 숫자를
// 쓴다. 셋이 각자 숫자를 들고 있으면 한쪽만 바뀌어 어긋나므로 여기 하나로
// 둔다.
//
// HERO_SURGE_MS: 배경이 떠올라 상한 속도까지 오르는 구간. 떠오르는 전환
//   자체는 모달 복귀와 같은 --animate-duration-slow이고, 나머지는 속도가
//   차오르는 시간이다.
// HERO_DIM_MS: 섹션 밝기까지 어두워지는 전환의 길이. settle이 시작될 때
//   같이 시작하므로 셸과 섹션이 기다리는 지연은 SURGE + DIM이다.
// HERO_SETTLE_MS: settle 단계 자체의 길이. DIM이 끝난 뒤로도 지연된 진입
//   전환(섹션 500ms, 워드마크 FLIP 500ms, 그 뒤 내비 스트립 300ms)이 전부
//   끝날 때까지 --hero-delay를 유지해야 한다. 도중에 변수가 빠지면
//   animation-delay가 0으로 바뀌어 아직 도는 애니메이션이 끝 상태로 튄다.
// HYPERSPEED_BOOST_TIME_SCALE: 섹션 전환의 boost가 더하는 시간 배속이자
//   hero가 오르는 속도의 상한. 두 곳이 같은 숫자를 봐야 첫 진입의 최고
//   속도와 그 뒤 전환의 속도가 한 몸으로 읽힌다. 엔진과 배경 래퍼 양쪽이
//   읽으므로 엔진 모듈이 아니라 여기 산다(래퍼는 엔진을 동적으로만 불러
//   온다).
// HYPERSPEED_DENSITY_POOL: 엔진이 lightPairsPerRoadWay의 몇 배를 미리
//   만들어 두는지. 기본은 그중 1/POOL만 보이고 surge에서 전부 보인다.
//   기하를 다시 만들지 않고 밀도를 올리려면 여유분이 있어야 한다.
export const HERO_SURGE_MS = 1000;
export const HERO_DIM_MS = 800;
export const HERO_SETTLE_MS = 1800;
export const HYPERSPEED_BOOST_TIME_SCALE = 0.55;
export const HYPERSPEED_DENSITY_POOL = 2;
export type HeroPhase = 'pending' | 'surge' | 'settle' | 'done';
