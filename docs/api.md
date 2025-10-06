# Edge API Overview

Plan5 exposes Supabase Edge Functions as its public API. All endpoints are documented in [`reports/api-contract.yaml`](../reports/api-contract.yaml) and summarised below. Requests must include a `Bearer` token authorised for the tenant unless stated otherwise.

## Booking & Scheduling
- `POST /bookings` – Create an appointment. Validates service availability, returns `appointment` record.
- `POST /calendar` – Retrieve appointments and staff availability for a date range.
- `POST /reminders` – Cron-protected endpoint to dispatch pending reminders. Requires `REMINDER_CRON_SECRET` token in body.

## Payments & Commerce
- `POST /payments` – Create Stripe Payment Intent, Stripe Checkout Session, or SumUp checkout depending on payload.
- `POST /payments/refunds` – Issue provider refund and update Plan5 ledgers.
- `POST /payments/webhooks/stripe` – Stripe event ingestion.
- `POST /payments/webhooks/sumup` – SumUp event ingestion.
- `GET /payments/sumup/status/{checkoutId}` – Poll SumUp checkout status.
- `POST /payments/sumup/manual` – Manually mark a SumUp checkout as successful.
- `POST /shop` – Reserve stock for a product and optionally create an order.

## Compliance & Communications
- `POST /compliance` – Create export or deletion request for data subject.
- `GET /compliance/status/{id}` – Fetch compliance request state and export URL if available.
- `POST /compliance/consent` – Record consent granted/revoked events.
- `POST /emails` – Send transactional email through Resend or Postmark.
- `POST /emails/webhooks/bounce` – Record email bounce data.
- `POST /invoices` – Generate invoice, QR-bill payload, and optional notification email.

## Operations
- `POST /scheduled-stock-release` – Releases expired product reservations; typically triggered by Supabase cron.

## Updating the Contract
1. Modify edge functions as needed.
2. Update [`reports/api-contract.yaml`](../reports/api-contract.yaml) to reflect new paths, schemas, or examples.
3. Run `npx @redocly/cli lint reports/api-contract.yaml` (or equivalent) to validate syntax.
4. Reference the change in release notes so API consumers know about updates.

> **Note:** Keep payload examples free of personal data. Use anonymised tenant IDs and emails in the specification.
