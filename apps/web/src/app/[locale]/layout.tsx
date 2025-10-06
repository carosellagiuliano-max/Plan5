import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { AppProviders } from '@/components/providers';
import { Navigation } from '@/components/navigation';
import { assertLocale, locales } from '@/i18n/config';
import { getMessages } from 'next-intl/server';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamic = 'force-static';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  assertLocale(params.locale);
  const localizedTitle =
    params.locale === 'de-CH'
      ? 'Plan5 Plattform'
      : params.locale === 'fr-CH'
      ? 'Plateforme Plan5'
      : 'Plan5 Platform';
  return {
    title: localizedTitle,
    alternates: {
      canonical: `https://plan5.example.com/${params.locale}`
    },
    openGraph: {
      title: localizedTitle,
      url: `https://plan5.example.com/${params.locale}`,
      type: 'website'
    }
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const locale = params.locale;
  assertLocale(locale);

  const messages = await getMessages({ locale });
  if (!messages) {
    notFound();
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppProviders>
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-12">
          <Navigation locale={locale} />
          <main className="flex-1 space-y-8">{children}</main>
          <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
            © {new Date().getFullYear()} Plan5
          </footer>
        </div>
      </AppProviders>
    </NextIntlClientProvider>
  );
}
