import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/'],
      disallow: ['/api/']
    },
    sitemap: 'https://plan5.example.com/sitemap.xml'
  };
}
