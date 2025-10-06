import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingWizard } from '@/components/booking-wizard';
import { assertLocale } from '@/i18n/config';
import type { Locale } from '@plan5/types';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'booking' });
  return {
    title: t('title'),
    description: t('details')
  };
}

export default async function BookingPage({ params }: { params: { locale: Locale } }) {
  assertLocale(params.locale);
  return (
    <section className="space-y-6">
      <BookingWizard locale={params.locale} />
    </section>
  );
}
