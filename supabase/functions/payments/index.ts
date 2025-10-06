import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  getSupabaseClient,
  withIdempotency,
  logInfo,
  logError,
  captureException,
} from '../_shared/mod.ts';

const PaymentRequestSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  provider: z.enum(['stripe', 'sumup']),
  amountCents: z.number().positive(),
  currency: z.string().length(3),
  customerEmail: z.string().email(),
});

type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

async function createStripeIntent(payload: PaymentRequest) {
  const apiKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!apiKey) throw new Error('Missing Stripe key');
  const params = new URLSearchParams({
    amount: payload.amountCents.toString(),
    currency: payload.currency.toLowerCase(),
    'automatic_payment_methods[enabled]': 'true',
    receipt_email: payload.customerEmail,
    metadata: JSON.stringify({ order_id: payload.orderId, tenant_id: payload.tenantId }),
  });
  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `order-${payload.orderId}`,
    },
    body: params,
  });
  if (!response.ok) {
    throw new Error(`Stripe error: ${await response.text()}`);
  }
  return await response.json();
}

async function createSumUpCheckout(payload: PaymentRequest) {
  const clientId = Deno.env.get('SUMUP_CLIENT_ID');
  const accessToken = Deno.env.get('SUMUP_ACCESS_TOKEN');
  if (!clientId || !accessToken) throw new Error('Missing SumUp credentials');
  const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      amount: payload.amountCents / 100,
      currency: payload.currency.toUpperCase(),
      checkout_reference: payload.orderId,
      merchant_code: clientId,
      pay_to_email: payload.customerEmail,
    }),
  });
  if (!response.ok) {
    throw new Error(`SumUp error: ${await response.text()}`);
  }
  return await response.json();
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = PaymentRequestSchema.parse(await req.json());
    const client = getSupabaseClient(req);
    const idKey = `payment:${payload.orderId}`;

    const result = await withIdempotency(client, idKey, 3600, async () => {
      const { data: order, error: orderError } = await client
        .from('orders')
        .select('status')
        .eq('id', payload.orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) throw new Error('Order not found');

      let providerResponse: unknown;
      if (payload.provider === 'stripe') {
        providerResponse = await createStripeIntent(payload);
      } else {
        providerResponse = await createSumUpCheckout(payload);
      }

      const { error: updateError } = await client
        .from('orders')
        .update({
          status: 'pending',
          payment_intent_id: payload.provider === 'stripe'
            ? (providerResponse as { id: string }).id
            : (providerResponse as { id?: string; checkout_reference?: string }).id ?? payload.orderId,
        })
        .eq('id', payload.orderId);
      if (updateError) throw updateError;

      logInfo('payment.intent.created', { requestId, orderId: payload.orderId, provider: payload.provider, traceparent });
      return { provider: payload.provider, providerResponse };
    }, { tenantId: payload.tenantId });

    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
  } catch (error) {
    await captureException(error, { requestId, traceparent });
    logError('payment_failed', { requestId, error, traceparent });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
