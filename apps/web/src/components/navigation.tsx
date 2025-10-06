'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@plan5/ui';
import { useMemo } from 'react';

type NavItem = { href: string; label: string };

export function Navigation({ locale }: { locale: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const items: NavItem[] = useMemo(
    () => [
      { href: `/${locale}`, label: t('home') },
      { href: `/${locale}/booking`, label: t('booking') },
      { href: `/${locale}/shop`, label: t('shop') },
      { href: `/${locale}/home`, label: t('portal') },
      { href: `/${locale}/admin`, label: t('admin') },
      { href: `/${locale}/legal`, label: t('legal') }
    ],
    [locale, t]
  );

  return (
    <nav className="flex flex-wrap items-center justify-between gap-4 py-4">
      <span className="text-lg font-semibold">Plan5</span>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Button
              key={item.href}
              asChild
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
