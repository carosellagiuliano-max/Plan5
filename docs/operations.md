# Operations Handbook

## Change Management
- Track changes via GitHub PRs with mandatory reviews for payments, compliance, or schema migrations.
- Use feature flags within Supabase config tables for gradual rollouts.
- Maintain a change calendar for customer-facing features to avoid Swiss public holidays impacting hospitality/clinic operations.

## Security Controls
### Content Security Policy (CSP)
- Frontend served via Next.js must emit a strict CSP covering scripts (`'self'`, `https://*.supabase.co`, `https://js.stripe.com`) and frames for Stripe Checkout or SumUp. Maintain a report-only endpoint for new third-party inclusions.
- Enforce HTTPS with HSTS (31536000 seconds) and `includeSubDomains` for `.plan5.ch`.

### Rate Limiting
- Edge functions rely on Supabase network-level quotas. Augment with the `idempotency_keys` table to detect replayed requests.
- Use API gateway (e.g., Cloudflare) to enforce per-tenant rate limits: 60 bookings/min, 30 payments/min, 10 compliance exports/day.
- Log rate-limit breaches to Sentry tagged with `tenantId` for follow-up.

### Two-Factor Authentication (2FA)
- Require 2FA for staff/admin accounts through Supabase Auth or federated IdP (Azure AD/Keycloak) configured for Swiss tenants.
- Store 2FA recovery codes in tenant-managed password managers. Audit completion quarterly to satisfy FINMA guidance for financial-like systems.

## Disaster Recovery
- **Backups** – Enable Supabase PITR (point-in-time recovery) and schedule daily logical dumps stored in EU (Frankfurt) object storage.
- **Testing** – Perform quarterly restore tests into a staging project. Validate bookings, payments, and invoices can be replayed without violating idempotency safeguards.
- **Runbooks** – See [`RUNBOOK.md`](../RUNBOOK.md) for outage handling and communication templates compliant with Swiss DSG reporting timelines.
- **RPO/RTO** – Target RPO ≤ 1 hour, RTO ≤ 4 hours. Document exceptions in post-incident reports.

## Observability
### Service Level Objectives (SLO)
- **Booking success rate** – 99.5% of `POST /bookings` requests succeed over 30 days.
- **Payment completion** – 99% of payments reach `paid` or `pending` status within 5 minutes.
- **Reminder dispatch latency** – 95% of reminders processed within 2 minutes of scheduled time.

### Service Level Indicators (SLI)
- Instrument edge functions with latency histograms via Supabase logs exported to your observability stack (Datadog, Grafana Loki).
- Record error rates from Sentry issues tagged by function name.
- Track queue depth of `reminders` to detect backlog.

### Alerting
- Integrate Supabase log drains with PagerDuty or Opsgenie.
- Configure alerts for:
  - Payment webhook failure rate >5% over 15 minutes.
  - Reminder backlog >50 pending items.
  - Booking latency p95 > 2s.
- Align alert severities with Swiss business hours; use follow-the-sun coverage for EU operations.

## Regional Compliance Guidance
- Host Supabase in `eu-central-1` (Frankfurt) to meet Swiss/EU data residency.
- Sign DPAs with Stripe, SumUp, Resend/Postmark, and Resend sub-processors. Store evidence in Confluence/SharePoint.
- Maintain Swiss DSG and GDPR records of processing, including appointment data retention policies.
- Implement customer data deletion workflows within 30 days of request, with evidence stored for audits.

## Operational Contacts
- **Incident Commander** – On-call engineer (rotating weekly) responsible for cross-team coordination.
- **Data Protection Officer** – Ensures compliance with Swiss DSG & GDPR reporting obligations.
- **Finance Lead** – Approves refunds > CHF 500 and SumUp manual settlements.
