import { notFound } from 'next/navigation';
import type { Locale } from '@plan5/types';

export const locales: Locale[] = ['en-CH', 'de-CH', 'fr-CH'];
export const defaultLocale: Locale = 'en-CH';

export function assertLocale(locale: string): asserts locale is Locale {
  if (!locales.includes(locale as Locale)) {
    notFound();
  }
}
