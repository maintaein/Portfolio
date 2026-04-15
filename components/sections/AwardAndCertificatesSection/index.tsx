'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Paragraph from '@/components/atoms/Paragraph';
import Badge from '@/components/atoms/Badge';
import SegmentedControl from '@/components/atoms/SegmentedControl';
import { SectionHeader } from '@/components/blocks';
import { Award, Certificate } from '@/types/index';
import { awards, certificates } from '@/lib/data';

type TabValue = 'awards' | 'certificates';

const rankAccent = (rank?: string) => {
  if (!rank) return { bar: 'bg-blue-400',    numColor: 'text-blue-300'    };
  if (rank.includes('1') || rank.includes('최우수')) return { bar: 'bg-amber-400',  numColor: 'text-amber-200'  };
  if (rank.includes('2') || rank.includes('우수'))   return { bar: 'bg-slate-400',  numColor: 'text-slate-300'  };
  if (rank.includes('3') || rank.includes('장려'))   return { bar: 'bg-orange-400', numColor: 'text-orange-300' };
  return { bar: 'bg-blue-400', numColor: 'text-blue-300' };
};

export default function AwardsAndCertificatesSection() {
  const [activeTab, setActiveTab] = useState<TabValue>('awards');
  const [tabKey, setTabKey] = useState(0);

  const tabs = [
    { label: '수상 경력', value: 'awards' as TabValue },
    { label: '자격증',   value: 'certificates' as TabValue },
  ];

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    setTabKey(prev => prev + 1);
  };

  const currentItems = activeTab === 'awards' ? awards : certificates;

  return (
    <section id="awards-certificates" className="py-12 sm:py-16 lg:py-20 bg-grey-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <SectionHeader
          title="AWARDS & CERTIFICATES"
          subtitle="다양한 경험을 통해 인정받은 성과들입니다"
        />

        {/* 탭 컨트롤 */}
        <motion.div
          className="mb-10 flex justify-center"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <SegmentedControl
            options={tabs}
            value={activeTab}
            onChange={handleTabChange}
            size="large"
            fullWidth={false}
          />
        </motion.div>

        {/* 아이템 목록 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tabKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {currentItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeTab === 'awards'
                  ? <AwardItem item={item as Award} index={index} />
                  : <CertItem item={item as Certificate} index={index} />
                }
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function AwardItem({ item, index }: { item: Award; index: number }) {
  const accent = rankAccent(item.rank);

  return (
    <div className="flex gap-0 bg-white rounded-2xl overflow-hidden border border-grey-100 shadow-sm">
      {/* 왼쪽 accent bar + 순번 */}
      <div className={`w-1.5 flex-shrink-0 ${accent.bar}`} />

      <div className="flex-1 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* 순번 */}
            <span className={`text-[28px] font-black leading-none ${accent.numColor} select-none flex-shrink-0 mt-0.5`}>
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {item.rank && (
                  <span className="text-[13px] font-bold text-grey-400">{item.rank}</span>
                )}
                <Paragraph variant="t4" weight="bold" className="leading-snug">
                  {item.title}
                </Paragraph>
              </div>
              <Paragraph variant="t6" color="grey-500">
                {item.organization}
              </Paragraph>
              {item.description && (
                <Paragraph variant="t6" color="grey-600" className="mt-2 leading-relaxed">
                  {item.description}
                </Paragraph>
              )}
            </div>
          </div>

          {/* 날짜 badge */}
          <Badge color="blue" variant="weak" size="small" className="flex-shrink-0 mt-0.5">
            {item.date}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function CertItem({ item, index }: { item: Certificate; index: number }) {
  return (
    <div className="flex gap-0 bg-white rounded-2xl overflow-hidden border border-grey-100 shadow-sm">
      {/* 왼쪽 accent bar */}
      <div className="w-1.5 flex-shrink-0 bg-emerald-400" />

      <div className="flex-1 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* 순번 */}
            <span className="text-[28px] font-black leading-none text-emerald-200 select-none flex-shrink-0 mt-0.5">
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="flex-1 min-w-0">
              <Paragraph variant="t4" weight="bold" className="mb-1 leading-snug">
                {item.name}
              </Paragraph>
              <Paragraph variant="t6" color="grey-500" className="mb-1">
                {item.organization}
              </Paragraph>
              {(item.validUntil || item.credentialId) && (
                <div className="flex gap-4 mt-1.5">
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
          </div>

          <Badge color="green" variant="weak" size="small" className="flex-shrink-0 mt-0.5">
            {item.date}
          </Badge>
        </div>
      </div>
    </div>
  );
}
