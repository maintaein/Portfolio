import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/siteConfig';

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date();

  return [
    {
      url: siteConfig.url,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
