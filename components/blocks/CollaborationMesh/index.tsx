'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useIntersection } from '@/hooks';

interface CollabTool {
  id: string;
  name: string;
  icon: string;
  tooltip: string;
  x: number; 
  y: number;
  bobDelay: number; 
}

interface Connection {
  from: string;
  to: string;
  pulseDelay: number;
}

export default function CollaborationMesh() {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const { ref, isIntersecting } = useIntersection({ threshold: 0.2, freezeOnceVisible: true });


  const tools: CollabTool[] = [
    { id: 'github', name: 'GitHub', icon: '/icons/github.png', tooltip: '버전 관리 & 코드 리뷰', x: 25, y: 25, bobDelay: 0 },
    { id: 'jira', name: 'Jira', icon: '/icons/Jira.png', tooltip: '애자일 스프린트 관리', x: 75, y: 25, bobDelay: 0.75 },
    { id: 'figma', name: 'Figma', icon: '/icons/Figma.png', tooltip: '디자인 협업', x: 25, y: 75, bobDelay: 1.5 },
    { id: 'notion', name: 'Notion', icon: '/icons/Notion.png', tooltip: '문서화 & 지식 공유', x: 75, y: 75, bobDelay: 2.25 },
  ];

  const connections: Connection[] = [
    { from: 'github', to: 'jira', pulseDelay: 0 },
    { from: 'github', to: 'figma', pulseDelay: 0.5 },
    { from: 'github', to: 'notion', pulseDelay: 1 },
    { from: 'jira', to: 'figma', pulseDelay: 1.5 },
    { from: 'jira', to: 'notion', pulseDelay: 2 },
    { from: 'figma', to: 'notion', pulseDelay: 2.5 },
  ];

  return (
    <div
      ref={ref}
      className="relative w-full h-full min-h-[400px] md:min-h-[500px] bg-gradient-to-br from-green-100 via-green-50 to-blue-50 rounded-2xl overflow-hidden"
    >
      <div className="absolute inset-0 opacity-20">
        <div className="grid grid-cols-12 grid-rows-8 gap-2 p-8 h-full">
          {Array.from({ length: 96 }).map((_, index) => (
            <div
              key={index}
              className={`rounded-sm ${isIntersecting ? 'animate-[grid-pulse_4s_ease-in-out_infinite]' : 'bg-green-200/30'}`}
              style={{
                animationDelay: `${(index * 0.03) % 3}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-0">
        <svg className="w-full h-full" viewBox="0 0 100 100" style={{ zIndex: 1 }}>
          {connections.map((conn, index) => {
            const fromTool = tools.find((t) => t.id === conn.from)!;
            const toTool = tools.find((t) => t.id === conn.to)!;

            const isHighlighted =
              hoveredTool === conn.from || hoveredTool === conn.to;

            return (
              <ConnectionLine
                key={`${conn.from}-${conn.to}`}
                from={fromTool}
                to={toTool}
                isActive={isIntersecting}
                isHighlighted={isHighlighted}
                pulseDelay={conn.pulseDelay}
                index={index}
              />
            );
          })}
        </svg>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full max-w-[500px] max-h-[500px]">
          {tools.map((tool) => (
            <CollabToolCard
              key={tool.id}
              tool={tool}
              isActive={isIntersecting}
              isHovered={hoveredTool === tool.id}
              onHover={() => setHoveredTool(tool.id)}
              onLeave={() => setHoveredTool(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CollabToolCardProps {
  tool: CollabTool;
  isActive: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function CollabToolCard({ tool, isActive, isHovered, onHover, onLeave }: CollabToolCardProps) {
  return (
    <div
      className={`absolute transition-all duration-700 ${
        isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      }`}
      style={{
        left: `${tool.x}%`,
        top: `${tool.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isHovered ? 10 : 5,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div
        className={`relative w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl shadow-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
          isActive ? 'animate-bob' : ''
        } ${
          isHovered ? 'scale-110 shadow-2xl ring-2 ring-green-400' : ''
        }`}
        style={{
          animationDelay: `${tool.bobDelay}s`,
        }}
      >
        <div className="w-12 h-12 md:w-14 md:h-14 relative">
          <Image
            src={tool.icon}
            alt={tool.name}
            fill
            className="object-contain"
          />
        </div>

        <div className="mt-2 text-xs md:text-sm font-semibold text-grey-800">
          {tool.name}
        </div>

        {isHovered && (
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-grey-900 text-white text-xs px-3 py-1.5 rounded-lg animate-[fadeIn_200ms_ease-out] z-20">
            {tool.tooltip}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-grey-900 rotate-45" />
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnectionLineProps {
  from: CollabTool;
  to: CollabTool;
  isActive: boolean;
  isHighlighted: boolean;
  pulseDelay: number;
  index: number;
}

function ConnectionLine({ from, to, isActive, isHighlighted }: ConnectionLineProps) {
  return (
    <g>
      <line
        x1={`${from.x}%`}
        y1={`${from.y}%`}
        x2={`${to.x}%`}
        y2={`${to.y}%`}
        stroke={isHighlighted ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.2)'}
        strokeWidth={isHighlighted ? '3' : '2'}
        className="transition-all duration-300"
        style={{
          opacity: isActive ? 1 : 0,
        }}
      />
    </g>
  );
}
