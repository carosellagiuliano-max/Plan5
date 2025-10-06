import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  getSupabaseClient,
  withIdempotency,
  logInfo,
  logError,
  captureException,
} from '../_shared/mod.ts';

const BookingRequestSchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  customerId: z.string().uuid(),
  startAt: z.string().datetime(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

type BookingRequest = z.infer<typeof BookingRequestSchema>;

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const body = await req.json();
    const payload = BookingRequestSchema.parse(body) as BookingRequest;
    const client = getSupabaseClient(req);
    const idempotencyKey = req.headers.get('Idempotency-Key') ?? `${payload.customerId}:${payload.startAt}`;

    const result = await withIdempotency(client, `booking:${idempotencyKey}`, 3600, async () => {
      const { data: service, error: serviceError } = await client
        .from('services')
        .select('duration_minutes, buffer_minutes, price_cents')
        .eq('id', payload.serviceId)
        .maybeSingle();
      if (serviceError) throw serviceError;
      if (!service) throw new Error('Service not found');

      const start = new Date(payload.startAt);
      const end = new Date(start.getTime() + service.duration_minutes * 60 * 1000);

      const weekday = start.getUTCDay();
      const { data: availability, error: availabilityError } = await client
        .from('staff_availability')
        .select('start_time, end_time')
        .eq('staff_id', payload.staffId)
        .eq('tenant_id', payload.tenantId)
        .eq('weekday', weekday);
      if (availabilityError) throw availabilityError;
      const isWithinAvailability = (availability ?? []).some((slot) => {
        const [startHour, startMinute] = (slot.start_time as string).split(':').map(Number);
        const [endHour, endMinute] = (slot.end_time as string).split(':').map(Number);
        const slotStart = new Date(start);
        slotStart.setUTCHours(startHour, startMinute, 0, 0);
        const slotEnd = new Date(start);
        slotEnd.setUTCHours(endHour, endMinute, 0, 0);
        return start >= slotStart && end <= slotEnd;
      });

      if (!isWithinAvailability) {
        throw new Response(JSON.stringify({ error: 'Outside staff availability' }), { status: 422 });
      }

      const { error: insertError, data } = await client
        .from('appointments')
        .insert({
          tenant_id: payload.tenantId,
          service_id: payload.serviceId,
          customer_id: payload.customerId,
          staff_id: payload.staffId,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          status: 'confirmed',
          total_price_cents: service.price_cents,
          notes: payload.notes,
          source: payload.source ?? 'edge:bookings',
        })
        .select()
        .maybeSingle();

      if (insertError) {
        if (insertError.message?.includes('appointments_no_overlap')) {
          throw new Response(JSON.stringify({ error: 'Slot unavailable' }), { status: 409 });
        }
        throw insertError;
      }

      logInfo('appointment.booked', { requestId, appointmentId: data?.id, traceparent });
      return { appointment: data };
    }, { tenantId: payload.tenantId });

    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    await captureException(error, { requestId, traceparent });
    logError('booking_failed', { requestId, error, traceparent });
    if (error instanceof Response) {
      return error;
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
