// app/page.tsx
'use client';

import dynamic from 'next/dynamic';
import Navigation from '@/components/blocks/Navigation';
import { HeroSection } from '@/components/sections';

// 동적 Import로 번들 크기 최적화
const AboutSection = dynamic(() => import('@/components/sections/AboutSection'), {
  loading: () => <div className="min-h-[600px]" />,
});

const SkillsSection = dynamic(() => import('@/components/sections/SkillsSection'), {
  loading: () => <div className="min-h-[400px]" />,
});

const ProjectsSection = dynamic(() => import('@/components/sections/ProjectsSection'), {
  loading: () => <div className="min-h-[600px]" />,
});

const AwardAndCertificatesSection = dynamic(() => import('@/components/sections/AwardAndCertificatesSection'), {
  loading: () => <div className="min-h-[400px]" />,
});

const ExperienceSection = dynamic(() => import('@/components/sections/ExperienceSection'), {
  loading: () => <div className="min-h-[400px]" />,
});

export default function Home() {
  // href는 section id를 #로 시작하는 형식으로, id는 useScroll에 사용
  const navigationItems = [
    { label: 'About', href: '#about', id: 'about' },
    { label: 'Skills', href: '#skills', id: 'skills' },
    { label: 'Projects', href: '#projects', id: 'projects' },
    { label: 'Awards', href: '#awards-certificates', id: 'awards-certificates' },
    { label: 'Experiences', href: '#experience', id: 'experience' }
  ];

  return (
    <>
      <Navigation items={navigationItems} />

      <main className="overflow-x-hidden">
        <HeroSection />

        <AboutSection />

        <SkillsSection />

        <ProjectsSection />

        <AwardAndCertificatesSection />

        <ExperienceSection />

      </main>

    </>
  );
}