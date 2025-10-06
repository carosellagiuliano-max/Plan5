import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { sessionStatus } from '@/lib/api';
import { assertLocale } from '@/i18n/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@plan5/ui';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'portal' });
  return {
    title: t('title'),
    description: t('welcome', { name: 'Guest' })
  };
}

export default async function PortalPage({ params }: { params: { locale: string } }) {
  assertLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: 'portal' });
  const session = await sessionStatus();

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('welcome', { name: 'Guest' })}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <span>Session expires: {new Date(session.expiresAt).toLocaleString(params.locale)}</span>
          <span>Last seen: {new Date(session.lastSeenAt).toLocaleString(params.locale)}</span>
          <span>IP hash: {session.ipHash}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming stay</CardTitle>
          <CardDescription>Track and manage your reservations.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p>Next stay: 12.12.2025 - Alpine Lodge Engelberg</p>
          <p>Balance due: CHF 420.00</p>
        </CardContent>
      </Card>
    </section>
  );
}
