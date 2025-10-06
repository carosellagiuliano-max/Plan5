export type Locale = 'en-CH' | 'de-CH' | 'fr-CH';

export type BookingStep = 'details' | 'confirmation' | 'payment' | 'complete';

export interface BookingPayload {
  id?: string;
  customerName: string;
  customerEmail: string;
  partySize: number;
  requestedAt: string;
  notes?: string;
  locale?: Locale;
}

export interface BookingResponse {
  id: string;
  status: 'pending' | 'confirmed' | 'failed';
  locale: Locale;
}

export interface ProductSummary {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  available: boolean;
}

export interface OrderPayload {
  idempotencyKey?: string;
  productId: string;
  quantity: number;
  locale: Locale;
}

export interface OrderResponse {
  orderId: string;
  status: 'processing' | 'completed' | 'errored';
}

export interface SumUpDeepLinkPayload {
  amount: number;
  currency: string;
  reference: string;
}

export interface SessionStatus {
  expiresAt: string;
  lastSeenAt: string;
  ipHash: string;
}
