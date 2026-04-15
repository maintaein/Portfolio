// components/blocks/Navigation/index.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScroll } from '@/hooks';
import { IconButton, Icon } from '@/components/atoms';
import { cn } from '@/lib/utils/cn';

interface NavigationItem {
  label: string;
  href: string;
  id: string;
}

interface NavigationProps {
  items: NavigationItem[];
  className?: string;
  activeSection?: string;
}

export default function Navigation({
  items,
  className,
}: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const sectionIds = items.map(item => item.id);
  const { activeSection } = useScroll(sectionIds, {
    offset: 80,
    throttle: 16,
  });

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.getElementById('hero');
      if (heroSection) {
        const heroBottom = heroSection.offsetTop + heroSection.offsetHeight * 0.8;
        setIsVisible(window.scrollY > heroBottom);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          aria-label="메인 네비게이션"
          className={cn(
            'fixed top-0 left-0 right-0 z-50',
            'bg-white/95 backdrop-blur-sm border-b border-grey-200/80',
            className
          )}
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* 로고 — hover 시 underline 슬라이드 */}
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="페이지 최상단으로 이동"
                className="relative text-t4 font-bold text-grey-900 hover:text-blue-500 transition-colors duration-300 pb-0.5 group"
              >
                Portfolio
                <span className={cn(
                  'absolute bottom-0 left-0 h-0.5 bg-blue-500 rounded-full',
                  'w-0 group-hover:w-full transition-all duration-300 ease-out'
                )} />
              </button>

              {/* 데스크톱 nav items */}
              <div className="hidden md:flex items-center gap-8">
                {items.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.href}
                      onClick={() => scrollToSection(item.href)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={`${item.label} 섹션으로 이동`}
                      className={cn(
                        'relative text-t6 font-medium pb-1.5 transition-colors duration-250 group',
                        isActive ? 'text-blue-500' : 'text-grey-600 hover:text-blue-500'
                      )}
                    >
                      {item.label}
                      {/* underline: 활성 = 항상 표시, 비활성 = hover 시 슬라이드 인 */}
                      <span className={cn(
                        'absolute bottom-0 left-0 h-0.5 bg-blue-500 rounded-full',
                        'transition-all duration-300 ease-out origin-left',
                        isActive
                          ? 'w-full'
                          : 'w-0 group-hover:w-full'
                      )} />
                    </button>
                  );
                })}
              </div>

              <IconButton
                icon={<Icon name={isMobileMenuOpen ? 'close' : 'menu'} />}
                variant="ghost"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="메뉴 열기/닫기"
              />
            </div>

            {/* 모바일 메뉴 — AnimatePresence */}
            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  className="md:hidden overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="pt-4 pb-2 space-y-1">
                    {items.map((item) => {
                      const isActive = activeSection === item.id;
                      return (
                        <button
                          key={item.href}
                          onClick={() => scrollToSection(item.href)}
                          className={cn(
                            'block w-full text-left text-t5 font-medium py-2.5 px-4 rounded-lg transition-all duration-200',
                            isActive
                              ? 'bg-blue-50 text-blue-500 font-semibold'
                              : 'text-grey-700 hover:bg-grey-50 hover:text-blue-500'
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
