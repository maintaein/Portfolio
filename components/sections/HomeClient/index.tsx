'use client';

import { useState, useCallback, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/blocks/Navigation';
import { Footer, HeroSection } from '@/components/sections';
import {
  HOME_SECTION_CONFIG,
  NAV_ITEMS,
  SECTION_IDS,
  type HomeSectionId,
} from '@/lib/constants';

const AboutSection = dynamic(() => import('@/components/sections/AboutSection'), {
  loading: () => <div className="min-h-[600px]" />,
});
const SkillsSection = dynamic(() => import('@/components/sections/SkillsSection'), {
  loading: () => <div className="min-h-[400px]" />,
});
const ProjectsSection = dynamic(() => import('@/components/sections/ProjectsSection'), {
  loading: () => <div className="min-h-[600px]" />,
});
const AwardAndCertificatesSection = dynamic(
  () => import('@/components/sections/AwardAndCertificatesSection'),
  { loading: () => <div className="min-h-[400px]" /> },
);
const ExperienceSection = dynamic(() => import('@/components/sections/ExperienceSection'), {
  loading: () => <div className="min-h-[400px]" />,
});

const SECTION_COMPONENTS = {
  [SECTION_IDS.ABOUT]: AboutSection,
  [SECTION_IDS.SKILLS]: SkillsSection,
  [SECTION_IDS.PROJECTS]: ProjectsSection,
  [SECTION_IDS.AWARDS_CERTIFICATES]: AwardAndCertificatesSection,
  [SECTION_IDS.EXPERIENCE]: ExperienceSection,
} satisfies Record<HomeSectionId, ComponentType>;

export default function HomeClient() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [burstPhase, setBurstPhase] = useState<'idle' | 'burst' | 'done'>('idle');

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
            <Navigation items={NAV_ITEMS} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* overflow-hidden으로 y 이동 중 스크롤바 이중 생성 방지 */}
      <main style={{ overflowX: 'hidden', overflowY: 'clip' }}>
        <HeroSection onUnlock={handleUnlock} burstPhase={burstPhase} />

        {/* 섹션 언락 후 stagger 등장 */}
        {isUnlocked && (
          <div style={{ overflow: 'hidden' }}>
            {HOME_SECTION_CONFIG.map(({ id, revealDelay }) => {
              const Section = SECTION_COMPONENTS[id];

              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.75,
                    delay: revealDelay,
                    ease: 'easeOut',
                  }}
                >
                  <Section />
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {isUnlocked && <Footer />}
    </>
  );
}
