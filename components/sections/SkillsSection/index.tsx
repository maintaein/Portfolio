'use client';

import { useState } from 'react';
import { useIntersection } from '@/hooks';
import { Paragraph, SegmentedControl } from '@/components/atoms';
import SkillItemCard from '@/components/blocks/SkillItemCard';
import { skillCategories } from '@/lib/data';

export default function SkillsSection() {
  const [selectedCategory, setSelectedCategory] = useState(skillCategories[0].id);

  // 섹션 헤더 진입 감지
  const { ref: headerRef, isIntersecting: isHeaderVisible } = useIntersection({
    threshold: 0.5,
    freezeOnceVisible: true
  });

  // 탭 컨트롤 진입 감지
  const { ref: tabRef, isIntersecting: isTabVisible } = useIntersection({
    threshold: 0.5,
    freezeOnceVisible: true
  });

  // 그리드 진입 감지
  const { ref: gridRef, isIntersecting: isGridVisible } = useIntersection({
    threshold: 0.1,
    freezeOnceVisible: true
  });

  const currentCategory = skillCategories.find(cat => cat.id === selectedCategory) || skillCategories[0];

  return (
    <section id="skills" className="py-20 px-6 bg-gradient-to-br from-grey-50 to-grey-100">
      <div className="max-w-6xl mx-auto">

        {/* 섹션 헤더 - 진입 시 애니메이션 */}
        <div
          ref={headerRef}
          className={`text-center mb-12 transition-all duration-1000 ${
            isHeaderVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <Paragraph variant="t2" weight="bold" className="mb-3">
            SKILLS
          </Paragraph>
          <Paragraph variant="t6" color="grey-600">
            다양한 기술 스택을 활용하여 문제를 해결합니다
          </Paragraph>
        </div>

        {/* SegmentedControl - 진입 시 애니메이션 */}
        <div
          ref={tabRef}
          className={`flex justify-center mb-12 transition-all duration-1000 ${
            isTabVisible
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-95'
          }`}
        >
          <SegmentedControl
            options={skillCategories.map(cat => ({
              value: cat.id,
              label: cat.label
            }))}
            value={selectedCategory}
            onChange={setSelectedCategory}
            size="large"
            fullWidth={false}
          />
        </div>

        {/* 스킬 그리드 - 진입 시 애니메이션 */}
        <div ref={gridRef}>
          <div
            key={currentCategory.id}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {currentCategory.skills.map((skill, index) => (
              <SkillItemCard
                key={`${skill.name}-${index}`}
                name={skill.name}
                icon={skill.icon}
                experience={skill.experience}
                animationDelay={isGridVisible ? index * 50 : 0}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        :global(.animate-fade-in) {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </section>
  );
}
