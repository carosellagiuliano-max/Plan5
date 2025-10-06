'use client';

import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@plan5/ui';
import Link from 'next/link';

export function Hero({ locale }: { locale: string }) {
  const t = useTranslations('hero');

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-background to-secondary/30">
      <CardHeader>
        <CardTitle className="text-4xl font-bold">{t('title')}</CardTitle>
        <CardDescription className="max-w-2xl text-base">
          {t('subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/${locale}/booking`}>Book now</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/${locale}/shop`}>Shop gifts</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
