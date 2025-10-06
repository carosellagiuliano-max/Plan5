import { revalidateTag } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { Buffer } from 'node:buffer';
import type {
  BookingPayload,
  BookingResponse,
  OrderPayload,
  OrderResponse,
  ProductSummary,
  SessionStatus,
  SumUpDeepLinkPayload
} from '@plan5/types';

const BOOKING_TAG = 'bookings';
const SHOP_TAG = 'shop';

function withDelay<T>(data: T, ms = 200) {
  return new Promise<T>((resolve) => setTimeout(() => resolve(data), ms));
}

export async function createBooking(payload: BookingPayload): Promise<BookingResponse> {
  const id = payload.id ?? randomUUID();
  const locale = payload.locale ?? 'en-CH';
  const res: BookingResponse = {
    id,
    status: 'confirmed',
    locale: locale as BookingResponse['locale']
  };
  revalidateTag(BOOKING_TAG);
  return withDelay(res);
}

export async function listProducts(locale: string): Promise<ProductSummary[]> {
  return withDelay([
    {
      id: 'gift-card',
      name: locale === 'de-CH' ? 'Geschenkkarte' : locale === 'fr-CH' ? 'Carte cadeau' : 'Gift card',
      description:
        locale === 'de-CH'
          ? 'Flexible Guthaben für Aufenthalte.'
          : locale === 'fr-CH'
          ? 'Crédit flexible pour vos séjours.'
          : 'Flexible credit for future stays.',
      price: 120,
      currency: 'CHF',
      available: true
    },
    {
      id: 'spa-pass',
      name: locale === 'de-CH' ? 'Spa-Pass' : locale === 'fr-CH' ? 'Pass spa' : 'Spa pass',
      description:
        locale === 'de-CH'
          ? 'Tagespass für das Wellness-Angebot.'
          : locale === 'fr-CH'
          ? "Accès journalier au spa."
          : 'Day access to the spa amenities.',
      price: 75,
      currency: 'CHF',
      available: true
    }
  ] satisfies ProductSummary[]);
}

export async function createOrder(payload: OrderPayload): Promise<OrderResponse> {
  const headerList = await headers();
  const idempotencyKey = payload.idempotencyKey ?? headerList.get('x-idempotency-key') ?? randomUUID();
  const response: OrderResponse = {
    orderId: idempotencyKey,
    status: 'completed'
  };
  revalidateTag(SHOP_TAG);
  return withDelay(response, 350);
}

export async function generateSumUpDeepLink(payload: SumUpDeepLinkPayload) {
  const params = new URLSearchParams({
    amount: payload.amount.toFixed(2),
    currency: payload.currency,
    ref: payload.reference
  });
  return `sumupmerchant://pay?${params.toString()}`;
}

export async function sessionStatus(): Promise<SessionStatus> {
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for') ?? '0.0.0.0';
  const now = new Date();
  return {
    expiresAt: new Date(now.getTime() + 1000 * 60 * 30).toISOString(),
    lastSeenAt: now.toISOString(),
    ipHash: Buffer.from(ip).toString('base64url')
  };
}
