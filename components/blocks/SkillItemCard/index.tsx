'use client';

import Image from 'next/image';
import { Paragraph } from '@/components/atoms';
import { cn } from '@/lib/utils/cn';

interface SkillItemCardProps {
  name: string;
  icon?: string;
  experience?: string;
  className?: string;
  animationDelay?: number;
}

export default function SkillItemCard({
  name,
  icon,
  experience,
  className,
  animationDelay = 0,
}: SkillItemCardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-grey-200 rounded-lg p-4',
        'flex flex-col items-center text-center',
        'transition-all duration-300 ease-in-out',
        'hover:shadow-lg hover:border-blue-300 hover:-translate-y-1',
        'opacity-0 animate-fade-in',
        className
      )}
      style={{
        animationDelay: `${animationDelay}ms`,
        animationFillMode: 'forwards'
      }}
    >
      {icon && (
        <div className="w-12 h-12 mb-3 relative flex-shrink-0">
          <Image
            src={icon}
            alt={`${name} icon`}
            width={48}
            height={48}
            className="object-contain"
          />
        </div>
      )}

      <Paragraph variant="t6" weight="bold" className="mb-1.5">
        {name}
      </Paragraph>

      {experience && (
        <Paragraph variant="t7" color="grey-600" className="leading-relaxed text-xs">
          {experience}
        </Paragraph>
      )}
    </div>
  );
}
