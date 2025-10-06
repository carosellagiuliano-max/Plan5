import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { assertLocale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  assertLocale(params.locale);
  return {
    title: 'Legal information',
    robots: {
      index: true
    }
  };
}

export default async function LegalIndex({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'legal' });
  const nav = await getTranslations({ locale: params.locale, namespace: 'nav' });
  const base = `/${params.locale}/legal`;
  const links = [
    { href: `${base}/imprint`, label: t('imprint') },
    { href: `${base}/privacy`, label: t('privacy') },
    { href: `${base}/terms`, label: t('terms') }
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">{nav('legal')}</h1>
      <ul className="grid gap-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link className="text-primary underline-offset-4 hover:underline" href={link.href}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
