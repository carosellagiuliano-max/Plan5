import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  getSupabaseClient,
  withIdempotency,
  logInfo,
  logError,
  captureException,
} from '../_shared/mod.ts';

const ShopRequestSchema = z.object({
  tenantId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  customerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
});

type ShopRequest = z.infer<typeof ShopRequestSchema>;

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = ShopRequestSchema.parse(await req.json()) as ShopRequest;
    const client = getSupabaseClient(req);
    const idKey = req.headers.get('Idempotency-Key') ?? `shop:${payload.customerId}:${payload.productId}`;

    const response = await withIdempotency(client, idKey, 600, async () => {
      const { data: reserved, error: reserveError } = await client.rpc('reserve_product_stock', {
        p_product_id: payload.productId,
        p_quantity: payload.quantity,
        p_customer_id: payload.customerId,
      });
      if (reserveError) throw reserveError;

      let orderId = payload.orderId;
      if (!orderId) {
        const { data: order, error: orderError } = await client
          .from('orders')
          .insert({
            tenant_id: payload.tenantId,
            customer_id: payload.customerId,
            status: 'draft',
          })
          .select('id')
          .maybeSingle();
        if (orderError) throw orderError;
        orderId = order?.id as string;
      }

      const { error: itemError } = await client.from('order_items').insert({
        order_id: orderId,
        product_id: payload.productId,
        quantity: payload.quantity,
        unit_price_cents: 0,
        description: 'Reserved item',
      });
      if (itemError) throw itemError;

      logInfo('shop.stock_reserved', { requestId, orderId, productId: payload.productId, traceparent });
      return { orderId, stock: reserved };
    }, { tenantId: payload.tenantId });

    return new Response(JSON.stringify(response), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    await captureException(error, { requestId, traceparent });
    logError('shop_request_failed', { requestId, error, traceparent });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
