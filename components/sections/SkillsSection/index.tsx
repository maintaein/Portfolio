'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { SegmentedControl } from '@/components/atoms';
import { SectionHeader } from '@/components/blocks';
import { skillCategories } from '@/lib/data';

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.92 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function SkillsSection() {
  const [selectedCategory, setSelectedCategory] = useState(skillCategories[0].id);
  const [categoryKey, setCategoryKey] = useState(0);

  const currentCategory = skillCategories.find(cat => cat.id === selectedCategory) ?? skillCategories[0];

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setCategoryKey(prev => prev + 1);
  };

  return (
    <section id="skills" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-br from-grey-50 to-grey-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        <SectionHeader
          title="SKILLS"
          subtitle="다양한 기술 스택을 활용하여 문제를 해결합니다"
        />

        <motion.div
          className="flex justify-center mb-12 overflow-x-auto px-2"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <SegmentedControl
            options={skillCategories.map(cat => ({ value: cat.id, label: cat.label }))}
            value={selectedCategory}
            onChange={handleCategoryChange}
            size="large"
            fullWidth={false}
          />
        </motion.div>

        {/* 탭 전환 시 레이아웃 shift 방지 */}
        <div className="min-h-[180px] sm:min-h-[120px] flex items-start">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentCategory.id}-${categoryKey}`}
            variants={gridVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="flex flex-wrap justify-center gap-8 sm:gap-10 w-full"
          >
            {currentCategory.skills.map((skill) => (
              <motion.div
                key={skill.name}
                variants={itemVariants}
                className="group flex flex-col items-center gap-2"
              >
                {/* 아이콘 + CSS 툴팁 래퍼 */}
                <div className="relative">
                  <motion.div
                    whileHover={{ y: -5, scale: 1.12 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="w-14 h-14 sm:w-16 sm:h-16 relative cursor-pointer"
                  >
                    {skill.icon ? (
                      <Image
                        src={skill.icon}
                        alt={skill.name}
                        width={64}
                        height={64}
                        className="object-contain w-full h-full drop-shadow-sm"
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-grey-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-grey-500">{skill.name.slice(0, 2)}</span>
                      </div>
                    )}
                  </motion.div>

                  {/* CSS group-hover 툴팁 */}
                  {skill.experience && (
                    <div
                      className={[
                        'absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50',
                        'w-max max-w-[200px]',
                        'px-2.5 py-1.5 rounded-lg',
                        'bg-grey-900 text-white text-[11px] leading-snug text-center',
                        'shadow-lg pointer-events-none',
                        'opacity-0 translate-y-1',
                        'group-hover:opacity-100 group-hover:translate-y-0',
                        'transition-all duration-150 ease-out',
                      ].join(' ')}
                    >
                      {skill.experience}
                      {/* 화살표 */}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-grey-900" />
                    </div>
                  )}
                </div>

                <span className="text-xs font-medium text-grey-600 text-center leading-tight max-w-[72px]">
                  {skill.name}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
