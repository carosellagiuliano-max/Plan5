import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from './config';
import type { Locale } from '@plan5/types';

export default getRequestConfig(async ({ locale }) => {
  const normalized: Locale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const messages = (await import(`./messages/${normalized}.json`)).default;

  return {
    messages
  };
});
