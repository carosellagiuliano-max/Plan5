import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Hero } from '@/components/hero';
import { sessionStatus } from '@/lib/api';
import { assertLocale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'hero' });
  return {
    title: t('title'),
    description: t('subtitle')
  };
}

export default async function LandingPage({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'portal' });
  const session = await sessionStatus();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: 'Plan5',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CH'
    },
    url: `https://plan5.example.com/${params.locale}`
  };

  return (
    <div className="space-y-8">
      <Hero locale={params.locale} />
      <section className="grid gap-6 rounded-xl border border-border p-6">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('welcome', { name: 'Guest' })}
          </p>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
          <span>Session expires: {new Date(session.expiresAt).toLocaleString(params.locale)}</span>
          <span>Last seen: {new Date(session.lastSeenAt).toLocaleString(params.locale)}</span>
          <span>IP hash: {session.ipHash}</span>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
