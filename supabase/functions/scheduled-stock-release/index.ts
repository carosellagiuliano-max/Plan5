import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { getSupabaseClient, logInfo, logError, captureException } from '../_shared/mod.ts';

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const client = getSupabaseClient(req);
    const now = new Date().toISOString();
    const { data: expired, error } = await client
      .from('product_stock')
      .select('id, reserved')
      .lte('expires_at', now)
      .eq('released', false);
    if (error) throw error;

    let released = 0;
    for (const stock of expired ?? []) {
      if ((stock as { reserved: number }).reserved > 0) {
        const { error: releaseError } = await client.rpc('release_product_stock', {
          p_stock_id: (stock as { id: string }).id,
          p_quantity: (stock as { reserved: number }).reserved,
          p_reason: 'scheduled_expiry',
        });
        if (releaseError) {
          logError('stock.release_failed', { requestId, stockId: (stock as { id: string }).id, releaseError });
        } else {
          released += 1;
        }
      }
    }

    logInfo('stock.release_completed', { requestId, released, traceparent });
    return new Response(JSON.stringify({ released }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    await captureException(error, { requestId, traceparent });
    logError('scheduled_release_failed', { requestId, error, traceparent });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
