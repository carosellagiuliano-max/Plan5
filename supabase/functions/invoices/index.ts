import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  getSupabaseClient,
  withIdempotency,
  logInfo,
  logError,
  captureException,
} from '../_shared/mod.ts';

const InvoiceRequestSchema = z.object({
  orderId: z.string().uuid(),
  tenantId: z.string().uuid(),
  sendEmail: z.boolean().default(false),
});

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = InvoiceRequestSchema.parse(await req.json());
    const client = getSupabaseClient(req);

    const result = await withIdempotency(client, `invoice:${payload.orderId}`, 86400, async () => {
      const { data: order, error: orderError } = await client
        .from('orders')
        .select('id, total_cents, currency, customer_id, metadata')
        .eq('id', payload.orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) throw new Error('Order not found');

      const { data: items, error: itemError } = await client
        .from('order_items')
        .select('description, quantity, unit_price_cents')
        .eq('order_id', payload.orderId);
      if (itemError) throw itemError;

      const invoice = {
        id: crypto.randomUUID(),
        orderId: payload.orderId,
        issuedAt: new Date().toISOString(),
        total: order.total_cents,
        currency: order.currency,
        lineItems: items,
      };

      logInfo('invoice.generated', { requestId, orderId: payload.orderId, traceparent });

      if (payload.sendEmail) {
        await fetch('https://api.example-email.local/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ template: 'invoice', payload: invoice }),
        }).catch((error) => logError('invoice.email.failed', { requestId, error, traceparent }));
      }

      return invoice;
    }, { tenantId: payload.tenantId });

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
