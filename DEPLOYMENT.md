# Deployment Guide

## Prerequisites
- Supabase project hosted in `eu-central-1` (Frankfurt) to satisfy Swiss DSG and EU GDPR data residency.
- Stripe, SumUp, Resend/Postmark, and Sentry accounts with EU data processing agreements signed.
- CI/CD pipeline (GitHub Actions, GitLab CI, or Netlify) with environment secrets managed via HashiCorp Vault or Supabase Secrets.

## Environments
| Environment | Region | Purpose | Notes |
| --- | --- | --- | --- |
| `staging` | `eu-central-1` | Pre-production validation, restore testing. | Mirrors production schema; use sandbox payment credentials. |
| `production` | `eu-central-1` | Customer-facing. | Use live payment credentials and stricter rate limits. |

## Steps
1. **Prepare environment variables** – Copy `.env.example` to environment-specific secret store. Confirm payment keys align with environment (Stripe live vs test, SumUp live vs sandbox).
2. **Migrate database** – Run `supabase db push` or apply SQL migrations via CI. Verify migrations succeed in staging before production.
3. **Deploy edge functions** – `supabase functions deploy --project-ref <ref> --import-map supabase/functions/import_map.json`. Promote after staging smoke tests.
4. **Deploy web app** – `pnpm install && pnpm build`. Use Next.js incremental static regeneration tokens stored in `REVALIDATE_SECRET`.
5. **Post-deploy checks** – Execute smoke tests:
   - `POST /bookings` test booking.
   - `POST /payments` with Stripe test key.
   - `POST /compliance` export request.
   - Trigger reminder cron with staging token.
6. **Compliance review** – Ensure audit log records deployments (tag commit hash) and update processing records per Swiss regulations.

## Rollback Strategy
- Web: redeploy previous build from CI artifacts.
- Edge functions: `supabase functions deploy <name> --import-map ... --version <previous>` using stored release tags.
- Database: Use Supabase PITR to restore to pre-deployment timestamp in staging, validate, then apply to production if required.

## Regional Considerations
- Retain logs within EU-based observability platforms; avoid transferring personal data outside EU/CH.
- Update privacy notice when introducing new processors or sub-processors.
- Coordinate deployments outside of Swiss federal public holidays when customer support staffing is limited.
