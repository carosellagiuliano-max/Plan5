import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/api';
import { defaultLocale } from '@/i18n/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') ?? defaultLocale;
  const products = await listProducts(locale);
  return NextResponse.json(products, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
  });
}
