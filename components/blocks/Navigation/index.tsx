// components/blocks/Navigation/index.tsx
'use client';

import { useState, useEffect } from 'react';
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

  // items에서 section id 배열 추출
  const sectionIds = items.map(item => item.id);
  const { activeSection } = useScroll(sectionIds, {
    offset: 80, // navbar 높이만큼 offset
    throttle: 16 // 즉시 반응 (60fps 기준 1프레임)
  });

  // Navigation 표시/숨김 제어 (hero 섹션 80% 지점 통과 시 표시)
  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.getElementById('hero');
      if (heroSection) {
        const heroBottom = heroSection.offsetTop + heroSection.offsetHeight * 0.8;
        const shouldShow = window.scrollY > heroBottom;
        setIsVisible(shouldShow);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 초기 체크

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
    <nav
      aria-label="메인 네비게이션"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-white border-b border-grey-200 backdrop-blur-sm bg-white/95',
        'transition-transform duration-500 ease-out',
        isVisible ? 'translate-y-0' : '-translate-y-full',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-t4 font-bold text-grey-900 hover:text-primary-500 transition-colors duration-300"
            aria-label="페이지 최상단으로 이동"
          >
            Portfolio
          </button>

          <div className="hidden md:flex items-center gap-8">
            {items.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollToSection(item.href)}
                aria-current={activeSection === item.id ? 'page' : undefined}
                aria-label={`${item.label} 섹션으로 이동`}
                className={cn(
                  'text-t6 font-medium transition-all duration-300 relative pb-2',
                  activeSection === item.id
                    ? 'text-blue-500'
                    : 'text-grey-700 hover:text-primary-500',
                  activeSection === item.id && 'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary-500 after:transition-all after:duration-300'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <IconButton
            icon={<Icon name={isMobileMenuOpen ? 'close' : 'menu'} />}
            variant="ghost"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          />
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {items.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollToSection(item.href)}
                className={cn(
                  'block w-full text-left text-t5 font-medium py-2 px-4 rounded-lg transition-all duration-300',
                  activeSection === item.id
                    ? 'bg-primary-50 text-primary-500 font-semibold'
                    : 'text-grey-700 hover:bg-grey-50'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}