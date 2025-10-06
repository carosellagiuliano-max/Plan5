import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  captureException,
  getSupabaseClient,
  logError,
  logInfo,
  recordAudit,
  requireEnv,
} from '../_shared/mod.ts';

const ProcessSchema = z.object({
  token: z.string(),
  limit: z.number().int().positive().max(100).default(25),
});

type Reminder = {
  id: string;
  tenant_id: string;
  resource_type: string;
  resource_id: string;
  channel: string;
  template: string;
  payload: Record<string, unknown>;
  deliver_at: string;
  locale?: string;
};

async function dispatchEmail(reminder: Reminder) {
  const emailEndpoint = requireEnv('EMAIL_FUNCTION_URL');
  await fetch(emailEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId: reminder.tenant_id,
      to: reminder.payload['email'] ?? reminder.payload['customerEmail'],
      template: reminder.template,
      locale: reminder.payload['locale'] ?? 'en-CH',
      data: reminder.payload,
    }),
  });
}

async function dispatchWebhook(reminder: Reminder) {
  const url = reminder.payload['webhookUrl'];
  if (!url || typeof url !== 'string') {
    throw new Error('Missing webhookUrl for webhook reminder');
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(reminder.payload),
  });
}

async function processReminder(client: ReturnType<typeof getSupabaseClient>, reminder: Reminder) {
  try {
    if (reminder.channel === 'email') {
      await dispatchEmail(reminder);
    } else if (reminder.channel === 'webhook') {
      await dispatchWebhook(reminder);
    }
    const { error: updateError } = await client
      .from('reminders')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', reminder.id);
    if (updateError) throw updateError;
    await recordAudit(client, {
      tenantId: reminder.tenant_id,
      action: 'reminder.sent',
      resource: reminder.resource_id,
      changes: { reminderId: reminder.id, channel: reminder.channel },
    });
  } catch (error) {
    await captureException(error, { reminderId: reminder.id });
    const { error: updateError } = await client
      .from('reminders')
      .update({ status: 'failed', last_error: error instanceof Error ? error.message : String(error) })
      .eq('id', reminder.id);
    if (updateError) {
      logError('reminder.update_failed', { reminderId: reminder.id, updateError });
    }
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const payload = ProcessSchema.parse(body);
    const secret = requireEnv('REMINDER_CRON_SECRET');
    if (payload.token !== secret) {
      return new Response('Unauthorized', { status: 401 });
    }

    const client = getSupabaseClient(req);
    const { data: reminders, error } = await client
      .from('reminders')
      .select('id, tenant_id, resource_type, resource_id, channel, template, payload, deliver_at')
      .eq('status', 'scheduled')
      .lte('deliver_at', new Date().toISOString())
      .order('deliver_at', { ascending: true })
      .limit(payload.limit);
    if (error) throw error;

    logInfo('reminders.dispatch.start', { requestId, count: reminders?.length ?? 0 });

    for (const reminder of reminders ?? []) {
      const { error: claimError } = await client
        .from('reminders')
        .update({ status: 'processing' })
        .eq('id', reminder.id)
        .eq('status', 'scheduled');
      if (claimError) {
        logError('reminder.claim_failed', { reminderId: reminder.id, error: claimError });
        continue;
      }
      await processReminder(client, reminder as Reminder);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (error) {
    await captureException(error, { requestId });
    logError('reminders.dispatch.failed', { requestId, error });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
