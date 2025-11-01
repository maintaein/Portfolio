// app/page.tsx
'use client';

import Navigation from '@/components/blocks/Navigation';
import {
  HeroSection,
  AboutSection,
  SkillsSection,
  ExperienceSection,
  AwardAndCertificateSection,
  ProjectsSection,
} from '@/components/sections';

export default function Home() {
  // 💡 Navigation에 전달할 아이템 배열
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

      <main className="">
        <HeroSection />

        <AboutSection />

        <SkillsSection />

        <ProjectsSection />

        <AwardAndCertificateSection />

        <ExperienceSection />

      </main>

    </>
  );
}