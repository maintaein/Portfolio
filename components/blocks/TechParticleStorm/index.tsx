'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useIntersection } from '@/hooks';

interface TechIcon {
  name: string;
  path: string;
  gridX: number; // Final grid position
  gridY: number;
  direction: 'top' | 'right' | 'bottom' | 'left'; // Direction from which it flies in
  distance: number; // Initial distance from center (in %)
}

export default function TechParticleStorm() {
  const { ref, isIntersecting } = useIntersection({ threshold: 0.2, freezeOnceVisible: true });
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

  // 15 tech stack icons - deterministic distribution from 4 directions
  const techIcons: TechIcon[] = [
    // Row 1 - from top & right
    { name: 'JavaScript', path: '/icons/JS.png', gridX: 0, gridY: 0, direction: 'top', distance: 120 },
    { name: 'TypeScript', path: '/icons/TS.png', gridX: 1, gridY: 0, direction: 'right', distance: 130 },
    { name: 'React', path: '/icons/React.png', gridX: 2, gridY: 0, direction: 'top', distance: 140 },
    { name: 'Next.js', path: '/icons/next.png', gridX: 3, gridY: 0, direction: 'right', distance: 110 },

    // Row 2 - from left & bottom
    { name: 'Python', path: '/icons/Python.png', gridX: 0, gridY: 1, direction: 'left', distance: 125 },
    { name: 'Java', path: '/icons/Java.png', gridX: 1, gridY: 1, direction: 'bottom', distance: 135 },
    { name: 'HTML', path: '/icons/HTML.png', gridX: 2, gridY: 1, direction: 'left', distance: 115 },
    { name: 'CSS', path: '/icons/CSS.png', gridX: 3, gridY: 1, direction: 'bottom', distance: 145 },

    // Row 3 - from top & right
    { name: 'Tailwind', path: '/icons/Tailwind.png', gridX: 0, gridY: 2, direction: 'top', distance: 135 },
    { name: 'React Query', path: '/icons/react-query.png', gridX: 1, gridY: 2, direction: 'right', distance: 120 },
    { name: 'Zustand', path: '/icons/zustand.png', gridX: 2, gridY: 2, direction: 'top', distance: 125 },
    { name: 'Vite', path: '/icons/Vite.png', gridX: 3, gridY: 2, direction: 'right', distance: 140 },

    // Row 4 - from left & bottom
    { name: 'Spring', path: '/icons/Spring.png', gridX: 0, gridY: 3, direction: 'left', distance: 130 },
    { name: 'MySQL', path: '/icons/MySQL.png', gridX: 1, gridY: 3, direction: 'bottom', distance: 120 },
    { name: 'Node.js', path: '/icons/nodejs.png', gridX: 2, gridY: 3, direction: 'left', distance: 140 },
  ];

  return (
    <div
      ref={ref}
      className="relative w-full h-full min-h-[400px] md:min-h-[500px] bg-gradient-to-br from-purple-100 via-purple-50 to-blue-50 rounded-2xl overflow-hidden"
    >
      {/* Background Grid Pulse Effect */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-16 grid-rows-12 gap-1 p-4 h-full">
          {Array.from({ length: 192 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-sm ${
                isIntersecting ? 'animate-[grid-pulse_4s_ease-in-out_infinite]' : 'bg-purple-200/30'
              }`}
              style={{
                animationDelay: `${(i * 0.02) % 3}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Icon Container */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className="relative w-full h-full max-w-[600px] max-h-[600px]">
          {techIcons.map((icon, index) => (
            <TechIconElement
              key={icon.name}
              icon={icon}
              index={index}
              isActive={isIntersecting}
              isHovered={hoveredIcon === icon.name}
              onHover={() => setHoveredIcon(icon.name)}
              onLeave={() => setHoveredIcon(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TechIconElementProps {
  icon: TechIcon;
  index: number;
  isActive: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function TechIconElement({ icon, index, isActive, isHovered, onHover, onLeave }: TechIconElementProps) {
  // Calculate final grid position (4x4 grid)
  const spacing = 25; // percentage
  const offsetX = 12.5; // Center the grid
  const offsetY = 12.5;

  const finalX = offsetX + (icon.gridX * spacing);
  const finalY = offsetY + (icon.gridY * spacing);

  // Calculate initial position based on direction
  const getInitialPosition = () => {
    switch (icon.direction) {
      case 'top':
        return { x: finalX, y: -icon.distance };
      case 'right':
        return { x: 100 + icon.distance, y: finalY };
      case 'bottom':
        return { x: finalX, y: 100 + icon.distance };
      case 'left':
        return { x: -icon.distance, y: finalY };
    }
  };

  const initialPos = getInitialPosition();

  // Get gradient direction for motion blur based on flying direction
  const getBlurGradient = () => {
    switch (icon.direction) {
      case 'top':
        return 'bg-gradient-to-b from-purple-500/70 via-purple-400/40 to-transparent';
      case 'right':
        return 'bg-gradient-to-l from-purple-500/70 via-purple-400/40 to-transparent';
      case 'bottom':
        return 'bg-gradient-to-t from-purple-500/70 via-purple-400/40 to-transparent';
      case 'left':
        return 'bg-gradient-to-r from-purple-500/70 via-purple-400/40 to-transparent';
    }
  };

  return (
    <div
      className={`absolute w-14 h-14 md:w-16 md:h-16 transition-all ${
        isActive
          ? 'duration-[1200ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]'
          : 'duration-0'
      }`}
      style={{
        left: isActive ? `${finalX}%` : `${initialPos.x}%`,
        top: isActive ? `${finalY}%` : `${initialPos.y}%`,
        transform: 'translate(-50%, -50%)',
        transitionDelay: `${index * 0.08}s`,
        zIndex: isHovered ? 30 : 20,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Icon with motion blur effect during flight */}
      <div
        className={`relative w-full h-full ${
          !isActive ? 'opacity-0' : 'opacity-100'
        } transition-opacity duration-300`}
        style={{
          transitionDelay: `${index * 0.08}s`,
        }}
      >
        {/* 3-Layer Motion Blur Trail (visible during animation) */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
            isActive ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            transitionDelay: `${index * 0.08 + 0.3}s`,
          }}
        >
          {/* Layer 1 - Strongest blur */}
          <div className={`absolute inset-0 ${getBlurGradient()} blur-lg rounded-full scale-125`} />
          {/* Layer 2 - Medium blur */}
          <div className={`absolute inset-0 ${getBlurGradient()} blur-xl rounded-full scale-150 opacity-70`} />
          {/* Layer 3 - Softest blur */}
          <div className={`absolute inset-0 ${getBlurGradient()} blur-2xl rounded-full scale-[2] opacity-40`} />
        </div>

        {/* Icon Image */}
        <div
          className={`relative w-full h-full rounded-lg bg-white shadow-md flex items-center justify-center p-2 transition-all duration-300 ${
            isActive ? 'animate-float' : ''
          } ${
            isHovered ? 'scale-110 shadow-xl ring-2 ring-purple-400' : ''
          }`}
          style={{
            animationDelay: `${index * 0.15}s`,
          }}
        >
          <Image
            src={icon.path}
            alt={icon.name}
            width={48}
            height={48}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Hover Tooltip */}
        {isHovered && (
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-grey-900 text-white text-xs px-3 py-1.5 rounded-lg animate-[fadeIn_200ms_ease-out] z-50">
            {icon.name}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-grey-900 rotate-45" />
          </div>
        )}
      </div>
    </div>
  );
}
