import type { Metadata } from 'next';
import { assertLocale } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Privacy policy'
  };
}

export default function PrivacyPage({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  return (
    <article className="space-y-3 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Privacy policy</h1>
      <p>We process personal data exclusively within Switzerland and the EU.</p>
      <p>Data is retained for a maximum of 24 months unless longer retention is required by law.</p>
      <p>You can request deletion by contacting privacy@plan5.ch.</p>
    </article>
  );
}
