'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Paragraph, Tooltip } from '@/components/atoms';
import { cn } from '@/lib/utils/cn';

interface SkillItemCardProps {
  name: string;
  icon?: string;
  experience?: string;
  className?: string;
}

// 부모 grid의 staggerChildren에 맞춰 순차 등장
const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function SkillItemCard({ name, icon, experience, className }: SkillItemCardProps) {
  const card = (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, scale: 1.03, transition: { duration: 0.22, ease: 'easeOut' } }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'w-full bg-white border border-grey-200 rounded-xl p-4',
        'flex flex-col items-center text-center cursor-default',
        'shadow-sm hover:shadow-md hover:border-blue-200',
        'transition-shadow duration-300',
        className
      )}
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

      <Paragraph variant="t6" weight="bold">
        {name}
      </Paragraph>
    </motion.div>
  );

  // experience가 있으면 Tooltip으로 감싸 hover 시 표시
  // className="w-full" — Tooltip의 기본 inline-flex가 카드 너비를 수축시키는 문제 방지
  if (experience) {
    return (
      <Tooltip content={experience} position="top" className="w-full">
        {card}
      </Tooltip>
    );
  }

  return card;
}
