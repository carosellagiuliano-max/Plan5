import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/booking', '/shop', '/home', '/admin', '/legal', '/legal/imprint', '/legal/privacy', '/legal/terms'];
  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `https://plan5.example.com/${locale}${route}`,
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1 : 0.7
    }))
  );
}
