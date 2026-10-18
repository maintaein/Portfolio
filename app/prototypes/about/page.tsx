import type { Metadata } from 'next';
import AboutPrototype from './AboutPrototype';

export const metadata: Metadata = {
  title: 'About 디자인 시안',
  robots: { index: false, follow: false },
};

export default async function AboutPrototypePage({ searchParams }: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const { v } = await searchParams;
  const value = Number(v);
  const initialVariant = Number.isInteger(value) && value >= 1 && value <= 3 ? value - 1 : 0;
  return <AboutPrototype initialVariant={initialVariant} />;
}
