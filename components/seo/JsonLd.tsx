export default function JsonLd() {
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: '김태인',
    jobTitle: 'Frontend Developer',
    url: 'https://kimtaein.vercel.app',
    sameAs: [
      'https://github.com/maintaein',
    ],
    knowsAbout: [
      'React',
      'Next.js',
      'TypeScript',
      'JavaScript',
      'Tailwind CSS',
      'React Query',
      'Zustand',
      'Kotlin',
      'Jetpack Compose',
      'Android Development',
      'Frontend Development',
      'Web Development',
      'UI/UX',
    ],
    alumniOf: {
      '@type': 'Organization',
      name: '삼성청년SW아카데미',
    },
    award: [
      '삼성청년SW아카데미 자율프로젝트 우수상',
      '삼성청년SW아카데미 특화프로젝트 우수상',
      '한국경제 SW개발 경진대회 장려상',
    ],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '김태인의 프론트엔드 포트폴리오',
    url: 'https://kimtaein.vercel.app',
    description: '사용자 경험을 최우선으로 생각하는 프론트엔드 개발자 김태인의 포트폴리오',
    author: {
      '@type': 'Person',
      name: '김태인',
    },
    inLanguage: 'ko-KR',
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://kimtaein.vercel.app',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'About',
        item: 'https://kimtaein.vercel.app#about',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Skills',
        item: 'https://kimtaein.vercel.app#skills',
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: 'Projects',
        item: 'https://kimtaein.vercel.app#projects',
      },
      {
        '@type': 'ListItem',
        position: 5,
        name: 'Awards & Certificates',
        item: 'https://kimtaein.vercel.app#awards-certificates',
      },
      {
        '@type': 'ListItem',
        position: 6,
        name: 'Experience',
        item: 'https://kimtaein.vercel.app#experience',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
