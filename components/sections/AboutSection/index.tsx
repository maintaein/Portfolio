'use client';

import { useState } from 'react';
import { useIntersection } from '@/hooks';
import type { CoreValue } from '@/types';
import { coreValues } from '@/lib/data';
import { TechParticleStorm, EmpathyRadar, CollaborationMesh } from '@/components/blocks';
import { DotPattern, TiltCard, BlurFade } from '@/components/ui';

export default function AboutSection() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-white via-gray-50 to-white overflow-hidden"
    >
      {/* Dot Pattern 배경 */}
      <DotPattern
        className="absolute inset-0"
        dotSize={1.5}
        dotColor="rgba(0, 0, 0, 0.08)"
        gap={24}
        fade={true}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <HeaderSection />

        <div className="space-y-16 sm:space-y-20 lg:space-y-24">
          {coreValues.map((value, index) => (
            <CoreValueCard key={value.id} value={value} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HeaderSection() {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.5,
    freezeOnceVisible: true
  });
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const githubUrl = 'https://github.com/maintaein';
  const email = 'vostmfvostmf@naver.com';

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(type);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleLinkClick = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div
      ref={ref}
      className={`text-center mb-16 sm:mb-20 lg:mb-24 transition-all duration-1000 ${
        isIntersecting
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
      }`}
    >
      <h2
        id="about-heading"
        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8"
      >
        About{' '}
        <span className="bg-gradient-to-r from-blue-600 to-blue-300 bg-clip-text text-transparent">
          Kim Taein
        </span>
      </h2>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-8">
        {/* GitHub */}
        <div className="flex items-center gap-2 group">
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          <button
            onClick={() => handleLinkClick(githubUrl)}
            className="text-sm sm:text-base md:text-lg text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium underline decoration-gray-300 hover:decoration-blue-600 underline-offset-4"
          >
            {githubUrl}
          </button>
          <button
            onClick={() => handleCopy(githubUrl, 'github')}
            className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title="Copy GitHub URL"
          >
            {copiedItem === 'github' ? (
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-gray-300"></div>

        {/* Email */}
        <div className="flex items-center gap-2 group">
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <button
            onClick={() => (window.location.href = `mailto:${email}`)}
            className="text-sm sm:text-base md:text-lg text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium underline decoration-gray-300 hover:decoration-blue-600 underline-offset-4"
          >
            {email}
          </button>
          <button
            onClick={() => handleCopy(email, 'email')}
            className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            title="Copy Email"
          >
            {copiedItem === 'email' ? (
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CoreValueCardProps {
  value: CoreValue;
  index: number;
}

function CoreValueCard({ value, index }: CoreValueCardProps) {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.2,
    freezeOnceVisible: true
  });

  return (
    <BlurFade delay={0.2 + index * 0.2} inView={true}>
      <div
        ref={ref}
        className={`flex flex-col lg:flex-row gap-8 lg:gap-12 items-center ${
          isIntersecting ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 3D Tilt Card - 비주얼 */}
        <div className="w-full lg:w-1/2">
          <TiltCard
            className="w-full"
            tiltMaxAngle={10}
            scale={1.02}
            glareEnable={true}
            glareMaxOpacity={0.15}
          >
            <div className="relative aspect-square max-w-[500px] mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
              <div className="absolute inset-0">
                {value.imagePlaceholder === 'tech-stack' && <TechParticleStorm />}
                {value.imagePlaceholder === 'ux-focus' && <EmpathyRadar />}
                {value.imagePlaceholder === 'collaboration' && <CollaborationMesh />}
              </div>
            </div>
          </TiltCard>
        </div>

        {/* 3D Tilt Card - 텍스트 */}
        <div className="w-full lg:w-1/2">
          <TiltCard
            className="w-full"
            tiltMaxAngle={8}
            scale={1.01}
            glareEnable={true}
            glareMaxOpacity={0.1}
          >
            <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-10 lg:p-12 border border-gray-200 hover:shadow-2xl transition-shadow duration-300">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">
                {value.title}
              </h3>
              <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed">
                {value.description}
              </p>
            </div>
          </TiltCard>
        </div>
      </div>
    </BlurFade>
  );
}
