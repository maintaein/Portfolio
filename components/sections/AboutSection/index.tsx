'use client';

import { motion } from 'framer-motion';
import { CoreValue } from '@/types';
import { coreValues, contact } from '@/lib/data';
import { useCopyToClipboard } from '@/hooks';
import { GitHubIcon } from '@/components/atoms';
import { TechParticleStorm, EmpathyRadar, CollaborationMesh } from '@/components/blocks';
import { SECTION_IDS } from '@/lib/constants';

export default function AboutSection() {
  return (
    <section id={SECTION_IDS.ABOUT} aria-labelledby="about-heading" className="py-16 sm:py-20 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <HeaderSection />

        <div className="space-y-20 sm:space-y-24 lg:space-y-32">
          {coreValues.map((value, index) => (
            <CoreValueCard key={value.id} value={value} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HeaderSection() {
  const { copiedKey, copy } = useCopyToClipboard();

  const handleLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      className="text-center mb-16 sm:mb-20 lg:mb-28"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 id="about-heading" className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8">
        About{' '}
        <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
          Kim Taein
        </span>
      </h2>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-8">
        {/* GitHub */}
        <div className="flex items-center gap-2 group">
          <GitHubIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 flex-shrink-0" width={24} height={24} />
          <button
            onClick={() => handleLinkClick(contact.githubUrl)}
            className="text-sm sm:text-base md:text-lg text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium underline decoration-gray-300 hover:decoration-blue-600 underline-offset-4"
          >
            {contact.githubUrl}
          </button>
          <button
            onClick={() => copy(contact.githubUrl, 'github')}
            className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title="Copy GitHub URL"
          >
            {copiedKey === 'github' ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>

        <div className="hidden sm:block w-px h-6 bg-gray-300" />

        {/* Email */}
        <div className="flex items-center gap-2 group">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <button
            onClick={() => copy(contact.email, 'email')}
            className="text-sm sm:text-base md:text-lg text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium underline decoration-gray-300 hover:decoration-blue-600 underline-offset-4"
          >
            {contact.email}
          </button>
          <button
            onClick={() => copy(contact.email, 'email')}
            className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title="Copy Email"
          >
            {copiedKey === 'email' ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const ORDINALS = ['01', '02', '03'];

interface CoreValueCardProps {
  value: CoreValue;
  index: number;
}

function CoreValueCard({ value, index }: CoreValueCardProps) {
  const isEven = index % 2 === 0;

  return (
    <motion.div
      className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 lg:gap-16 items-center group`}
      initial={{ opacity: 0, x: isEven ? -40 : 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* 비주얼 영역 */}
      <motion.div
        className="w-full lg:w-1/2"
        whileHover={{ scale: 1.015 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="relative aspect-square max-w-[500px] mx-auto">
          {value.imagePlaceholder === 'tech-stack' && <TechParticleStorm />}
          {value.imagePlaceholder === 'ux-focus' && <EmpathyRadar />}
          {value.imagePlaceholder === 'collaboration' && <CollaborationMesh />}
        </div>
      </motion.div>

      {/* 텍스트 영역 */}
      <div className="w-full lg:w-1/2 space-y-5 relative">
        {/* 대형 배경 순번 — 장식용, 텍스트 뒤에 깔림 */}
        <span
          className="absolute -top-6 -left-2 text-[7rem] sm:text-[9rem] font-black leading-none select-none pointer-events-none"
          style={{ color: 'rgba(49,130,246,0.055)' }}
          aria-hidden="true"
        >
          {ORDINALS[index]}
        </span>

        <div className="relative">
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            {value.title}
          </h3>
        </div>

        <p className="text-base sm:text-lg text-gray-500 leading-relaxed">
          {value.description}
        </p>
      </div>
    </motion.div>
  );
}
