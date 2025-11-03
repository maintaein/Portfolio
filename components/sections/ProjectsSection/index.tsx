// components/sections/ProjectsSection/index.tsx (개선)
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useIntersection, useModal } from '@/hooks';
import Paragraph from '@/components/atoms/Paragraph';
import Badge from '@/components/atoms/Badge';
import ProjectModal from '@/components/blocks/ProjectModal';
import { Project } from '@/types/index';
import { projects } from '@/lib/data';

export default function ProjectsSection() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  // 💡 useModal 훅 적용: 모달 상태 관리
  const { isOpen, open, close } = useModal();

  // 섹션 전체 진입 감지
  const { ref: sectionRef } = useIntersection({
    threshold: 0.1,
    freezeOnceVisible: true
  });

  const handleOpenModal = (project: Project) => {
    setSelectedProject(project);
    open();
  };

  return (
    <section id="projects" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <HeaderSection />
      
        <div
          ref={sectionRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {projects.map((project, index) => (
            <ProjectCard
              key={project.title}
              project={project}
              index={index}
              onOpenModal={handleOpenModal}
            />
          ))}
        </div>  
      </div>

      <ProjectModal
        isOpen={isOpen}
        onClose={close}
        project={selectedProject}  
      />

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}

function HeaderSection() {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.5,
    freezeOnceVisible: true
  });

  return (
    <div 
      ref={ref}
      className={`mb-12 text-center transition-all duration-1000 ${
        isIntersecting 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-8'
      }`}
    >
      <Paragraph variant="t2" weight="bold" className="mb-3">
        Projects
      </Paragraph>
      <Paragraph variant="t5" color="grey-600">
        직접 기획하고 개발한 프로젝트들입니다
      </Paragraph>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  index: number;
  onOpenModal: (project: Project) => void;
}

function ProjectCard({ project, index, onOpenModal }: ProjectCardProps) {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.2,
    freezeOnceVisible: true
  });

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      className={`group bg-white border border-grey-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-700 transform cursor-pointer ${
        isIntersecting
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-95 translate-y-8'
      }`}
      style={{
        transitionDelay: isIntersecting ? `${index * 0.1}s` : '0s',
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
      onClick={() => onOpenModal(project)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenModal(project);
        }
      }}
      aria-label={`${project.title} 프로젝트 상세 보기`}
    >
      <div className="relative w-full h-48 bg-grey-100 overflow-hidden">
        <Image
          src={project.image}
          alt={`${project.title} - ${project.description} (${project.tags.slice(0, 3).join(', ')} 사용)`}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <Paragraph variant="t5" weight="bold" className="text-white">
            {project.title}
          </Paragraph>
        </div>
      </div>

      <div className="p-5">
        <Paragraph variant="t6" color="grey-700" className="mb-4 line-clamp-2">
          {project.description}
        </Paragraph>

        <div 
          className="flex flex-wrap gap-2 transition-all duration-500"
          style={{
            opacity: isIntersecting ? 1 : 0,
            transitionDelay: isIntersecting ? `${index * 0.1 + 0.2}s` : '0s'
          }}
        >
          {project.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} color="blue" variant="weak" size="small">
              {tag}
            </Badge>
          ))}
          {project.tags.length > 3 && (
            <Badge color="gray" variant="weak" size="small">
              +{project.tags.length - 3}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}