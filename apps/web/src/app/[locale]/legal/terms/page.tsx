import type { Metadata } from 'next';
import { assertLocale } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Terms of service'
  };
}

export default function TermsPage({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  return (
    <article className="space-y-3 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Terms of service</h1>
      <p>Reservations are confirmed upon receipt of payment. Cancellation free of charge until 7 days prior to arrival.</p>
      <p>Jurisdiction is Zürich, Switzerland. Swiss law applies.</p>
    </article>
  );
}
