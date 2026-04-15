// app/page.tsx
'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/blocks/Navigation';
import { HeroSection } from '@/components/sections';

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

const SECTION_DELAYS = [0.1, 0.22, 0.34, 0.46, 0.58];

export default function Home() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [burstPhase, setBurstPhase] = useState<'idle' | 'burst' | 'done'>('idle');

  const navigationItems = [
    { label: 'About',       href: '#about',               id: 'about' },
    { label: 'Skills',      href: '#skills',              id: 'skills' },
    { label: 'Projects',    href: '#projects',            id: 'projects' },
    { label: 'Awards',      href: '#awards-certificates', id: 'awards-certificates' },
    { label: 'Experiences', href: '#experience',          id: 'experience' },
  ];

  const handleUnlock = useCallback(() => {
    setBurstPhase('burst');
    setTimeout(() => {
      setBurstPhase('done');
      setIsUnlocked(true);
    }, 1600);
  }, []);

  return (
    <>
      <AnimatePresence>
        {isUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Navigation items={navigationItems} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* overflow-hidden으로 y 이동 중 스크롤바 이중 생성 방지 */}
      <main style={{ overflowX: 'hidden', overflowY: 'clip' }}>
        <HeroSection onUnlock={handleUnlock} burstPhase={burstPhase} />

        {/* 섹션 언락 후 stagger 등장 — overflow clip으로 감싸 임시 높이 제거 */}
        {isUnlocked && (
          <div style={{ overflow: 'hidden' }}>
            {[
              <AboutSection key="about" />,
              <SkillsSection key="skills" />,
              <ProjectsSection key="projects" />,
              <AwardAndCertificatesSection key="awards" />,
              <ExperienceSection key="experience" />,
            ].map((Section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.75,
                  delay: SECTION_DELAYS[i],
                  ease: 'easeOut',
                }}
              >
                {Section}
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
