export const colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // 메인
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  secondary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7', // 메인
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  accent: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316', // 메인
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
} as const;

export const typography = {
  fontFamily: {
    primary: 'Pretendard',
  },
  fontSize: {
    d1: ['4.5rem', { lineHeight: '1.2', fontWeight: '700' }], // 72px
    d2: ['3.75rem', { lineHeight: '1.2', fontWeight: '700' }], // 60px
    d3: ['3rem', { lineHeight: '1.2', fontWeight: '700' }], // 48px
    
    h1: ['2.25rem', { lineHeight: '1.3', fontWeight: '700' }], // 36px
    h2: ['1.875rem', { lineHeight: '1.3', fontWeight: '700' }], // 30px
    h3: ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }], // 24px
    h4: ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }], // 20px
    h5: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }], // 18px
    
    'body-xl': ['1.25rem', { lineHeight: '1.6', fontWeight: '400' }], // 20px
    'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }], // 18px
    'body-md': ['1rem', { lineHeight: '1.6', fontWeight: '400' }], // 16px
    'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }], // 14px
    'body-xs': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }], // 12px
    
    'label-lg': ['1rem', { lineHeight: '1.5', fontWeight: '500' }], // 16px
    'label-md': ['0.875rem', { lineHeight: '1.5', fontWeight: '500' }], // 14px
    'label-sm': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }], // 12px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
  32: '8rem', // 128px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem', // 4px
  md: '0.5rem', // 8px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
} as const;

export const shadow = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

export const animation = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
} as const;