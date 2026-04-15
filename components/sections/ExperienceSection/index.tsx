'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import Paragraph from '@/components/atoms/Paragraph/index';
import Badge from '@/components/atoms/Badge/index';
import { SectionHeader } from '@/components/blocks';
import { Experience } from '@/types';
import { typeLabels } from '@/types';
import { experiences } from '@/lib/data';

const typeColors: Record<Experience['type'], { dot: string; ring: string; badge: string }> = {
  'full-time': { dot: 'bg-blue-500',   ring: 'ring-blue-200',   badge: 'text-blue-500' },
  'intern':    { dot: 'bg-violet-500', ring: 'ring-violet-200', badge: 'text-violet-500' },
  'student':   { dot: 'bg-emerald-500',ring: 'ring-emerald-200',badge: 'text-emerald-500' },
};

export default function ExperienceSection() {
  return (
    <section id="experience" className="py-12 sm:py-16 lg:py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <SectionHeader
          title="EXPERIENCES"
          subtitle="실무와 교육을 통해 성장해왔습니다"
        />

        {/* 타임라인 컨테이너 */}
        <div className="relative">
          {/* 중앙 수직 라인 */}
          <TimelineLine count={experiences.length} />

          <div className="space-y-10 sm:space-y-14">
            {experiences.map((exp, index) => (
              <TimelineItem key={exp.id} experience={exp} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelineLine({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <div
      ref={ref}
      className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-grey-100"
      aria-hidden
    >
      <motion.div
        className="w-full bg-gradient-to-b from-blue-400 via-violet-400 to-emerald-400 origin-top"
        initial={{ scaleY: 0 }}
        animate={isInView ? { scaleY: 1 } : { scaleY: 0 }}
        transition={{ duration: count * 0.38, ease: 'easeOut', delay: 0.2 }}
        style={{ height: '100%' }}
      />
    </div>
  );
}

interface TimelineItemProps {
  experience: Experience;
  index: number;
}

function TimelineItem({ experience: exp, index }: TimelineItemProps) {
  const colors = typeColors[exp.type];
  // 짝수: 왼쪽, 홀수: 오른쪽 (데스크톱만 교차)
  const isLeft = index % 2 === 0;

  return (
    <div className="relative flex items-start gap-0 sm:gap-0">
      {/* 모바일: 좌측 dot + 우측 카드 */}
      {/* 데스크톱: 교차 레이아웃 */}

      {/* 데스크톱 왼쪽 영역 */}
      <div className="hidden sm:flex flex-1 justify-end pr-8">
        {isLeft && <CardContent exp={exp} colors={colors} index={index} />}
      </div>

      {/* 중앙 dot */}
      <div className="relative z-10 flex-shrink-0">
        <TimelineDot exp={exp} colors={colors} index={index} />
      </div>

      {/* 데스크톱 오른쪽 영역 */}
      <div className="hidden sm:flex flex-1 pl-8">
        {!isLeft && <CardContent exp={exp} colors={colors} index={index} />}
      </div>

      {/* 모바일 카드 */}
      <div className="sm:hidden flex-1 pl-6">
        <CardContent exp={exp} colors={colors} index={index} />
      </div>
    </div>
  );
}

function TimelineDot({ colors, index }: { exp: Experience; colors: typeof typeColors[Experience['type']]; index: number }) {
  return (
    <motion.div
      className={`w-4 h-4 rounded-full ${colors.dot} ring-4 ${colors.ring} shadow-sm`}
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 0.35, delay: index * 0.12 + 0.15, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

function CardContent({
  exp,
  colors,
  index,
}: {
  exp: Experience;
  colors: typeof typeColors[Experience['type']];
  index: number;
}) {
  const isLeft = index % 2 === 0;

  return (
    <motion.div
      className="w-full max-w-sm bg-white border border-grey-100 rounded-2xl p-5 shadow-sm"
      initial={{ opacity: 0, x: isLeft ? -24 : 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.48, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* 헤더 */}
      <div className="flex items-start gap-3 mb-3">
        {/* 로고 박스 */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-grey-50 border border-grey-100 flex items-center justify-center">
          <span className="text-[10px] font-bold text-grey-500 tracking-tight text-center leading-tight px-1">
            {exp.logo}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[15px] font-bold text-grey-900 leading-tight">
              {exp.company}
            </span>
            <Badge color={typeLabels[exp.type].color} variant="weak" size="small">
              {typeLabels[exp.type].label}
            </Badge>
          </div>
          <p className="text-[12px] text-grey-600 mb-0.5">{exp.position}</p>
          <p className={`text-[11px] font-medium ${colors.badge}`}>{exp.period}</p>
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-px bg-grey-100 mb-3" />

      {/* 설명 */}
      <Paragraph variant="t6" color="grey-700" className="mb-3 leading-relaxed text-[12px]">
        {exp.description}
      </Paragraph>

      {/* 책임 항목 */}
      {exp.responsibilities.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {exp.responsibilities.map((resp, idx) => (
            <motion.li
              key={idx}
              className="flex items-start gap-2"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.28, delay: index * 0.1 + idx * 0.04 + 0.2, ease: 'easeOut' }}
            >
              <span className={`mt-[5px] w-1 h-1 rounded-full flex-shrink-0 ${colors.dot}`} />
              <span className="text-[11px] text-grey-600 leading-relaxed">{resp}</span>
            </motion.li>
          ))}
        </ul>
      )}

      {/* 스킬 태그 */}
      {exp.skills && exp.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {exp.skills.map((skill) => (
            <Badge key={skill} color="gray" variant="weak" size="small">
              {skill}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}
