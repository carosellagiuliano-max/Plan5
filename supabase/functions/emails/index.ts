import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  buildICS,
  captureException,
  getSupabaseClient,
  logError,
  logInfo,
  recordAudit,
  requireEnv,
} from '../_shared/mod.ts';

const EmailRequestSchema = z.object({
  tenantId: z.string().uuid().optional(),
  to: z.string().email(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  template: z.enum([
    'booking_confirmation',
    'payment_receipt',
    'invoice_ready',
    'reminder_upcoming',
    'gdpr_export_ready',
    'gdpr_deletion_confirmed',
    'custom',
  ]),
  locale: z.string().default('en-CH'),
  subject: z.string().optional(),
  data: z.record(z.any()).default({}),
  attachments: z
    .array(z.object({ filename: z.string(), content: z.string(), type: z.string().default('application/octet-stream') }))
    .optional(),
  ics: z
    .array(
      z.object({
        uid: z.string(),
        start: z.string(),
        end: z.string(),
        summary: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
      }),
    )
    .optional(),
  providerHint: z.enum(['resend', 'postmark']).optional(),
});

const BounceWebhookSchema = z.object({
  provider: z.enum(['resend', 'postmark']),
  email: z.string().email(),
  reason: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
  tenantId: z.string().uuid().optional(),
});

type EmailRequest = z.infer<typeof EmailRequestSchema>;

type Provider = 'resend' | 'postmark';

function selectProvider(hint?: Provider): Provider {
  if (hint) return hint;
  if (Deno.env.get('RESEND_API_KEY')) return 'resend';
  if (Deno.env.get('POSTMARK_TOKEN')) return 'postmark';
  throw new Error('No email provider configured. Configure RESEND_API_KEY or POSTMARK_TOKEN.');
}

function providerGuidance(provider: Provider): string {
  if (provider === 'resend') {
    return 'Ensure SPF (include:amazonses.com) and DKIM records from Resend dashboard. Add DMARC policy v=DMARC1; p=quarantine; pct=100.';
  }
  return 'Add SPF include:spf.mtasv.net and Postmark DKIM TXT. Configure DMARC v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.';
}

function renderTemplate(template: EmailRequest['template'], locale: string, data: Record<string, unknown>): {
  subject: string;
  html: string;
  text: string;
} {
  const translations: Record<string, Record<string, string>> = {
    booking_confirmation: {
      'en-CH': 'Your booking is confirmed',
      'de-CH': 'Ihre Buchung ist bestätigt',
      'fr-CH': 'Votre réservation est confirmée',
    },
    payment_receipt: {
      'en-CH': 'Payment receipt',
      'de-CH': 'Zahlungsbeleg',
      'fr-CH': 'Reçu de paiement',
    },
    invoice_ready: {
      'en-CH': 'Your invoice is ready',
      'de-CH': 'Ihre Rechnung ist bereit',
      'fr-CH': 'Votre facture est prête',
    },
    reminder_upcoming: {
      'en-CH': 'Upcoming appointment reminder',
      'de-CH': 'Erinnerung: Termin steht bevor',
      'fr-CH': 'Rappel : rendez-vous à venir',
    },
    gdpr_export_ready: {
      'en-CH': 'Your data export is ready',
      'de-CH': 'Ihr Datenauszug ist bereit',
      'fr-CH': 'Votre export de données est prêt',
    },
    gdpr_deletion_confirmed: {
      'en-CH': 'Your data deletion is completed',
      'de-CH': 'Ihre Datenlöschung wurde abgeschlossen',
      'fr-CH': 'La suppression de vos données est terminée',
    },
    custom: {
      'en-CH': (data.subject as string) ?? 'Notification',
      'de-CH': (data.subject as string) ?? 'Benachrichtigung',
      'fr-CH': (data.subject as string) ?? 'Notification',
    },
  };

  const subject = translations[template]?.[locale] ?? translations[template]?.['en-CH'] ?? 'Notification';
  const body = `<p>${subject}</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
  return { subject, html: body, text: `${subject}\n${JSON.stringify(data, null, 2)}` };
}

async function sendViaResend(payload: EmailRequest, compiled: ReturnType<typeof renderTemplate>) {
  const apiKey = requireEnv('RESEND_API_KEY');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: requireEnv('EMAIL_FROM_ADDRESS'),
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject ?? compiled.subject,
      html: compiled.html,
      text: compiled.text,
      attachments: payload.attachments,
      ics: payload.ics?.map((event) => ({
        filename: `${event.uid}.ics`,
        content: btoa(buildICS(event)),
        type: 'text/calendar',
      })),
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend error: ${await response.text()}`);
  }
  return await response.json();
}

async function sendViaPostmark(payload: EmailRequest, compiled: ReturnType<typeof renderTemplate>) {
  const token = requireEnv('POSTMARK_TOKEN');
  const response = await fetch('https://api.postmarkapp.com/email/withTemplate', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': token,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      From: requireEnv('EMAIL_FROM_ADDRESS'),
      To: payload.to,
      Cc: payload.cc?.join(','),
      Bcc: payload.bcc?.join(','),
      TemplateAlias: payload.template === 'custom' ? undefined : payload.template,
      TemplateModel: payload.data,
      Subject: payload.subject ?? compiled.subject,
      HtmlBody: compiled.html,
      TextBody: compiled.text,
      Attachments: [
        ...(payload.attachments ?? []).map((attachment) => ({
          Name: attachment.filename,
          Content: attachment.content,
          ContentType: attachment.type,
        })),
        ...(payload.ics ?? []).map((event) => ({
          Name: `${event.uid}.ics`,
          Content: btoa(buildICS(event)),
          ContentType: 'text/calendar',
        })),
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Postmark error: ${await response.text()}`);
  }
  return await response.json();
}

async function handleSendEmail(req: Request) {
  const requestId = crypto.randomUUID();
  const traceparent = req.headers.get('traceparent') ?? undefined;
  try {
    const payload = EmailRequestSchema.parse(await req.json());
    const provider = selectProvider(payload.providerHint);
    const compiled = renderTemplate(payload.template, payload.locale, payload.data);

    const result = provider === 'resend'
      ? await sendViaResend(payload, compiled)
      : await sendViaPostmark(payload, compiled);

    const client = getSupabaseClient(req);
    await recordAudit(client, {
      tenantId: payload.tenantId,
      action: 'email.sent',
      resource: payload.to,
      changes: { template: payload.template, provider },
    });

    logInfo('email.sent', { requestId, provider, template: payload.template, traceparent });
    return new Response(
      JSON.stringify({ ok: true, provider, guidance: providerGuidance(provider), providerResponse: result }),
      { headers: { 'content-type': 'application/json' } },
    );
  } catch (error) {
    await captureException(error, { route: 'email_send', traceparent });
    logError('email_failed', { error, traceparent });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
}

async function handleBounceWebhook(req: Request) {
  try {
    const payload = BounceWebhookSchema.parse(await req.json());
    const client = getSupabaseClient(req);
    const { error } = await client.from('email_bounces').insert({
      provider: payload.provider,
      email: payload.email,
      reason: payload.reason,
      occurred_at: payload.occurredAt ?? new Date().toISOString(),
      tenant_id: payload.tenantId,
    });
    if (error) throw error;

    await recordAudit(client, {
      tenantId: payload.tenantId,
      action: 'email.bounce.recorded',
      resource: payload.email,
      changes: { provider: payload.provider, reason: payload.reason },
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  } catch (error) {
    await captureException(error, { route: 'email_bounce' });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const fnIndex = segments.findIndex((segment) => segment === 'emails');
  const action = fnIndex >= 0 ? segments.slice(fnIndex + 1) : [];

  if (req.method === 'POST' && action[0] === 'webhooks' && action[1] === 'bounce') {
    return await handleBounceWebhook(req);
  }
  if (req.method === 'POST' && action.length === 0) {
    return await handleSendEmail(req);
  }

  return new Response('Not found', { status: 404 });
});
