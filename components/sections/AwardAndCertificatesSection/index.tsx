'use client';

import { useState } from 'react';
import { useIntersection } from '@/hooks';
import Paragraph from '@/components/atoms/Paragraph';
import Badge from '@/components/atoms/Badge';
import SegmentedControl from '@/components/atoms/SegmentedControl';
import { Award, Certificate } from '@/types/index';
import { awards, certificates } from '@/lib/data';

type TabValue = 'awards' | 'certificates';

export default function AwardsAndCertificatesSection() {
  const [activeTab, setActiveTab] = useState<TabValue>('awards');

  const tabs = [
    { label: '수상 경력', value: 'awards' as TabValue },
    { label: '자격증', value: 'certificates' as TabValue },
  ];

  // 섹션 헤더 진입 감지
  const { ref: headerRef, isIntersecting: isHeaderVisible } = useIntersection({
    threshold: 0.5,
    freezeOnceVisible: true
  });

  return (
    <section id="awards-certificates" className="py-12 sm:py-16 lg:py-20 bg-grey-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div 
          ref={headerRef}
          className={`mb-12 text-center transition-all duration-1000 ${
            isHeaderVisible 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-8'
          }`}
        >
          <Paragraph variant="t2" weight="bold" className="mb-3">
            AWARDS & CERTIFICATES
          </Paragraph>
          <Paragraph variant="t5" color="grey-600">
            다양한 경험을 통해 인정받은 성과들입니다
          </Paragraph>
        </div>

        <TabControlSection activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />

        {activeTab === 'awards' && (
          <ItemsContainer items={awards} itemType="award" />
        )}

        {activeTab === 'certificates' && (
          <ItemsContainer items={certificates} itemType="certificate" />
        )}
      </div>

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

interface TabControlSectionProps {
  activeTab: TabValue;
  setActiveTab: (tab: TabValue) => void;
  tabs: Array<{ label: string; value: TabValue }>;
}

function TabControlSection({ activeTab, setActiveTab, tabs }: TabControlSectionProps) {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.5,
    freezeOnceVisible: true
  });

  return (
    <div
      ref={ref}
      className={`mb-8 flex justify-center transition-all duration-1000 ${
        isIntersecting
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95'
      }`}
    >
      <SegmentedControl
        options={tabs}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabValue)}
        size="large"
        fullWidth={false}
      />
    </div>
  );
}

interface ItemsContainerProps {
  items: (Award | Certificate)[];
  itemType: 'award' | 'certificate';
}

function ItemsContainer({ items, itemType }: ItemsContainerProps) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <AnimatedItem 
          key={item.id}
          item={item}
          index={index}
          itemType={itemType}
        />
      ))}
    </div>
  );
}

interface AnimatedItemProps {
  item: Award | Certificate;
  index: number;
  itemType: 'award' | 'certificate';
}

function AnimatedItem({ item, index }: AnimatedItemProps) {
  const { ref, isIntersecting } = useIntersection({
    threshold: 0.1,
    freezeOnceVisible: true
  });

  // Award인지 Certificate인지 타입 체크
  const isAward = (item: Award | Certificate): item is Award => 'rank' in item;

  return (
    <div
      ref={ref}
      className={`bg-white border border-grey-200 rounded-xl p-6 hover:shadow-lg hover:border-primary-300 transition-all duration-700 transform ${
        isIntersecting
          ? 'opacity-100 translate-x-0 scale-100'
          : 'opacity-0 -translate-x-8 scale-95'
      }`}
      style={{
        transitionDelay: isIntersecting ? `${index * 0.1}s` : '0s',
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      {isAward(item) ? (
        // 수상 경력 아이템
        <div>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {item.rank && (
                  <span className="text-xl sm:text-2xl whitespace-nowrap">{item.rank}</span>
                )}
                <Paragraph variant="t4" weight="bold">
                  {item.title}
                </Paragraph>
              </div>
              <Paragraph variant="t6" color="grey-600" className="mb-1">
                {item.organization}
              </Paragraph>
            </div>
            <Badge color="blue" variant="weak" size="small">
              {item.date}
            </Badge>
          </div>
          {item.description && (
            <Paragraph variant="t6" color="grey-700" className="leading-relaxed">
              {item.description}
            </Paragraph>
          )}
        </div>
      ) : (
        // 자격증 아이템
        <div>
          <div className="flex items-start justify-between mb-2">
            <Paragraph variant="t4" weight="bold">
              {item.name}
            </Paragraph>
            <Badge color="green" variant="weak" size="small">
              {item.date}
            </Badge>
          </div>
          <Paragraph variant="t6" color="grey-600" className="mb-2">
            {item.organization}
          </Paragraph>
          {(item.validUntil || item.credentialId) && (
            <div className="flex gap-4 text-sm text-grey-500">
              {item.validUntil && (
                <Paragraph variant="t7" color="grey-500">
                  유효기간: {item.validUntil}
                </Paragraph>
              )}
              {item.credentialId && (
                <Paragraph variant="t7" color="grey-500">
                  ID: {item.credentialId}
                </Paragraph>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}