import type { Metadata } from 'next';
import { assertLocale } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Imprint'
  };
}

export default function ImprintPage({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  return (
    <article className="space-y-3 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Imprint</h1>
      <p>Plan5 AG, Bahnhofstrasse 1, 8000 Zürich, Switzerland.</p>
      <p>Contact: compliance@plan5.ch</p>
      <p>VAT: CHE-123.456.789.</p>
    </article>
  );
}
