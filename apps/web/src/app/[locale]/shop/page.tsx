import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ShopGrid } from '@/components/shop-grid';
import { assertLocale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'shop' });
  return {
    title: t('title'),
    description: t('cta')
  };
}

export default async function ShopPage({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'shop' });
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <ShopGrid locale={params.locale} />
    </section>
  );
}
