import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { getSupabaseClient, logInfo, logError, captureException } from '../_shared/mod.ts';

const CalendarRequestSchema = z.object({
  tenantId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  rangeStart: z.string().datetime().optional(),
  rangeEnd: z.string().datetime().optional(),
});

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = CalendarRequestSchema.parse(await req.json());
    const client = getSupabaseClient(req);

    const start = payload.rangeStart ?? new Date().toISOString();
    const end = payload.rangeEnd ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const appointmentsQuery = client
      .from('appointments')
      .select('id, staff_id, start_at, end_at, status, service:services(name)')
      .gte('start_at', start)
      .lte('start_at', end)
      .eq('tenant_id', payload.tenantId);
    if (payload.staffId) {
      appointmentsQuery.eq('staff_id', payload.staffId);
    }
    const { data: appointments, error: appointmentError } = await appointmentsQuery;
    if (appointmentError) throw appointmentError;

    const availabilityQuery = client
      .from('staff_availability')
      .select('weekday, start_time, end_time, staff_id')
      .eq('tenant_id', payload.tenantId);
    if (payload.staffId) {
      availabilityQuery.eq('staff_id', payload.staffId);
    }
    const { data: availability, error: availabilityError } = await availabilityQuery;
    if (availabilityError) throw availabilityError;

    logInfo('calendar.generated', { requestId, count: appointments?.length ?? 0, traceparent });
    return new Response(JSON.stringify({ appointments, availability }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    await captureException(error, { requestId, traceparent });
    logError('calendar_failed', { requestId, error, traceparent });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
