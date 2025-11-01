'use client';

import { useState } from 'react';
import { useIntersection } from '@/hooks';
import { CoreValue } from '@/types';
import { coreValues } from '@/lib/data';
import { TechParticleStorm, EmpathyRadar, CollaborationMesh } from '@/components/blocks';

export default function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-heading" className="py-16 sm:py-20 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* 상단: 타이틀 & 소개 - 섹션 진입 시 fadeIn */}
        <HeaderSection />

        {/* 하단: 3가지 핵심 역량 - 각각 스크롤 애니메이션 */}
        <div className="space-y-12 sm:space-y-16 lg:space-y-20">
          {coreValues.map((value, index) => (
            <CoreValueCard key={value.id} value={value} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

// 💡 헤더 섹션 - 섹션 진입 시 애니메이션
function HeaderSection() {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.5,
    freezeOnceVisible: true
  });
  const [clickedLink, setClickedLink] = useState<string | null>(null);

  const handleLinkClick = (url: string, linkId: string) => {
    setClickedLink(linkId);
    window.open(url, '_blank');
    setTimeout(() => setClickedLink(null), 300);
  };

  const handleEmailClick = (linkId: string) => {
    setClickedLink(linkId);
    window.location.href = 'mailto:vostmfvostmf@naver.com';
    setTimeout(() => setClickedLink(null), 300);
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
      <h2 id="about-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8">
        About{' '}
        <span className="bg-gradient-to-r from-blue-600 to-blue-300 bg-clip-text text-transparent">
          Kim Taein
        </span>
      </h2>

      {/* Contact Links */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={() => handleLinkClick('https://github.com/maintaein', 'github')}
          className={`inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-md hover:shadow-lg ${
            clickedLink === 'github' ? 'scale-95' : ''
          }`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold">GitHub</span>
        </button>

        <button
          onClick={() => handleEmailClick('email')}
          className={`inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg ${
            clickedLink === 'email' ? 'scale-95' : ''
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="font-semibold">Email</span>
        </button>
      </div>
    </div>
  );
}

// 💡 핵심 역량 카드 - 각각 개별 애니메이션
interface CoreValueCardProps {
  value: CoreValue;
  index: number;
}

function CoreValueCard({ value, index }: CoreValueCardProps) {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.2,
    freezeOnceVisible: true
  });

  // 홀수/짝수에 따라 방향 결정
  const isEven = index % 2 === 0;

  return (
    <div
      ref={ref}
      className={`flex flex-col ${
        isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'
      } gap-8 lg:gap-12 items-center transition-all duration-1000 transform ${
        isIntersecting 
          ? 'opacity-100 translate-x-0' 
          : isEven
            ? 'opacity-0 -translate-x-12'
            : 'opacity-0 translate-x-12'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      {/* 애니메이션 영역 */}
      <div className="w-full lg:w-1/2">
        <div className="relative aspect-[5/4]">
          {value.imagePlaceholder === 'tech-stack' && <TechParticleStorm />}
          {value.imagePlaceholder === 'ux-focus' && <EmpathyRadar />}
          {value.imagePlaceholder === 'collaboration' && <CollaborationMesh />}
        </div>
      </div>

      {/* 텍스트 영역 */}
      <div className="w-full lg:w-1/2 space-y-4">
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
          {value.title}
        </h3>
        <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed">
          {value.description}
        </p>
      </div>
    </div>
  );
}