# Payments Playbook

## Supported Providers
Plan5 supports Stripe and SumUp for card-present and online payments. Both are orchestrated through the `/payments` edge function with per-tenant audit logging.

### Stripe
- **Intent mode** – Default. Creates a Payment Intent with automatic payment methods and optional appointment metadata.
- **Checkout Session mode** – Use `mode: "checkout_session"` to redirect customers to Stripe Checkout with automatic tax.
- **Webhooks** – `/payments/webhooks/stripe` processes `payment_intent.*` and `checkout.session.completed` events. Idempotency is enforced through `payment_webhook_events`.
- **Refunds** – `/payments/refunds` triggers `payment_transactions` updates and `payment_refunds` entries.

### SumUp
- **Online checkout** – `/payments` with `provider: "sumup"` creates a SumUp checkout and stores session metadata in `sumup_sessions`.
- **Manual settlement** – `/payments/sumup/manual` records card-present transactions that were processed outside the API but require ledger alignment.
- **Status polling** – `/payments/sumup/status/:checkoutId` fetches the latest state from SumUp and updates the session record.
- **Webhooks** – `/payments/webhooks/sumup` listens for asynchronous status updates and reconciles orders.

## Data Model
| Table | Purpose |
| --- | --- |
| `payment_transactions` | Stores provider transaction identifiers, amounts, currency, and status. |
| `orders` | Booking or shop orders tied to payment lifecycle. |
| `payment_refunds` | Refund history including initiator and provider IDs. |
| `payment_webhook_events` | Deduplication of provider webhooks. |
| `sumup_sessions` | Tracks SumUp checkout sessions, deeplinks, and polling metadata. |

## Operational Considerations
- **Idempotency** – Provide `Idempotency-Key` header; defaults use `orderId`-derived keys.
- **Currency** – Accepts ISO 4217 codes. Stripe API lowercases; SumUp uppercases. Validate per-tenant allowed currencies (CHF/EUR) to stay compliant with Swiss VAT reporting.
- **Audit** – All payment flows record events such as `payment.intent.created`, `payment.refund.created`, or `payment.sumup.completed` for traceability.
- **3-D Secure** – Stripe requests 3DS automatically; ensure customer UI handles `nextAction` instructions returned by the API.
- **Compliance** – Store only provider IDs and minimal metadata to remain PCI SAQ A. Card data never touches Plan5 infrastructure.

## Monitoring & Alerts
- Configure alerts on `payment_transactions.status` transitions (`failed`, `requires_payment_method`).
- Ingest provider webhook failures into Sentry via `_shared/captureException`.
- Track refund volume vs sales in Supabase dashboards for finance sign-off.

## Recovery Steps
- If Stripe webhook delivery fails, replay events via Stripe dashboard filtered by signing secret.
- For SumUp, re-poll `/payments/sumup/status/:checkoutId` and reconcile with merchant portal exports.
- Use `recordAudit` trails when investigating disputed transactions.
