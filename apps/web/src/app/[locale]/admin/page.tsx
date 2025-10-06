import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminDashboard } from '@/components/admin-dashboard';
import { assertLocale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'admin' });
  return {
    title: t('title'),
    description: t('sumup')
  };
}

export default async function AdminPage({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'admin' });
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('sumup')}</p>
      <AdminDashboard />
    </section>
  );
}
