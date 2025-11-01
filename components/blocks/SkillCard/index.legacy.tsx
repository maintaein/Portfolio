// components/blocks/SkillCard/index.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Badge, Paragraph, BoardRow, Icon } from '@/components/atoms';
import { cn } from '@/lib/utils/cn';
import { Skill } from '@/types';


interface SkillCardProps {
  category: string;
  icon?: React.ReactNode;
  skills: Skill[];
  description?: string;
  className?: string;
}

export default function SkillCard({
  category,
  icon,
  skills,
  description,
  className,
}: SkillCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        'bg-white border border-grey-200 rounded-lg p-6 transition-all duration-base hover:shadow-lg hover:border-blue-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {icon && (
          <div className="w-12 h-12 flex items-center justify-center bg-blue-50 rounded-lg text-blue-500">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <Paragraph variant="t3" weight="bold">
            {category}
          </Paragraph>
          {description && (
            <Paragraph variant="t7" color="grey-600" className="mt-1">
              {description}
            </Paragraph>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-grey-50 rounded-lg transition-colors duration-base"
          aria-label={isExpanded ? '접기' : '펼치기'}
        >
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size="small"
          />
        </button>
      </div>

      {/* Skills Grid */}
      <div
        className={cn(
          'grid gap-3 transition-all duration-base',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className={cn('overflow-hidden', !isExpanded && 'max-h-0')}>
          <div className="space-y-3 pt-3 border-t border-grey-200">
            {skills.map((skill, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 bg-grey-50 rounded-lg hover:bg-grey-100 transition-colors duration-200"
              >
                {/* 왼쪽: 아이콘 + 스킬명 */}
                <div className="flex items-center gap-3 min-w-[180px]">
                  {skill.icon && (
                    <div className="w-10 h-10 flex-shrink-0 relative">
                      <Image
                        src={skill.icon}
                        alt={`${skill.name} icon`}
                        width={40}
                        height={40}
                        className="object-contain"
                      />
                    </div>
                  )}
                  <Paragraph variant="t6" weight="bold">
                    {skill.name}
                  </Paragraph>
                </div>

                {/* 오른쪽: 경험 설명 */}
                <div className="flex-1">
                  {skill.experience ? (
                    <Paragraph variant="t7" color="grey-700" className="leading-relaxed">
                      {skill.experience}
                    </Paragraph>
                  ) : (
                    <Paragraph variant="t7" color="grey-500" className="italic">
                      경험 설명 없음
                    </Paragraph>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skills Summary (when collapsed) */}
      {!isExpanded && (
        <BoardRow gap="small" wrap="wrap" className="mt-3">
          {skills.slice(0, 4).map((skill, index) => (
            <Badge key={index} size="small" variant="weak" color="blue">
              {skill.name}
            </Badge>
          ))}
          {skills.length > 4 && (
            <Badge size="small" variant="weak" color="gray">
              +{skills.length - 4}
            </Badge>
          )}
        </BoardRow>
      )}
    </div>
  );
}