import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  captureException,
  getSupabaseClient,
  logError,
  logInfo,
  recordAudit,
  requireEnv,
  withIdempotency,
} from '../_shared/mod.ts';

const InvoiceRequestSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  locale: z.string().default('en-CH'),
  dueDate: z.string().datetime().optional(),
  sendEmail: z.boolean().default(false),
  emailOverride: z.string().email().optional(),
});

type InvoiceRequest = z.infer<typeof InvoiceRequestSchema>;

function formatSwissAmount(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function buildSwissQRBill(params: {
  iban: string;
  creditor: { name: string; address: string; postalCode: string; city: string; country: string };
  reference: string;
  amountCents: number;
  currency: string;
  debtor?: { name?: string; address?: string; postalCode?: string; city?: string; country?: string };
}): string {
  const lines = [
    'SPC',
    '0200',
    '1',
    params.iban,
    '',
    params.creditor.name,
    params.creditor.address,
    `${params.creditor.postalCode} ${params.creditor.city}`,
    params.creditor.country,
    '',
    '',
    '',
    '',
    '',
    formatSwissAmount(params.amountCents),
    params.currency,
    params.reference,
    '',
    params.debtor?.name ?? '',
    params.debtor?.address ?? '',
    `${params.debtor?.postalCode ?? ''} ${params.debtor?.city ?? ''}`.trim(),
    params.debtor?.country ?? '',
    '',
    '',
    '',
  ];
  const payload = lines.join('\n');
  return btoa(payload);
}

async function getNextInvoiceNumber(client: ReturnType<typeof getSupabaseClient>, tenantId: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const { data, error } = await client
    .from('invoices')
    .select('invoice_number')
    .eq('tenant_id', tenantId)
    .gte('issued_at', `${year}-01-01`)
    .order('invoice_number', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return `${year}-001`;
  const lastNumber = data[0].invoice_number.split('-')[1];
  const next = String(Number(lastNumber) + 1).padStart(3, '0');
  return `${year}-${next}`;
}

async function buildInvoice(
  client: ReturnType<typeof getSupabaseClient>,
  payload: InvoiceRequest,
) {
  const { data: order, error: orderError } = await client
    .from('orders')
    .select('id, tenant_id, customer_id, total_cents, currency, metadata')
    .eq('id', payload.orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new Error('Order not found');
  const billingMetadata = (order.metadata ?? {}) as Record<string, string>;

  const { data: customer } = await client
    .from('profiles')
    .select('full_name')
    .eq('id', order.customer_id)
    .maybeSingle();

  const { data: items, error: itemsError } = await client
    .from('order_items')
    .select('description, quantity, unit_price_cents')
    .eq('order_id', payload.orderId);
  if (itemsError) throw itemsError;

  const { data: vatSettings } = await client
    .from('vat_settings')
    .select('rate, label')
    .eq('tenant_id', payload.tenantId)
    .lte('effective_from', new Date().toISOString().slice(0, 10));

  const vatRate = vatSettings?.[0]?.rate ?? 0;
  const vatSummary = vatRate
    ? [{ rate: Number(vatRate), amountCents: Math.round(order.total_cents - order.total_cents / (1 + Number(vatRate) / 100)) }]
    : [];

  const issuedAt = new Date().toISOString();
  const dueAt = payload.dueDate ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const invoiceNumber = await getNextInvoiceNumber(client, payload.tenantId);

  const creditor = {
    name: requireEnv('BILLING_COMPANY_NAME'),
    address: requireEnv('BILLING_COMPANY_ADDRESS'),
    postalCode: requireEnv('BILLING_COMPANY_POSTAL_CODE'),
    city: requireEnv('BILLING_COMPANY_CITY'),
    country: requireEnv('BILLING_COMPANY_COUNTRY'),
  };
  const iban = requireEnv('BILLING_IBAN');
  const qrBill = buildSwissQRBill({
    iban,
    creditor,
    reference: `RF${invoiceNumber.replace('-', '')}`,
    amountCents: order.total_cents,
    currency: order.currency,
    debtor: customer
      ? {
        name: customer.full_name ?? 'Customer',
        address: billingMetadata.billing_address ?? '',
        postalCode: billingMetadata.billing_postal ?? '',
        city: billingMetadata.billing_city ?? '',
        country: billingMetadata.billing_country ?? 'CH',
      }
      : undefined,
  });

  const { data: invoice, error: insertError } = await client
    .from('invoices')
    .insert({
      tenant_id: payload.tenantId,
      order_id: payload.orderId,
      invoice_number: invoiceNumber,
      issued_at: issuedAt,
      due_at: dueAt,
      currency: order.currency,
      total_cents: order.total_cents,
      vat_summary: vatSummary,
      qr_bill_payload: qrBill,
      metadata: { locale: payload.locale },
    })
    .select('id')
    .maybeSingle();
  if (insertError) throw insertError;

  const invoiceId = invoice?.id as string;
  const { error: itemsInsertError } = await client.from('invoice_items').insert(
    items.map((item) => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      vat_rate: vatRate,
    })),
  );
  if (itemsInsertError) throw itemsInsertError;

  const checksumBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ invoiceNumber }))),
  );
  const checksum = Array.from(checksumBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const { error: archiveError } = await client.from('invoice_archives').insert({
    invoice_id: invoiceId,
    storage_path: `invoices/${invoiceId}.json`,
    checksum,
  });
  if (archiveError) throw archiveError;

  await recordAudit(client, {
    tenantId: payload.tenantId,
    action: 'invoice.generated',
    resource: invoiceId,
    changes: { invoiceNumber },
  });

  const response = {
    invoiceId,
    invoiceNumber,
    issuedAt,
    dueDate: dueAt,
    totalCents: order.total_cents,
    currency: order.currency,
    qrBillPayload: qrBill,
    lineItems: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      vatRate: vatRate ? Number(vatRate) : undefined,
    })),
    vatSummary,
  };

  return { response, customerEmail: payload.emailOverride ?? billingMetadata.billing_email };
}

async function sendInvoiceEmail(
  payload: InvoiceRequest,
  invoice: ReturnType<typeof buildInvoice> extends Promise<infer R> ? R['response'] : never,
  customerEmail?: string,
) {
  if (!payload.sendEmail || !customerEmail) return;
  const emailEndpoint = requireEnv('EMAIL_FUNCTION_URL');
  await fetch(emailEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      to: customerEmail,
      template: 'invoice_ready',
      locale: payload.locale,
      data: {
        invoiceNumber: invoice.invoiceNumber,
        amount: formatSwissAmount(invoice.totalCents),
        currency: invoice.currency,
        dueDate: invoice.dueDate,
      },
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.json`,
          content: btoa(JSON.stringify(invoice)),
          type: 'application/json',
        },
      ],
    }),
  }).catch((error) => logError('invoice.email_failed', { error }));
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = InvoiceRequestSchema.parse(await req.json());
    const client = getSupabaseClient(req);
    const idempotencyKey = `invoice:${payload.orderId}`;

    const result = await withIdempotency(client, idempotencyKey, 86400, async () => {
      const { response, customerEmail } = await buildInvoice(client, payload);
      await sendInvoiceEmail(payload, response, customerEmail);
      return response;
    }, { tenantId: payload.tenantId });

    logInfo('invoice.generated', { requestId, orderId: payload.orderId, traceparent });
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    await captureException(error, { requestId, traceparent });
    logError('invoice_failed', { requestId, error, traceparent });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
