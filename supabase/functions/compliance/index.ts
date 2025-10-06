import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import {
  captureException,
  getSupabaseClient,
  logError,
  recordAudit,
  withIdempotency,
} from '../_shared/mod.ts';

const ComplianceRequestSchema = z.object({
  tenantId: z.string().uuid(),
  subjectId: z.string().uuid(),
  type: z.enum(['export', 'delete']),
  initiatedBy: z.enum(['customer', 'staff', 'system']).default('customer'),
  reason: z.string().optional(),
});

const ConsentSchema = z.object({
  tenantId: z.string().uuid(),
  subjectId: z.string().uuid(),
  consentType: z.string(),
  granted: z.boolean(),
  metadata: z.record(z.any()).optional(),
});

async function buildExport(client: ReturnType<typeof getSupabaseClient>, tenantId: string, subjectId: string) {
  const [orders, appointments, consents] = await Promise.all([
    client
      .from('orders')
      .select('id, status, total_cents, currency, created_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', subjectId),
    client
      .from('appointments')
      .select('id, status, start_at, end_at, service_id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', subjectId),
    client
      .from('consents')
      .select('consent_type, granted, granted_at, revoked_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('subject_id', subjectId),
  ]);

  if (orders.error) throw orders.error;
  if (appointments.error) throw appointments.error;
  if (consents.error) throw consents.error;

  return {
    orders: orders.data,
    appointments: appointments.data,
    consents: consents.data,
    generatedAt: new Date().toISOString(),
  };
}

async function processComplianceRequest(req: Request) {
  const payload = ComplianceRequestSchema.parse(await req.json());
  const client = getSupabaseClient(req);
  const idKey = `compliance:${payload.tenantId}:${payload.subjectId}:${payload.type}`;

  const response = await withIdempotency(client, idKey, 3600, async () => {
    const { data: request, error } = await client
      .from('compliance_requests')
      .insert({
        tenant_id: payload.tenantId,
        subject_id: payload.subjectId,
        request_type: payload.type,
        status: 'in_progress',
        initiated_by: payload.initiatedBy,
        reason: payload.reason,
      })
      .select('id')
      .maybeSingle();
    if (error) throw error;
    const requestId = request?.id as string;

    if (payload.type === 'export') {
      const exportData = await buildExport(client, payload.tenantId, payload.subjectId);
      const exportUrl = `data:application/json;base64,${btoa(JSON.stringify(exportData))}`;
      const { error: updateError } = await client
        .from('compliance_requests')
        .update({ status: 'completed', export_url: exportUrl, completed_at: new Date().toISOString() })
        .eq('id', requestId);
      if (updateError) throw updateError;
      await recordAudit(client, {
        tenantId: payload.tenantId,
        actorId: payload.subjectId,
        actorRole: payload.initiatedBy,
        action: 'compliance.export.completed',
        resource: requestId,
      });
      return { requestId, status: 'completed', exportUrl };
    }

    // Delete request - anonymise customer data
    const { error: updateProfileError } = await client
      .from('profiles')
      .update({ full_name: null, phone: null, metadata: { anonymised: true } })
      .eq('id', payload.subjectId)
      .eq('tenant_id', payload.tenantId);
    if (updateProfileError) throw updateProfileError;

    const { error: updateAppointments } = await client
      .from('appointments')
      .update({ notes: null, metadata: {} })
      .eq('tenant_id', payload.tenantId)
      .eq('customer_id', payload.subjectId);
    if (updateAppointments) throw updateAppointments;

    const { error: requestUpdate } = await client
      .from('compliance_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', requestId);
    if (requestUpdate) throw requestUpdate;

    await recordAudit(client, {
      tenantId: payload.tenantId,
      actorId: payload.subjectId,
      actorRole: payload.initiatedBy,
      action: 'compliance.delete.completed',
      resource: requestId,
    });
    return { requestId, status: 'completed' };
  }, { tenantId: payload.tenantId });

  return response;
}

async function recordConsent(req: Request) {
  const payload = ConsentSchema.parse(await req.json());
  const client = getSupabaseClient(req);
  const { error } = await client.from('consents').insert({
    tenant_id: payload.tenantId,
    subject_id: payload.subjectId,
    consent_type: payload.consentType,
    granted: payload.granted,
    metadata: payload.metadata ?? {},
    revoked_at: payload.granted ? null : new Date().toISOString(),
  });
  if (error) throw error;
  await recordAudit(client, {
    tenantId: payload.tenantId,
    actorId: payload.subjectId,
    actorRole: 'customer',
    action: 'consent.updated',
    resource: payload.consentType,
    changes: { granted: payload.granted },
  });
  return { ok: true };
}

async function getStatus(req: Request, id: string) {
  const client = getSupabaseClient(req);
  const { data, error } = await client
    .from('compliance_requests')
    .select('id, status, export_url, completed_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({
    requestId: data.id,
    status: data.status,
    exportUrl: data.export_url,
    completedAt: data.completed_at,
  }), { headers: { 'content-type': 'application/json' } });
}

serve(async (req) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const fnIndex = segments.findIndex((segment) => segment === 'compliance');
  const action = fnIndex >= 0 ? segments.slice(fnIndex + 1) : [];

  try {
    if (req.method === 'POST' && action.length === 0) {
      const response = await processComplianceRequest(req);
      return new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } });
    }
    if (req.method === 'POST' && action[0] === 'consent') {
      const response = await recordConsent(req);
      return new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } });
    }
    if (req.method === 'GET' && action[0] === 'status' && action[1]) {
      return await getStatus(req, action[1]);
    }

    return new Response('Not found', { status: 404 });
  } catch (error) {
    await captureException(error, { action });
    logError('compliance.failed', { error, action });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
});
