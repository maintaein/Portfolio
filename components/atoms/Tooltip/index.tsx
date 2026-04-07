'use client';

import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

export default function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            role="tooltip"
            className={cn(
              'absolute left-1/2 z-50 w-max max-w-[160px]',
              'px-2.5 py-1.5 rounded-lg',
              'bg-grey-900 text-white text-t7',
              'shadow-lg pointer-events-none',
              position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            )}
            initial={{ opacity: 0, y: position === 'top' ? 4 : -4, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: position === 'top' ? 4 : -4, x: '-50%' }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {content}
            {/* 화살표 */}
            <span
              className={cn(
                'absolute left-1/2 -translate-x-1/2 w-0 h-0',
                'border-l-4 border-r-4 border-l-transparent border-r-transparent',
                position === 'top'
                  ? 'top-full border-t-4 border-t-grey-900'
                  : 'bottom-full border-b-4 border-b-grey-900'
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
