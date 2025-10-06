# Operations Runbook

## Scope
This runbook supports incident responders operating Plan5 in Switzerland/EU, covering outages, degraded performance, or security incidents.

## Incident Classification
| Severity | Description | Example |
| --- | --- | --- |
| SEV-1 | Full outage impacting >50% tenants | Supabase unavailable in `eu-central-1`, booking/payment functions failing. |
| SEV-2 | Partial outage or regulatory-impacting bug | SumUp webhooks failing, invoices not generating QR-bill. |
| SEV-3 | Degraded performance or isolated tenant issue | Increased booking latency for one tenant, email bounces. |

## On-Call Checklist
1. Acknowledge alert in PagerDuty/Opsgenie within 5 minutes.
2. Announce in `#ops` channel (include severity, impact, lead).
3. Create incident doc in shared drive (EU-hosted) with timestamp in CET/CEST.
4. Assign roles: Incident Commander, Communications, Scribe, Liaison to DPO if personal data is impacted.

## Initial Diagnostics
- Check Supabase status page (Frankfurt region).
- Review Sentry issues filtered by function (bookings, payments, compliance).
- Query `supabase logs functions <name> --since "15m"` for request patterns.
- Validate rate limiting or authentication errors (look for 401/429).
- For payment incidents, confirm provider status (Stripe, SumUp status pages) and contact merchant support if required.

## Remediation Playbooks
### Bookings failing with 500/409
- Inspect `appointments_no_overlap` constraints for stuck transactions.
- Flush idempotency keys if needed via SQL (`delete from idempotency_keys where expires_at < now();`).
- If staff availability incorrect, restore from backup or apply manual fix.

### Payments stuck in `pending`
- Replay Stripe events via dashboard.
- Trigger `/payments/sumup/status/:checkoutId` for stale SumUp checkouts.
- For manual settlements, use `/payments/sumup/manual` with staff-provided notes.

### Compliance exports not completing
- Review `compliance_requests` for `in_progress` > 30 minutes.
- Check Supabase function logs for `compliance` errors; redeploy if corrupted.
- Escalate to DPO if deadline risk (<72h to fulfil GDPR/DSG requests).

## Disaster Recovery
- If data corruption suspected, engage Database SME.
- Spin up staging project from PITR snapshot and validate.
- Communicate recovery plan to stakeholders, including estimated RTO (≤4h) and RPO (≤1h).

## Communication Templates
- **Customer update (DE/FR/EN)** – Provide timeline, impact, mitigation, and regulatory commitment.
- **Regulatory notice** – If personal data breach, coordinate with DPO to notify FDPIC (Switzerland) and relevant EU authorities within 72 hours.

## Post-Incident
1. Close incident when service stabilised for 30 minutes.
2. Conduct blameless post-mortem within 5 working days.
3. File action items with owners and due dates.
4. Update this runbook with lessons learned.
5. Store incident artefacts in EU-hosted archive per retention policy.
