import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { getSupabaseClient, logInfo, logError, captureException } from '../_shared/mod.ts';

const EmailRequestSchema = z.object({
  to: z.string().email(),
  template: z.enum(['booking_confirmation', 'payment_receipt', 'inventory_alert', 'custom']),
  data: z.record(z.any()).default({}),
});

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = EmailRequestSchema.parse(await req.json());
    getSupabaseClient(req); // ensure env configured

    const response = await fetch('https://api.example-email.local/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: payload.to,
        template: payload.template,
        data: payload.data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Email provider error: ${await response.text()}`);
    }

    logInfo('email.sent', { requestId, template: payload.template, traceparent });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    await captureException(error, { requestId, traceparent });
    logError('email_failed', { requestId, error, traceparent });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
