'use client';

import { useState } from 'react';
import { useIntersection } from '@/hooks';
import {
  EyeIcon,
  HeartIcon,
  CheckCircleIcon,
  StarIcon,
  CursorArrowRaysIcon,
  HandRaisedIcon,
  LightBulbIcon,
  FaceSmileIcon,
} from '@heroicons/react/24/outline';

interface UXCard {
  id: string;
  Icon: typeof EyeIcon;
  label: string;
  tooltip: string;
  angle: number; 
  distance: number; 
  delay: number; 
}

export default function EmpathyRadar() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const { ref, isIntersecting } = useIntersection({ threshold: 0.2, freezeOnceVisible: true });

  const uxCards: UXCard[] = [
    { id: 'eye', Icon: EyeIcon, label: '👁️', tooltip: '사용자 관점', angle: 0, distance: 38, delay: 0 },
    { id: 'heart', Icon: HeartIcon, label: '❤️', tooltip: '공감 능력', angle: 45, distance: 38, delay: 0.1 },
    { id: 'star', Icon: StarIcon, label: '⭐', tooltip: '품질 우선', angle: 90, distance: 38, delay: 0.2 },
    { id: 'check', Icon: CheckCircleIcon, label: '✓', tooltip: '직관적 UX', angle: 135, distance: 38, delay: 0.3 },
    { id: 'cursor', Icon: CursorArrowRaysIcon, label: '🖱️', tooltip: '인터랙션', angle: 180, distance: 38, delay: 0.4 },
    { id: 'hand', Icon: HandRaisedIcon, label: '✋', tooltip: '접근성', angle: 225, distance: 38, delay: 0.5 },
    { id: 'bulb', Icon: LightBulbIcon, label: '💡', tooltip: '혁신적 사고', angle: 270, distance: 38, delay: 0.6 },
    { id: 'smile', Icon: FaceSmileIcon, label: '😊', tooltip: '만족도 향상', angle: 315, distance: 38, delay: 0.7 },
  ];

  return (
    <div
      ref={ref}
      className="relative w-full aspect-square max-w-[500px] max-h-[500px] mx-auto"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-purple-50 rounded-2xl overflow-hidden aspect-square">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full aspect-square">
            <div
              className={`absolute inset-0 rounded-full border-2 border-blue-200/40 ${
                isIntersecting ? 'animate-radar-slow' : ''
              }`}
              style={{ margin: '10%' }}
            />

            <div
              className={`absolute inset-0 rounded-full border-2 border-blue-300/50 ${
                isIntersecting ? 'animate-radar-medium' : ''
              }`}
              style={{ margin: '20%' }}
            />

            <div
              className={`absolute inset-0 rounded-full border-2 border-blue-400/60 ${
                isIntersecting ? 'animate-radar-fast' : ''
              }`}
              style={{ margin: '30%' }}
            />

            {isIntersecting && (
              <div className="absolute inset-0 opacity-20">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0deg, rgba(59, 130, 246, 0.5) 90deg, transparent 90deg)',
                    animation: 'radar-sweep 4s linear infinite',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-full h-full aspect-square">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto">
            <div
              className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl md:text-3xl ${
                isIntersecting ? 'animate-[pulse-glow_2s_ease-in-out_infinite]' : ''
              } transition-all duration-700`}
            >
              👤
            </div>
          </div>

          {uxCards.map((card) => (
            <UXCardElement
              key={card.id}
              card={card}
              isActive={isIntersecting}
              isHovered={hoveredCard === card.id}
              onHover={() => setHoveredCard(card.id)}
              onLeave={() => setHoveredCard(null)}
            />
          ))}

          {hoveredCard && uxCards.find((c) => c.id === hoveredCard) && (
            <ConnectionBeam card={uxCards.find((c) => c.id === hoveredCard)!} />
          )}
        </div>
      </div>
    </div>
  );
}

interface UXCardElementProps {
  card: UXCard;
  isActive: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function UXCardElement({ card, isActive, isHovered, onHover, onLeave }: UXCardElementProps) {
  const Icon = card.Icon;

  const x = 50 + card.distance * Math.cos((card.angle * Math.PI) / 180);
  const y = 50 + card.distance * Math.sin((card.angle * Math.PI) / 180);

  return (
    <div
      className={`absolute transition-all duration-300 pointer-events-auto ${
        isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      }`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        transitionDelay: `${card.delay}s`,
        zIndex: isHovered ? 30 : 20,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div
        className={`relative w-12 h-12 md:w-14 md:h-14 bg-white rounded-xl shadow-md flex items-center justify-center cursor-pointer transition-all duration-300 ${
          isActive ? 'animate-float' : ''
        } ${
          isHovered ? 'scale-110 shadow-xl ring-2 ring-blue-400' : ''
        }`}
        style={{
          animationDelay: `${card.delay * 0.5}s`,
        }}
      >
        <Icon className="w-6 h-6 md:w-7 md:h-7 text-blue-500" />

        {isHovered && (
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-grey-900 text-white text-xs px-3 py-1.5 rounded-lg animate-[fadeIn_200ms_ease-out] z-50">
            {card.tooltip}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-grey-900 rotate-45" />
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnectionBeamProps {
  card: UXCard;
}

function ConnectionBeam({ card }: ConnectionBeamProps) {
  const x1 = 50;
  const y1 = 50;
  const x2 = 50 + card.distance * Math.cos((card.angle * Math.PI) / 180);
  const y2 = 50 + card.distance * Math.sin((card.angle * Math.PI) / 180);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
      <line
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
        stroke="rgba(59, 130, 246, 0.6)"
        strokeWidth="2"
        strokeDasharray="5,5"
        className="animate-[pulse_1s_ease-in-out_infinite]"
      />
    </svg>
  );
}
