# Plan5

Plan5 is a multi-tenant scheduling and commerce platform for Swiss/EU service businesses. The monorepo combines a Next.js web application, Supabase Postgres, and Supabase Edge Functions to orchestrate bookings, payments, compliance, and operations with Swiss DSG/GDPR alignment.

## Architecture
- **Next.js app (`apps/web`)** – Customer/staff portal with locale-aware UI (`en-CH`, `de-CH`, `fr-CH`). Uses Supabase Auth, Sentry telemetry, and server actions to trigger edge APIs.
- **Supabase Edge Functions (`supabase/functions`)** – Domain services for bookings, payments (Stripe + SumUp), emails, invoices, compliance, and scheduled jobs. All HTTP contracts are documented in [`reports/api-contract.yaml`](reports/api-contract.yaml).
- **Supabase Postgres** – Core data store with row-level security per tenant, audit logging, and support tables for idempotency, compliance, and VAT configuration.
- **Shared packages (`packages/*`)** – UI components and TypeScript types shared across apps.
- **Operational docs (`docs/`, `DEPLOYMENT.md`, `RUNBOOK.md`)** – Guidance for EU-central deployments, release management, and incident response.

## Environment Setup
1. Install dependencies: `corepack enable` then `pnpm install`.
2. Copy `.env.example` to `.env.local` (for Next.js) and configure Supabase/Stripe/SumUp credentials per environment comments.
3. Start Supabase locally: `supabase start` (requires Supabase CLI). Ensure project runs in EU-compatible timezone (`Europe/Zurich`).
4. Seed data if required: `supabase db reset` will apply migrations and seeds.
5. Run development servers:
   - Web: `pnpm --filter web dev`
   - Edge functions: `supabase functions serve --env-file supabase/.env` (set Supabase credentials before running).

## Testing Strategy
- **Unit/Component tests** – Execute via `pnpm test` (Jest/React Testing Library where available).
- **Linting/Type checks** – `pnpm lint` and `pnpm typecheck` to ensure consistent code quality.
- **Edge function dry runs** – `supabase functions serve <name>` with mock payloads. Validate responses align with [`reports/api-contract.yaml`](reports/api-contract.yaml).
- **Integration flows** – Use the checklists in `docs/booking.md`, `docs/payments.md`, and `docs/operations.md` to verify bookings, payments, reminders, and compliance flows end-to-end.
- **Observability validation** – Confirm Sentry DSN and Supabase log drains emit telemetry before releases.

## Deployment
See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full deployment guide. Key points:
- Host Supabase in `eu-central-1` to satisfy Swiss DSG/GDPR requirements.
- Maintain separate staging and production environments with sandbox/live payment credentials.
- Deploy edge functions via `supabase functions deploy` and the web app via your CI provider (`pnpm build`).
- Run smoke tests post-deploy: booking creation, payment intent, compliance export, reminder dispatch.
- Update processing records and privacy notices whenever new processors are introduced.

## API Contract & Documentation
- Review domain-specific guides under `docs/` (bookings, payments, SumUp integration, roles, ERD, operations).
- Update [`reports/api-contract.yaml`](reports/api-contract.yaml) whenever edge functions change. Use `npx @redocly/cli lint reports/api-contract.yaml` before opening a PR.
- Keep compliance/security/disaster recovery practices in sync with `docs/operations.md`, `RUNBOOK.md`, and `RELEASE_CHECKLIST.md`.

## Compliance Alignment
- Enforce tenant-scoped RBAC and 2FA per `docs/roles.md`.
- Store data in EU-based services and sign DPAs with all processors (Stripe, SumUp, Resend/Postmark, Sentry).
- Follow `RUNBOOK.md` for incident handling and `RELEASE_CHECKLIST.md` for approvals to ensure Swiss DSG/GDPR obligations are met.

## Contributing
1. Branch from `main` and create focused commits.
2. Update documentation and the OpenAPI contract alongside code changes.
3. Run the testing commands above.
4. Submit a PR referencing relevant Jira tickets and include release checklist items.
