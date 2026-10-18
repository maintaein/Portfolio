import type { Metadata } from 'next';
import AboutPrototype from '../about/AboutPrototype';

export const metadata: Metadata = { title: 'About 스크롤 전환 시안', robots: { index: false, follow: false } };
export default async function AboutMotionPage({ searchParams }: { searchParams: Promise<{ v?: string | string[] }> }) {
  const { v } = await searchParams;
  const value = Number(v);
  return <AboutPrototype motion initialVariant={Number.isInteger(value) && value >= 1 && value <= 3 ? value - 1 : 0} />;
}
