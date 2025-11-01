import { ANIMATION } from '@/lib/constants';

export function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;

  const offsetTop = element.offsetTop - ANIMATION.SCROLL_OFFSET;
  
  window.scrollTo({
    top: offsetTop,
    behavior: 'smooth',
  });
}

export function getCurrentSection(sections: string[], offset: number = 80): string {
  const scrollPosition = window.scrollY + offset + 20;

  for (let i = sections.length - 1; i >= 0; i--) {
    const section = document.getElementById(sections[i]);
    if (section && section.offsetTop <= scrollPosition) {
      return sections[i];
    }
  }

  return sections[0];
}

export function getScrollProgress(): number {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  return (scrollTop / docHeight) * 100;
}