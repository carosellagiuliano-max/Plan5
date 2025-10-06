# Release Checklist

Use this checklist before promoting a release to production. Attach the completed list to the change request for auditability (Swiss DSG + GDPR).

## Pre-Release
- [ ] Jira ticket(s) linked with acceptance criteria.
- [ ] Code reviewed and merged into `main`.
- [ ] Tests passed locally (`pnpm lint`, `pnpm test`, relevant integration checks).
- [ ] Database migrations reviewed for backward compatibility and applied to staging.
- [ ] OpenAPI spec (`reports/api-contract.yaml`) updated and validated with `npx @redocly/cli lint`.
- [ ] Security review completed for CSP, rate limits, and 2FA impacts.

## Staging Validation
- [ ] Deploy to staging (Supabase `eu-central-1`).
- [ ] Execute smoke tests:
  - [ ] Booking creation and overlap rejection.
  - [ ] Stripe payment intent with test card.
  - [ ] SumUp sandbox checkout (if credentials available).
  - [ ] Compliance export request.
  - [ ] Reminder cron run with staging secret.
- [ ] Verify SLO dashboards – booking success ≥ 99%, payment latency within 5 minutes.
- [ ] Confirm Sentry dashboards show no new untriaged errors.

## Compliance & Communication
- [ ] Update Records of Processing Activities (RoPA) if new personal data categories introduced.
- [ ] Notify Data Protection Officer for sign-off if release touches personal data or payment flows.
- [ ] Draft customer communication (if customer-facing changes) in DE/FR/EN per Swiss requirements.

## Production Release
- [ ] Schedule deployment outside Swiss public holiday blackout windows.
- [ ] Confirm on-call rotation aware of release window.
- [ ] Deploy web + edge functions + migrations.
- [ ] Run production smoke tests with limited scope (non-destructive bookings/payments).
- [ ] Announce completion in #ops with release notes and commit hash.

## Post-Release
- [ ] Monitor alerts for 1 hour (booking latency, payment failures, reminder backlog).
- [ ] Capture deployment metadata in audit log (`deployment.released` entry with version tag).
- [ ] Close Jira tickets and update changelog/README if necessary.
