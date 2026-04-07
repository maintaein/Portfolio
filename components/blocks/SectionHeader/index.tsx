'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export default function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  return (
    <motion.div
      className={cn('text-center mb-12', className)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-center gap-4 mb-3">
        {/* 좌측 장식 라인 */}
        <div className="h-px w-10 bg-gradient-to-r from-transparent to-blue-400 rounded-full" />

        <h2 className="text-t2 font-bold text-grey-900 tracking-wide">
          {title}
        </h2>

        {/* 우측 장식 라인 */}
        <div className="h-px w-10 bg-gradient-to-l from-transparent to-blue-400 rounded-full" />
      </div>

      {subtitle && (
        <p className="text-t6 text-grey-600 mt-2">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
