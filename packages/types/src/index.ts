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

export type PaymentProvider = 'stripe' | 'sumup';

export interface PaymentIntentRequest {
  tenantId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  locale?: Locale;
  mode?: 'payment_intent' | 'checkout_session';
  provider?: PaymentProvider;
  appointmentId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PaymentIntentResponse {
  provider: PaymentProvider;
  clientSecret?: string;
  checkoutUrl?: string;
  intentId: string;
  status: 'requires_action' | 'requires_payment_method' | 'processing' | 'succeeded' | 'pending';
  amountCents: number;
  currency: string;
  nextAction?: {
    type: 'redirect' | 'use_stripe_sdk' | 'sumup_app_switch';
    url?: string;
  };
}

export interface RefundRequest {
  tenantId: string;
  orderId: string;
  transactionId: string;
  amountCents?: number;
  reason?: string;
  initiatedBy: 'customer' | 'staff' | 'system';
}

export interface RefundResponse {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountCents: number;
  currency: string;
  provider: PaymentProvider;
}

export interface SumUpStatusResponse {
  checkoutId: string;
  status: 'pending' | 'successful' | 'failed' | 'cancelled';
  amountCents: number;
  currency: string;
  lastPolledAt: string;
  deeplink?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatRate?: number;
}

export interface InvoiceRequest {
  tenantId: string;
  orderId: string;
  locale?: Locale;
  dueDate?: string;
  sendEmail?: boolean;
  emailOverride?: string;
}

export interface InvoiceResponse {
  invoiceId: string;
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  totalCents: number;
  currency: string;
  pdfUrl?: string;
  qrBillPayload?: string;
  lineItems: InvoiceLineItem[];
  vatSummary: Array<{ rate: number; amountCents: number }>;
}

export interface EmailTemplatePayload {
  to: string;
  cc?: string[];
  bcc?: string[];
  locale?: Locale;
  template:
    | 'booking_confirmation'
    | 'payment_receipt'
    | 'invoice_ready'
    | 'reminder_upcoming'
    | 'gdpr_export_ready'
    | 'gdpr_deletion_confirmed'
    | 'custom';
  subject?: string;
  data?: Record<string, unknown>;
  attachments?: Array<{ filename: string; content: string; type: string }>;
  ics?: {
    uid: string;
    start: string;
    end: string;
    summary: string;
    description?: string;
    location?: string;
  }[];
  providerHint?: 'resend' | 'postmark';
}

export interface EmailProviderHealth {
  provider: 'resend' | 'postmark';
  status: 'operational' | 'degraded' | 'down';
  lastCheckedAt: string;
  guidance: string;
}

export interface ReminderPayload {
  tenantId: string;
  resourceType: 'appointment' | 'order' | 'invoice' | 'consent';
  resourceId: string;
  deliverAt: string;
  channel: 'email' | 'sms' | 'webhook';
  locale?: Locale;
  template: EmailTemplatePayload['template'];
  data?: Record<string, unknown>;
}

export interface ComplianceRequestPayload {
  tenantId: string;
  subjectId: string;
  type: 'export' | 'delete';
  initiatedBy: 'customer' | 'staff' | 'system';
  reason?: string;
}

export interface ComplianceStatusResponse {
  requestId: string;
  status: 'queued' | 'in_progress' | 'completed' | 'rejected';
  completedAt?: string;
  exportUrl?: string;
}
