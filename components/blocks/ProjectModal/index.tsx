// components/blocks/ProjectModal/index.tsx
'use client';

import { useState } from 'react';
import { Modal, Button, Paragraph, Icon, Skeleton } from '@/components/atoms';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import { Project, ImplementationItem, ImplementationGroup } from '@/types';
import type { ProjectReview } from '@/types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export default function ProjectModal({
  isOpen,
  onClose,
  project,
}: ProjectModalProps) {
  const [activeReviewTab, setActiveReviewTab] = useState(0);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  if (!isOpen || !project) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project.title}
      size="large"
    >
      <div className="space-y-8">
        {/* Subtitle */}
        {project.subtitle && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <Paragraph variant="t5" color="grey-800" className="leading-relaxed">
              💡 {project.subtitle}
            </Paragraph>
          </div>
        )}

        {/* Project Image */}
        <div className={cn(
          "relative w-3/4 mx-auto bg-grey-100 rounded-lg overflow-hidden flex items-center justify-center",
          project.imageAspect === 'portrait' ? 'aspect-[9/16] max-h-[600px] max-w-[400px]' :
          project.imageAspect === 'square' ? 'aspect-square max-h-[500px] max-w-[500px]' :
          project.imageAspect === 'auto' ? 'min-h-[300px]' :
          'aspect-video max-w-full'
        )}>
          {imgLoading && (
            <div className="absolute inset-0">
              <Skeleton variant="rectangular" className="w-full h-full" />
            </div>
          )}
          {imgError ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Icon name="image" size="large" className="text-grey-400 mb-4" />
              <Paragraph variant="t6" color="grey-500">
                이미지를 불러올 수 없습니다
              </Paragraph>
            </div>
          ) : (
            <Image
              src={project.image}
              alt={project.title}
              fill
              className={cn(
                "object-contain transition-opacity duration-300",
                imgLoading ? "opacity-0" : "opacity-100"
              )}
              onLoadingComplete={() => setImgLoading(false)}
              onError={() => {
                setImgLoading(false);
                setImgError(true);
              }}
            />
          )}
        </div>

        {/* Description */}
        {project.longDescription && (
          <div>
            <Paragraph variant="t6" color="grey-700" className="leading-relaxed">
              {project.longDescription}
            </Paragraph>
          </div>
        )}

        {/* Project Info Grid */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-grey-50 rounded-lg">
          {project.duration && (
            <div>
              <Paragraph variant="t7" weight="medium" className="mb-1 text-grey-600">
                기간
              </Paragraph>
              <Paragraph variant="t6" weight="semibold">
                {project.duration}
              </Paragraph>
            </div>
          )}
          {project.role && (
            <div>
              <Paragraph variant="t7" weight="medium" className="mb-1 text-grey-600">
                역할
              </Paragraph>
              <Paragraph variant="t6" weight="semibold">
                {project.role}
              </Paragraph>
            </div>
          )}
          {project.teamSize && (
            <div>
              <Paragraph variant="t7" weight="medium" className="mb-1 text-grey-600">
                팀 규모
              </Paragraph>
              <Paragraph variant="t6" weight="semibold">
                {project.teamSize}
              </Paragraph>
            </div>
          )}
        </div>

        {/* Implementations */}
        {project.implementations && project.implementations.length > 0 && (
          <div>
            <Paragraph variant="t4" weight="bold" className="mb-3 flex items-center gap-2">
              <span className="text-blue-500">✔️</span>
              구현 사항
            </Paragraph>
            <div className="space-y-6">
              {project.implementations.map((impl, index) => {
                // 그룹인지 체크
                const isGroup = typeof impl === 'object' &&
                                impl !== null &&
                                'category' in impl;

                if (isGroup) {
                  const group = impl as ImplementationGroup;
                  return (
                    <div key={index} className="space-y-4">
                      {/* 카테고리 헤더 */}
                      <Paragraph variant="t5" weight="bold" className="text-grey-800 border-l-4 border-blue-500 pl-3">
                        {group.category}
                      </Paragraph>

                      {/* 그룹 아이템들 */}
                      <ul className="space-y-4 pl-2">
                        {group.items.map((item, itemIdx) => {
                          const isObject = typeof item === 'object' && item !== null;
                          const text = isObject ? (item as ImplementationItem).text : item;
                          const image = isObject ? (item as ImplementationItem).image : null;
                          const video = isObject ? (item as ImplementationItem).video : null;

                          return (
                            <li key={itemIdx} className="space-y-3">
                              <div className="flex items-center gap-3 p-3 bg-grey-50 rounded-lg hover:bg-grey-100 transition-colors duration-200">
                                <span className="text-blue-500 leading-[1] flex-shrink-0">•</span>
                                <Paragraph variant="t6" color="grey-700" className="flex-1">
                                  {text}
                                </Paragraph>
                              </div>

                              {video && (
                                <video
                                  src={video}
                                  controls
                                  className="w-full rounded-lg shadow-md"
                                  preload="metadata"
                                >
                                  브라우저가 비디오 태그를 지원하지 않습니다.
                                </video>
                              )}

                              {image && (
                                <div className="w-full">
                                  <Image
                                    src={image}
                                    alt={text}
                                    width={800}
                                    height={450}
                                    className="w-full rounded-lg shadow-md"
                                  />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                }

                // 기존 단일 항목 렌더링
                const isObject = typeof impl === 'object' && impl !== null;
                const text = isObject ? (impl as ImplementationItem).text : impl;
                const video = isObject ? (impl as ImplementationItem).video : null;
                const image = isObject ? (impl as ImplementationItem).image : null;

                return (
                  <div key={index} className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-grey-50 rounded-lg hover:bg-grey-100 transition-colors duration-200">
                      <span className="text-blue-500 leading-[1] flex-shrink-0">•</span>
                      <Paragraph variant="t6" color="grey-700" className="flex-1">
                        {text}
                      </Paragraph>
                    </div>

                    {video && (
                      <video
                        src={video}
                        controls
                        className="w-full rounded-lg shadow-md"
                        preload="metadata"
                      >
                        브라우저가 비디오 태그를 지원하지 않습니다.
                      </video>
                    )}

                    {image && (
                      <div className="w-full">
                        <Image
                          src={image}
                          alt={text}
                          width={800}
                          height={450}
                          className="w-full rounded-lg shadow-md"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Responsibilities */}
        {project.responsibilities && project.responsibilities.length > 0 && (
          <div>
            <Paragraph variant="t4" weight="bold" className="mb-3 flex items-center gap-2">
              <span className="text-blue-500">✔️</span>
              담당 역할
            </Paragraph>
            <ul className="space-y-2">
              {project.responsibilities.map((resp, index) => (
                <li key={index} className="flex items-center gap-3">
                  <Icon name="check" size="small" className="text-blue-500 flex-shrink-0" />
                  <Paragraph variant="t6" color="grey-700">
                    {resp}
                  </Paragraph>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tech Stack & Reasons */}
        {project.techReasons && project.techReasons.length > 0 && (
          <div>
            <Paragraph variant="t4" weight="bold" className="mb-3 flex items-center gap-2">
              <span className="text-blue-500">✔️</span>
              기술 스택 & 선정 이유
            </Paragraph>
            <div className="space-y-3">
              {project.techReasons.map((tech, index) => (
                <div key={index} className="border border-grey-200 rounded-lg p-4 hover:border-blue-300 transition-colors duration-200">
                  <Paragraph variant="t5" weight="bold" className="mb-2 text-blue-600">
                    {tech.name}
                  </Paragraph>
                  <ul className="space-y-2">
                    {tech.reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-grey-400 leading-[1] flex-shrink-0">-</span>
                        <Paragraph variant="t7" color="grey-700" className="leading-relaxed">
                          {reason}
                        </Paragraph>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Learnings */}
        {project.keyLearnings && project.keyLearnings.length > 0 && (
          <div>
            <Paragraph variant="t4" weight="bold" className="mb-4 flex items-center gap-2">
              <span className="text-yellow-500">✔️</span>
              배운 점
            </Paragraph>
            <div className="grid grid-cols-1 gap-3">
              {project.keyLearnings.map((learning, index) => {
                // ":" 기준으로 제목과 내용 분리
                const colonIndex = learning.indexOf(':');
                const title = colonIndex !== -1 ? learning.substring(0, colonIndex).trim() : '';
                const content = colonIndex !== -1 ? learning.substring(colonIndex + 1).trim() : learning;

                return (
                  <div
                    key={index}
                    className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-r-lg hover:shadow-md transition-all duration-300 group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-yellow-500 text-xl leading-[1] flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                        💡
                      </span>
                      <div className="flex-1 space-y-1">
                        {title && (
                          <Paragraph variant="t6" weight="bold" className="text-yellow-700">
                            {title}
                          </Paragraph>
                        )}
                        <Paragraph variant="t6" color="grey-700" className="leading-relaxed">
                          {content}
                        </Paragraph>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Project Reviews */}
        {project.reviews && project.reviews.length > 0 && (
          <div>
            <Paragraph variant="t4" weight="bold" className="mb-4 flex items-center gap-2">
              <span className="text-blue-500">✔️</span>
              프로젝트 리뷰
            </Paragraph>

            {/* Review Tabs */}
            {project.reviews.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto">
                {project.reviews.map((review, index) => (
                  <button
                    key={review.id}
                    onClick={() => setActiveReviewTab(index)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                      activeReviewTab === index
                        ? 'bg-blue-500 text-white'
                        : 'bg-grey-100 text-grey-700 hover:bg-grey-200'
                    }`}
                  >
                    {review.title}
                  </button>
                ))}
              </div>
            )}

            {/* Active Review */}
            <ReviewContent review={project.reviews[activeReviewTab]} />
          </div>
        )}

        {/* Links */}
        <div className="flex gap-3 justify-end pt-4 border-t border-grey-200">
          {project.githubUrl && (
            <Button
              variant="outline"
              leftIcon={<Icon name="share" />}
              onClick={() => window.open(project.githubUrl, '_blank')}
            >
              GitHub
            </Button>
          )}
          {project.demoUrl && (
            <Button
              leftIcon={<Icon name="arrow-right" />}
              onClick={() => window.open(project.demoUrl, '_blank')}
            >
              Live Demo
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Review Content Component
function ReviewContent({ review }: { review: ProjectReview }) {
  return (
    <div className="space-y-6 p-6 bg-grey-50 rounded-lg">
      <Paragraph variant="t3" weight="bold">
        {review.title}
      </Paragraph>

      {/* Review Image(s) */}
      {review.image && (
        <div className="w-full flex justify-center gap-4">
          {Array.isArray(review.image) ? (
            review.image.map((img, idx) => (
              <div key={idx} className="flex-1 max-w-md">
                <Image
                  src={img}
                  alt={`${review.title} - ${idx + 1}`}
                  width={800}
                  height={450}
                  className="w-full rounded-lg shadow-md"
                />
              </div>
            ))
          ) : (
            <div className="max-w-2xl">
              <Image
                src={review.image}
                alt={review.title}
                width={800}
                height={450}
                className="w-full rounded-lg shadow-md"
              />
            </div>
          )}
        </div>
      )}

      {/* Main Features */}
      {review.features && review.features.length > 0 && (
        <div>
          <Paragraph variant="t5" weight="semibold" className="mb-3">
            주요 기능
          </Paragraph>
          <ul className="space-y-2">
            {review.features.map((feature: string, index: number) => (
              <li key={index} className="flex items-center gap-2">
                <span className="text-blue-500 leading-[1] flex-shrink-0">•</span>
                <Paragraph variant="t6" color="grey-700">
                  {feature}
                </Paragraph>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Intent */}
      {review.intent && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <Paragraph variant="t6" weight="semibold" className="mb-2 text-yellow-800">
            🤔 기획 의도
          </Paragraph>
          <Paragraph variant="t7" color="grey-800" className="leading-relaxed">
            {review.intent}
          </Paragraph>
        </div>
      )}

      {/* Troubleshooting */}
      {review.troubleShooting && (
        <div className="border-2 border-orange-200 rounded-lg p-6 bg-white">
          <Paragraph variant="t5" weight="bold" className="mb-4 text-orange-600">
            🛠 트러블 슈팅: {review.troubleShooting.title}
          </Paragraph>

          {/* Initial Implementation */}
          {review.troubleShooting.initialImpl && (
            <div className="mb-4">
              <Paragraph variant="t6" weight="semibold" className="mb-2">
                초기 구현
              </Paragraph>
              <Paragraph variant="t7" color="grey-700" className="leading-relaxed">
                {review.troubleShooting.initialImpl}
              </Paragraph>
            </div>
          )}

          {/* Problem */}
          {review.troubleShooting.problem && review.troubleShooting.problem.length > 0 && (
            <div className="mb-4">
              <Paragraph variant="t6" weight="semibold" className="mb-2">
                문제 상황
              </Paragraph>
              <ul className="space-y-1">
                {review.troubleShooting.problem.map((p: string, index: number) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-red-500 leading-[1] flex-shrink-0">-</span>
                    <Paragraph variant="t7" color="grey-700">
                      {p}
                    </Paragraph>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Analysis */}
          {review.troubleShooting.analysis && review.troubleShooting.analysis.length > 0 && (
            <div className="mb-4">
              <Paragraph variant="t6" weight="semibold" className="mb-2">
                원인 분석
              </Paragraph>
              <ul className="space-y-1">
                {review.troubleShooting.analysis.map((a: string, index: number) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-grey-400 leading-[1] flex-shrink-0">•</span>
                    <Paragraph variant="t7" color="grey-700">
                      {a}
                    </Paragraph>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Solution */}
          {review.troubleShooting.solution && (
            <div className="mb-4">
              <Paragraph variant="t6" weight="semibold" className="mb-2">
                개선 방안
              </Paragraph>
              <Paragraph variant="t7" color="grey-700" className="leading-relaxed">
                {review.troubleShooting.solution}
              </Paragraph>
            </div>
          )}

          {/* Solution Code */}
          {review.troubleShooting.solutionCode && (
            <div className="mb-4">
              <pre className="bg-grey-900 text-grey-100 p-4 rounded-lg overflow-x-auto">
                <code className="text-sm">{review.troubleShooting.solutionCode}</code>
              </pre>
            </div>
          )}

          {/* Results */}
          {review.troubleShooting.results && review.troubleShooting.results.length > 0 && (
            <div className="mb-4">
              <Paragraph variant="t6" weight="semibold" className="mb-2">
                결과
              </Paragraph>
              <ul className="space-y-1">
                {review.troubleShooting.results.map((r: string, index: number) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-green-500 leading-[1] flex-shrink-0">✓</span>
                    <Paragraph variant="t7" color="grey-700">
                      {r}
                    </Paragraph>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lessons */}
          {review.troubleShooting.lessons && review.troubleShooting.lessons.length > 0 && (
            <div>
              <Paragraph variant="t6" weight="semibold" className="mb-2">
                느낀 점
              </Paragraph>
              <ul className="space-y-2">
                {review.troubleShooting.lessons.map((lesson: string, index: number) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-blue-500 leading-[1] flex-shrink-0">💡</span>
                    <Paragraph variant="t7" color="grey-700" className="leading-relaxed">
                      {lesson}
                    </Paragraph>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
