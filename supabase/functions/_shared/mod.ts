import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const ClaimsSchema = z.object({
  sub: z.string().uuid(),
  role: z.enum(['customer', 'staff', 'admin']).default('customer'),
  tenant_id: z.string().uuid().optional(),
});

export type Claims = z.infer<typeof ClaimsSchema>;

export function getSupabaseClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
  });
}

export async function withIdempotency<T>(
  client: SupabaseClient,
  key: string,
  ttlSeconds: number,
  handler: () => Promise<T>,
  options: { tenantId?: string } = {},
): Promise<T> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const requestHash = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const { data: existing } = await client
    .from('idempotency_keys')
    .select('response')
    .eq('key', key)
    .maybeSingle();

  if (existing?.response) {
    return existing.response as T;
  }

  const result = await handler();

  const { error } = await client.from('idempotency_keys').upsert({
    key,
    tenant_id: options.tenantId,
    request_hash: requestHash,
    response: result,
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  });
  if (error) {
    console.error(JSON.stringify({ level: 'error', message: 'Failed to persist idempotency key', error }));
  }

  return result;
}

function buildLog(message: string, level: 'info' | 'error', meta: Record<string, unknown>): Record<string, unknown> {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

export function logInfo(message: string, meta: Record<string, unknown> = {}): void {
  console.log(JSON.stringify(buildLog(message, 'info', meta)));
}

export function logError(message: string, meta: Record<string, unknown> = {}): void {
  console.error(JSON.stringify(buildLog(message, 'error', meta)));
}

export async function captureException(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const sentryDsn = Deno.env.get('SENTRY_DSN');
  if (!sentryDsn) {
    return;
  }
  try {
    const payload = {
      level: 'error',
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      context,
    };
    await fetch('https://o4500000000000000.ingest.sentry.io/api/0/store/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sentry-dsn': sentryDsn },
      body: JSON.stringify(payload),
    });
  } catch (reportError) {
    console.error(JSON.stringify({ level: 'error', message: 'Sentry reporting failed', reportError }));
  }
}

export function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export async function recordAudit(
  client: SupabaseClient,
  entry: {
    tenantId?: string;
    actorId?: string;
    actorRole?: string;
    action: string;
    resource?: string;
    changes?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await client.from('audit_log').insert({
    tenant_id: entry.tenantId,
    actor_id: entry.actorId,
    actor_role: entry.actorRole ?? 'system',
    action: entry.action,
    resource: entry.resource,
    changes: entry.changes ?? {},
  });
  if (error) {
    console.error(JSON.stringify({ level: 'error', message: 'audit_log_insert_failed', error }));
  }
}

export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  signingSecret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, item) => {
    const [k, v] = item.split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;
  const encoder = new TextEncoder();
  const signedPayload = `${timestamp}.${payload}`;
  const keyData = encoder.encode(signingSecret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const expected = signature.toLowerCase();
  if (hex.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < hex.length; i += 1) {
    mismatch |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function buildICS({
  uid,
  start,
  end,
  summary,
  description,
  location,
}: {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description?: string;
  location?: string;
}): string {
  const toIcsDate = (value: string) => value.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plan5//Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${summary}`,
  ];
  if (description) {
    lines.push(`DESCRIPTION:${description.replace(/\n/g, '\\n')}`);
  }
  if (location) {
    lines.push(`LOCATION:${location}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
