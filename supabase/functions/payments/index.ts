import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  captureException,
  getSupabaseClient,
  logError,
  logInfo,
  recordAudit,
  requireEnv,
  verifyStripeSignature,
  withIdempotency,
} from '../_shared/mod.ts';

const PaymentIntentSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  locale: z.string().optional(),
  mode: z.enum(['payment_intent', 'checkout_session']).default('payment_intent'),
  provider: z.enum(['stripe', 'sumup']).default('stripe'),
  appointmentId: z.string().uuid().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const RefundSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  transactionId: z.string().uuid(),
  amountCents: z.number().int().positive().optional(),
  reason: z.string().optional(),
  initiatedBy: z.enum(['customer', 'staff', 'system']),
});

const ManualSumUpSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  checkoutId: z.string(),
  staffId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

async function requestStripe(endpoint: string, params: Record<string, string>) {
  const apiKey = requireEnv('STRIPE_SECRET_KEY');
  const body = new URLSearchParams(params);
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Stripe error: ${await response.text()}`);
  }
  return await response.json();
}

async function createStripePaymentIntent(payload: z.infer<typeof PaymentIntentSchema>) {
  const metadata = {
    order_id: payload.orderId,
    tenant_id: payload.tenantId,
    ...(payload.appointmentId ? { appointment_id: payload.appointmentId } : {}),
    ...(payload.metadata ?? {}),
  } as Record<string, string>;
  const intent = await requestStripe('payment_intents', {
    amount: String(payload.amountCents),
    currency: payload.currency.toLowerCase(),
    'automatic_payment_methods[enabled]': 'true',
    'payment_method_options[card][request_three_d_secure]': 'any',
    receipt_email: payload.customerEmail,
    description: `Order ${payload.orderId}`,
    metadata: JSON.stringify(metadata),
  });
  return intent as {
    id: string;
    status: string;
    client_secret?: string;
    next_action?: { type: string; redirect_to_url?: { url: string } };
  };
}

async function createStripeCheckout(payload: z.infer<typeof PaymentIntentSchema>) {
  const metadata = {
    order_id: payload.orderId,
    tenant_id: payload.tenantId,
    ...(payload.appointmentId ? { appointment_id: payload.appointmentId } : {}),
    ...(payload.metadata ?? {}),
  } as Record<string, string>;
  const session = await requestStripe('checkout/sessions', {
    mode: 'payment',
    success_url: requireEnv('CHECKOUT_SUCCESS_URL'),
    cancel_url: requireEnv('CHECKOUT_CANCEL_URL'),
    customer_email: payload.customerEmail,
    locale: payload.locale ?? 'en',
    'automatic_tax[enabled]': 'true',
    'phone_number_collection[enabled]': 'true',
    'payment_intent_data[metadata]': JSON.stringify(metadata),
    'line_items[0][price_data][currency]': payload.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(payload.amountCents),
    'line_items[0][price_data][product_data][name]': payload.metadata?.item_name ?? 'Plan5 order',
    'line_items[0][quantity]': '1',
    allow_promotion_codes: 'true',
  });
  return session as { id: string; url: string; payment_intent?: string };
}

async function createSumUpCheckout(payload: z.infer<typeof PaymentIntentSchema>) {
  const clientId = requireEnv('SUMUP_CLIENT_ID');
  const accessToken = requireEnv('SUMUP_ACCESS_TOKEN');
  const checkoutRef = crypto.randomUUID();
  const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      amount: payload.amountCents / 100,
      currency: payload.currency.toUpperCase(),
      checkout_reference: checkoutRef,
      merchant_code: clientId,
      pay_to_email: payload.customerEmail,
      description: `Order ${payload.orderId}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`SumUp error: ${await response.text()}`);
  }
  const checkout = await response.json() as { id: string; checkout_reference: string; checkout_url?: string };
  return checkout;
}

async function persistTransaction(
  client: ReturnType<typeof getSupabaseClient>,
  tenantId: string,
  orderId: string,
  provider: 'stripe' | 'sumup',
  providerId: string,
  amount: number,
  currency: string,
  status: string,
  metadata: Record<string, unknown>,
  appointmentId?: string,
) {
  const { data: existing, error: selectError } = await client
    .from('payment_transactions')
    .select('id, status')
    .eq('provider', provider)
    .eq('provider_payment_id', providerId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error: updateError } = await client
      .from('payment_transactions')
      .update({ status, amount_cents: amount, currency, metadata })
      .eq('id', existing.id);
    if (updateError) throw updateError;
    return existing.id as string;
  }

  const { data, error } = await client
    .from('payment_transactions')
    .insert({
      tenant_id: tenantId,
      order_id: orderId,
      appointment_id: appointmentId,
      provider,
      provider_payment_id: providerId,
      amount_cents: amount,
      currency,
      status,
      metadata,
    })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data?.id as string;
}

async function updateOrderStatus(
  client: ReturnType<typeof getSupabaseClient>,
  orderId: string,
  status: string,
  tenantId: string,
) {
  const { error } = await client
    .from('orders')
    .update({ status })
    .eq('id', orderId);
  if (error) throw error;
  await recordAudit(client, { tenantId, action: 'order.status_updated', resource: orderId, changes: { status } });
}

async function handlePaymentIntent(req: Request) {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = PaymentIntentSchema.parse(await req.json());
    const client = getSupabaseClient(req);
    const idKey = req.headers.get('Idempotency-Key') ?? `payment:${payload.orderId}`;

    const result = await withIdempotency(client, idKey, 1800, async () => {
      let intentId: string;
      let provider: 'stripe' | 'sumup' = payload.provider;
      let clientSecret: string | undefined;
      let checkoutUrl: string | undefined;
      let status = 'requires_action';
      let nextAction: { type: 'redirect' | 'use_stripe_sdk' | 'sumup_app_switch'; url?: string } | undefined;

      if (payload.provider === 'stripe') {
        if (payload.mode === 'checkout_session') {
          const session = await createStripeCheckout(payload);
          intentId = session.payment_intent ?? session.id;
          checkoutUrl = session.url;
          status = 'requires_action';
          nextAction = session.url
            ? { type: 'redirect', url: session.url }
            : undefined;
        } else {
          const intent = await createStripePaymentIntent(payload);
          intentId = intent.id;
          clientSecret = intent.client_secret;
          status = intent.status;
          if (intent.next_action?.type === 'redirect_to_url') {
            nextAction = { type: 'redirect', url: intent.next_action.redirect_to_url?.url };
          } else if (intent.next_action?.type === 'use_stripe_sdk') {
            nextAction = { type: 'use_stripe_sdk' };
          }
        }
      } else {
        const checkout = await createSumUpCheckout(payload);
        intentId = checkout.id ?? checkout.checkout_reference;
        checkoutUrl = checkout.checkout_url;
        status = 'pending';
        nextAction = checkout.checkout_url
          ? { type: 'sumup_app_switch', url: checkout.checkout_url }
          : undefined;

        await client.from('sumup_sessions').upsert({
          checkout_id: intentId,
          tenant_id: payload.tenantId,
          order_id: payload.orderId,
          deeplink: checkout.checkout_url,
          status: 'pending',
          amount_cents: payload.amountCents,
          currency: payload.currency.toUpperCase(),
          metadata: payload.metadata ?? {},
        });
      }

      const transactionId = await persistTransaction(
        client,
        payload.tenantId,
        payload.orderId,
        provider,
        intentId,
        payload.amountCents,
        payload.currency,
        status,
        payload.metadata ?? {},
        payload.appointmentId,
      );

      await client.from('orders').update({ payment_intent_id: intentId }).eq('id', payload.orderId);
      await recordAudit(client, {
        tenantId: payload.tenantId,
        actorId: payload.customerEmail,
        actorRole: 'customer',
        action: 'payment.intent.created',
        resource: payload.orderId,
        changes: { provider, transactionId, status },
      });

      return {
        provider,
        clientSecret,
        checkoutUrl,
        intentId,
        status,
        amountCents: payload.amountCents,
        currency: payload.currency,
        nextAction,
      };
    }, { tenantId: payload.tenantId });

    logInfo('payment.intent.response', { requestId, orderId: result.intentId, traceparent });
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
  } catch (error) {
    await captureException(error, { route: 'payment_intent', traceparent });
    logError('payment_intent_failed', { requestId, error, traceparent });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
}

async function handleRefund(req: Request) {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = RefundSchema.parse(await req.json());
    const client = getSupabaseClient(req);

    const { data: transaction, error: txError } = await client
      .from('payment_transactions')
      .select('id, provider, provider_payment_id, amount_cents, currency, tenant_id, order_id')
      .eq('id', payload.transactionId)
      .maybeSingle();
    if (txError) throw txError;
    if (!transaction) throw new Error('Transaction not found');

    let providerRefundId: string;
    let refundStatus: 'pending' | 'succeeded' | 'failed' = 'pending';

    if (transaction.provider === 'stripe') {
      const refund = await requestStripe('refunds', {
        payment_intent: transaction.provider_payment_id,
        ...(payload.amountCents ? { amount: String(payload.amountCents) } : {}),
        reason: payload.reason ?? 'requested_by_customer',
      });
      providerRefundId = refund.id;
      refundStatus = refund.status ?? 'pending';
    } else {
      const accessToken = requireEnv('SUMUP_ACCESS_TOKEN');
      const response = await fetch(`https://api.sumup.com/v0.1/me/transactions/${transaction.provider_payment_id}/refunds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          amount: (payload.amountCents ?? transaction.amount_cents) / 100,
          currency: transaction.currency,
          description: payload.reason ?? 'Manual refund',
        }),
      });
      if (!response.ok) {
        throw new Error(`SumUp refund error: ${await response.text()}`);
      }
      const refund = await response.json() as { id: string; status?: string };
      providerRefundId = refund.id;
      refundStatus = (refund.status as typeof refundStatus) ?? 'pending';
    }

    const { data, error } = await client
      .from('payment_refunds')
      .insert({
        transaction_id: transaction.id,
        provider_refund_id: providerRefundId,
        amount_cents: payload.amountCents ?? transaction.amount_cents,
        status: refundStatus,
        reason: payload.reason,
        initiated_by: payload.initiatedBy,
        metadata: { orderId: payload.orderId },
      })
      .select('id, status, amount_cents')
      .maybeSingle();
    if (error) throw error;

    await client.from('payment_transactions').update({ status: 'refunded' }).eq('id', transaction.id);
    await updateOrderStatus(client, payload.orderId, 'refunded', payload.tenantId);
    await recordAudit(client, {
      tenantId: payload.tenantId,
      actorRole: payload.initiatedBy,
      action: 'payment.refund.created',
      resource: payload.orderId,
      changes: { refundId: data?.id, transactionId: transaction.id, status: data?.status },
    });

    logInfo('payment.refund.success', { requestId, refundId: data?.id, traceparent });
    return new Response(
      JSON.stringify({
        refundId: data?.id,
        status: data?.status,
        amountCents: data?.amount_cents,
        currency: transaction.currency,
        provider: transaction.provider,
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  } catch (error) {
    await captureException(error, { route: 'refund', traceparent });
    logError('payment_refund_failed', { requestId, error, traceparent });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
}

async function handleStripeWebhook(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const signingSecret = requireEnv('STRIPE_WEBHOOK_SECRET');
  const valid = await verifyStripeSignature(body, signature, signingSecret);
  if (!valid) {
    return new Response('Invalid signature', { status: 400 });
  }
  const event = JSON.parse(body) as {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
  const client = getSupabaseClient(req);

  const { data: existing } = await client
    .from('payment_webhook_events')
    .select('id, processed_at')
    .eq('provider', 'stripe')
    .eq('event_id', event.id)
    .maybeSingle();
  if (existing?.processed_at) {
    return new Response('ok', { status: 200 });
  }

  await client.from('payment_webhook_events').upsert({
    provider: 'stripe',
    event_id: event.id,
    event_type: event.type,
    payload: event,
    processed_at: new Date().toISOString(),
  });

  const object = event.data.object;
  let providerId: string | undefined;
  let amount: number | undefined;
  let currency: string | undefined;
  let status: string | undefined;
  let orderId: string | undefined;
  let tenantId: string | undefined;
  let appointmentId: string | undefined;

  if ('id' in object && typeof object.id === 'string') {
    providerId = object.id;
  }
  if ('amount_received' in object && typeof object.amount_received === 'number') {
    amount = object.amount_received;
  } else if ('amount' in object && typeof object.amount === 'number') {
    amount = object.amount;
  }
  if ('currency' in object && typeof object.currency === 'string') {
    currency = (object.currency as string).toUpperCase();
  }
  if ('status' in object && typeof object.status === 'string') {
    status = object.status as string;
  }
  if ('metadata' in object && object.metadata && typeof object.metadata === 'object') {
    const metadata = object.metadata as Record<string, string>;
    orderId = metadata.order_id ?? metadata.orderId;
    tenantId = metadata.tenant_id ?? metadata.tenantId;
    appointmentId = metadata.appointment_id ?? metadata.appointmentId;
  }
  if (!orderId) {
    if ('payment_intent' in object && typeof object.payment_intent === 'string') {
      const { data: payment } = await client
        .from('payment_transactions')
        .select('order_id, tenant_id, appointment_id')
        .eq('provider_payment_id', object.payment_intent)
        .maybeSingle();
      orderId = payment?.order_id;
      tenantId = payment?.tenant_id;
      appointmentId = payment?.appointment_id ?? undefined;
    }
  }

  if (providerId && orderId && tenantId && amount && currency && status) {
    await persistTransaction(
      client,
      tenantId,
      orderId,
      'stripe',
      providerId,
      amount,
      currency,
      status,
      object,
      appointmentId,
    );

    if (status === 'succeeded' || event.type === 'checkout.session.completed') {
      await updateOrderStatus(client, orderId, 'paid', tenantId);
      if (appointmentId) {
        await client.from('appointments').update({ status: 'confirmed' }).eq('id', appointmentId);
      }
    } else if (status === 'requires_payment_method' || status === 'canceled') {
      await updateOrderStatus(client, orderId, 'pending', tenantId);
    }
  }

  logInfo('payment.webhook.stripe', { eventId: event.id, orderId, status });
  return new Response('ok', { status: 200 });
}

async function handleSumUpWebhook(req: Request) {
  const payload = await req.json() as {
    id: string;
    event_type: string;
    transaction_code?: string;
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  };
  const client = getSupabaseClient(req);
  const eventId = payload.id ?? crypto.randomUUID();

  const { data: existing } = await client
    .from('payment_webhook_events')
    .select('id, processed_at')
    .eq('provider', 'sumup')
    .eq('event_id', eventId)
    .maybeSingle();
  if (existing?.processed_at) {
    return new Response('ok', { status: 200 });
  }

  await client.from('payment_webhook_events').upsert({
    provider: 'sumup',
    event_id: eventId,
    event_type: payload.event_type,
    payload,
    processed_at: new Date().toISOString(),
  });

  const { data: session } = await client
    .from('sumup_sessions')
    .select('order_id, tenant_id, amount_cents, currency, checkout_id')
    .eq('checkout_id', payload.transaction_code ?? payload.id)
    .maybeSingle();

  if (session) {
    const status = payload.status?.toLowerCase() ?? 'pending';
    await client
      .from('sumup_sessions')
      .update({ status, last_polled_at: new Date().toISOString() })
      .eq('checkout_id', session.checkout_id);

    if (status === 'successful') {
      const transactionId = await persistTransaction(
        client,
        session.tenant_id,
        session.order_id,
        'sumup',
        payload.transaction_code ?? eventId,
        session.amount_cents,
        session.currency,
        'succeeded',
        payload,
      );
      await updateOrderStatus(client, session.order_id, 'paid', session.tenant_id);
      await recordAudit(client, {
        tenantId: session.tenant_id,
        action: 'payment.sumup.completed',
        resource: session.order_id,
        changes: { transactionId },
      });
    } else if (status === 'failed' || status === 'cancelled') {
      await recordAudit(client, {
        tenantId: session.tenant_id,
        action: 'payment.sumup.failed',
        resource: session.order_id,
        changes: { status },
      });
    }
  }

  logInfo('payment.webhook.sumup', { eventId, status: payload.status });
  return new Response('ok', { status: 200 });
}

async function handleSumUpStatus(req: Request, checkoutId: string) {
  const client = getSupabaseClient(req);
  const accessToken = requireEnv('SUMUP_ACCESS_TOKEN');
  const response = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return new Response(JSON.stringify({ error: 'Unable to fetch status' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const checkout = await response.json() as { id: string; status: string; amount: number; currency: string; checkout_url?: string };
  await client
    .from('sumup_sessions')
    .update({ status: checkout.status.toLowerCase(), last_polled_at: new Date().toISOString(), deeplink: checkout.checkout_url })
    .eq('checkout_id', checkoutId);

  return new Response(JSON.stringify({
    checkoutId,
    status: checkout.status.toLowerCase(),
    amountCents: Math.round(checkout.amount * 100),
    currency: checkout.currency,
    lastPolledAt: new Date().toISOString(),
    deeplink: checkout.checkout_url,
  }), { headers: { 'content-type': 'application/json' } });
}

async function handleManualSumUp(req: Request) {
  try {
    const payload = ManualSumUpSchema.parse(await req.json());
    const client = getSupabaseClient(req);
    await client
      .from('sumup_sessions')
      .update({ status: 'successful', metadata: { manual: true, notes: payload.notes } })
      .eq('checkout_id', payload.checkoutId);

    await persistTransaction(
      client,
      payload.tenantId,
      payload.orderId,
      'sumup',
      payload.checkoutId,
      0,
      'CHF',
      'succeeded',
      { manual: true },
    );
    await updateOrderStatus(client, payload.orderId, 'paid', payload.tenantId);
    await recordAudit(client, {
      tenantId: payload.tenantId,
      actorId: payload.staffId,
      actorRole: 'staff',
      action: 'payment.sumup.manual_recorded',
      resource: payload.orderId,
      changes: { checkoutId: payload.checkoutId, notes: payload.notes },
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (error) {
    await captureException(error, { route: 'sumup_manual' });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const fnIndex = segments.findIndex((segment) => segment === 'payments');
  const action = fnIndex >= 0 ? segments.slice(fnIndex + 1) : [];
  const method = req.method.toUpperCase();

  if (method === 'POST' && action.length === 0) {
    return await handlePaymentIntent(req);
  }
  if (method === 'POST' && action[0] === 'refunds') {
    return await handleRefund(req);
  }
  if (method === 'POST' && action[0] === 'webhooks' && action[1] === 'stripe') {
    return await handleStripeWebhook(req);
  }
  if (method === 'POST' && action[0] === 'webhooks' && action[1] === 'sumup') {
    return await handleSumUpWebhook(req);
  }
  if (action[0] === 'sumup' && action[1] === 'status' && action[2]) {
    return await handleSumUpStatus(req, action[2]);
  }
  if (method === 'POST' && action[0] === 'sumup' && action[1] === 'manual') {
    return await handleManualSumUp(req);
  }

  return new Response('Not found', { status: 404 });
});
