import { revalidateTag } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { Buffer } from 'node:buffer';
import type {
  BookingPayload,
  BookingResponse,
  ComplianceRequestPayload,
  ComplianceStatusResponse,
  EmailTemplatePayload,
  InvoiceRequest,
  InvoiceResponse,
  OrderPayload,
  OrderResponse,
  PaymentIntentRequest,
  PaymentIntentResponse,
  ProductSummary,
  RefundRequest,
  RefundResponse,
  SessionStatus,
  SumUpDeepLinkPayload,
  SumUpStatusResponse
} from '@plan5/types';

const BOOKING_TAG = 'bookings';
const SHOP_TAG = 'shop';

const SUPABASE_EDGE_URL = process.env.SUPABASE_EDGE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_EDGE_URL;
const SUPABASE_EDGE_KEY = process.env.SUPABASE_EDGE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_EDGE_KEY;

async function callEdgeFunction<T>(name: string, init: RequestInit & { searchParams?: Record<string, string> } = {}) {
  if (!SUPABASE_EDGE_URL) {
    throw new Error('SUPABASE_EDGE_URL is not configured');
  }
  const url = new URL(name, SUPABASE_EDGE_URL.endsWith('/') ? SUPABASE_EDGE_URL : `${SUPABASE_EDGE_URL}/`);
  if (init.searchParams) {
    Object.entries(init.searchParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(SUPABASE_EDGE_KEY ? { Authorization: `Bearer ${SUPABASE_EDGE_KEY}` } : {}),
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`Edge function ${name} failed: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

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

export async function createPaymentIntent(payload: PaymentIntentRequest): Promise<PaymentIntentResponse> {
  return await callEdgeFunction<PaymentIntentResponse>('payments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function refundPayment(payload: RefundRequest): Promise<RefundResponse> {
  return await callEdgeFunction<RefundResponse>('payments/refunds', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function pollSumUpStatus(checkoutId: string): Promise<SumUpStatusResponse> {
  return await callEdgeFunction<SumUpStatusResponse>(`payments/sumup/status/${checkoutId}`);
}

export async function generateInvoiceDocument(payload: InvoiceRequest): Promise<InvoiceResponse> {
  return await callEdgeFunction<InvoiceResponse>('invoices', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function sendTransactionalEmail(payload: EmailTemplatePayload) {
  return await callEdgeFunction('emails', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function requestComplianceAction(
  payload: ComplianceRequestPayload
): Promise<ComplianceStatusResponse> {
  return await callEdgeFunction<ComplianceStatusResponse>('compliance', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
