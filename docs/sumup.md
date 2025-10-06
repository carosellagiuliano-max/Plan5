# SumUp Integration Guide

## Credentials & Configuration
- **SUMUP_CLIENT_ID** – Merchant code issued by SumUp. In production, create via SumUp Business API. For staging, request a sandbox merchant account and flag credentials as non-live.
- **SUMUP_ACCESS_TOKEN** – OAuth access token with `payments` scope. Rotate quarterly and store in a secrets manager. For staging, use a token bound to the sandbox merchant.
- **Allowed Origins** – Configure the SumUp dashboard to accept the Plan5 domain for deep links (e.g., `https://app.plan5.ch`).

## Flow Summary
1. **Checkout creation** – `/payments` with `provider: "sumup"` issues a `POST /v0.1/checkouts` call to SumUp. Response includes `checkout_url` for app/web handoff.
2. **Session persistence** – Checkout metadata is stored in `sumup_sessions` for reconciliation and later manual overrides.
3. **Customer handoff** – Use the returned deeplink to open the SumUp app (card-present) or hosted page (card-not-present).
4. **Status polling** – `/payments/sumup/status/:checkoutId` polls SumUp and updates the session row.
5. **Webhook handling** – `/payments/webhooks/sumup` ingests asynchronous status updates and marks orders as paid/failed.
6. **Manual settlements** – `/payments/sumup/manual` marks transactions as `succeeded` when a terminal payment was captured offline.

## Compliance Notes
- **PSD2 & SCA** – SumUp handles strong customer authentication; Plan5 only stores transaction references, keeping us out of PCI scope beyond SAQ A.
- **Swiss regulations** – For CHF payments, ensure the merchant account is domiciled in Switzerland. VAT documentation is produced via `invoices` with Swiss QR-bill support.
- **Data residency** – SumUp API is EU-hosted; ensure data processing agreements (DPAs) are signed and referenced in the tenant onboarding documentation.

## Monitoring
- Track SumUp webhook delivery failures in Supabase `payment_webhook_events`.
- Alert when `sumup_sessions.status` remains `pending` for >15 minutes.
- Reconcile daily with SumUp exports to verify captured amounts vs `payment_transactions`.

## Troubleshooting
| Issue | Steps |
| --- | --- |
| Checkout URL expired | Call status endpoint; if expired, create a new checkout with identical parameters. |
| SumUp app fails to open | Confirm deeplink is whitelisted and user device has SumUp app installed. Provide fallback to web checkout. |
| Webhook signature validation | SumUp webhooks currently unauthenticated; ensure endpoint is hidden behind Supabase function secrets and store event IDs to dedupe. |
| Currency mismatch | Verify request currency matches merchant account supported currency (CHF/EUR). |
