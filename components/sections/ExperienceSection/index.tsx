'use client';

import { useIntersection } from '@/hooks';
import Paragraph from '@/components/atoms/Paragraph/index';
import Badge from '@/components/atoms/Badge/index';
import { Experience } from '@/types';
import { typeLabels } from '@/types';
import { experiences } from '@/lib/data';

export default function ExperienceSection() {
  // 섹션 전체 진입 감지
  const { ref: sectionRef } = useIntersection({
    threshold: 0.1,
    freezeOnceVisible: true
  });

  return (
    <section id="experience" className="py-12 sm:py-16 lg:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <HeaderSection />

        <div 
          ref={sectionRef}
          className="space-y-8"
        >
          {experiences.map((exp, index) => (
            <ExperienceCard 
              key={exp.id} 
              experience={exp} 
              index={index}
            />
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

  return (
    <div 
      ref={ref}
      className={`mb-12 text-center transition-all duration-1000 ${
        isIntersecting 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-8'
      }`}
    >
      <Paragraph variant="t2" weight="bold" className="mb-3">
        EXPERIENCES
      </Paragraph>
      <Paragraph variant="t5" color="grey-600">
        실무와 교육을 통해 성장해왔습니다
      </Paragraph>
    </div>
  );
}

interface ExperienceCardProps {
  experience: Experience;
  index: number;
}

function ExperienceCard({ experience: exp, index }: ExperienceCardProps) {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.3,
    freezeOnceVisible: true
  });

  return (
    <div
      ref={ref}
      className={`group relative bg-white border border-grey-200 rounded-xl p-6 hover:shadow-lg hover:border-primary-300 transition-all duration-700 transform ${
        isIntersecting
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-10 scale-95'
      }`}
      style={{
        transitionDelay: isIntersecting ? `${index * 0.1}s` : '0s',
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0 w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center border border-primary-100 transform group-hover:scale-110 transition-transform duration-300">
          <Paragraph variant="t4" weight="bold" color="grey-600">
            {exp.logo}
          </Paragraph>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Paragraph variant="t3" weight="bold">
              {exp.company}
            </Paragraph>
            <Badge 
              color={typeLabels[exp.type].color} 
              variant="weak" 
              size="small"
            >
              {typeLabels[exp.type].label}
            </Badge>
          </div>
          <Paragraph variant="t5" color="grey-700" className="mb-1">
            {exp.position}
          </Paragraph>
          <Paragraph variant="t6" color="grey-500">
            {exp.period}
          </Paragraph>
        </div>
      </div>

      <Paragraph variant="t6" color="grey-700" className="mb-4 leading-relaxed">
        {exp.description}
      </Paragraph>

      {exp.responsibilities.length > 0 && (
        <div className="mb-4">
          <ul className="space-y-2">
            {exp.responsibilities.map((responsibility, idx) => (
              <li 
                key={idx} 
                className={`flex items-start gap-2 transition-all duration-500 transform ${
                  isIntersecting
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-4'
                }`}
                style={{
                  transitionDelay: isIntersecting ? `${(index * 0.1) + (idx * 0.05)}s` : '0s'
                }}
              >
                <span className="text-primary-500 mt-1 flex-shrink-0">•</span>
                <Paragraph variant="t6" color="grey-700" className="flex-1">
                  {responsibility}
                </Paragraph>
              </li>
            ))}
          </ul>
        </div>
      )}

      {exp.skills && exp.skills.length > 0 && (
        <div 
          className={`flex flex-wrap gap-2 transition-all duration-500 transform ${
            isIntersecting
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          }`}
          style={{
            transitionDelay: isIntersecting ? `${(index * 0.1) + 0.15}s` : '0s'
          }}
        >
          {exp.skills.map((skill) => (
            <Badge key={skill} color="gray" variant="weak" size="small">
              {skill}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}