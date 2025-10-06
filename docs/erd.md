# Data Model Reference (Textual ERD)

The following outlines primary entities and relationships supporting bookings, payments, and compliance.

## Core Scheduling
- **tenants** – Root entity for partitioning data.
- **profiles** – User profiles (customers, staff) with tenant scope.
- **services** – Configurable offerings per tenant including duration, buffers, price.
- **staff_availability** – Weekly availability slots per staff member.
- **appointments** – Reservations linking tenants, services, staff, and customers.
- **reminders** – Outbound reminder jobs referencing appointments or other resources.

Relationships:
- `profiles.tenant_id` → `tenants.id`
- `services.tenant_id` → `tenants.id`
- `appointments.service_id` → `services.id`
- `appointments.staff_id` → `profiles.id`
- `appointments.customer_id` → `profiles.id`
- `reminders.resource_id` → `appointments.id`

## Commerce & Billing
- **orders** – Monetary commitments associated with bookings or product reservations.
- **order_items** – Line items per order.
- **payment_transactions** – Provider-specific transactions (Stripe, SumUp) tied to orders.
- **payment_refunds** – Refund history referencing payment transactions.
- **sumup_sessions** – Temporary storage of SumUp checkout state.
- **invoices** – Issued invoices including Swiss QR-bill payload.
- **invoice_items** – Invoice line items referencing invoices.
- **invoice_archives** – Hash + storage reference for immutable invoice snapshots.
- **vat_settings** – Effective VAT rates per tenant.

Relationships:
- `orders.tenant_id` → `tenants.id`
- `order_items.order_id` → `orders.id`
- `payment_transactions.order_id` → `orders.id`
- `payment_refunds.transaction_id` → `payment_transactions.id`
- `sumup_sessions.order_id` → `orders.id`
- `invoices.order_id` → `orders.id`
- `invoice_items.invoice_id` → `invoices.id`
- `invoice_archives.invoice_id` → `invoices.id`

## Compliance & Audit
- **audit_log** – Canonical log of privileged actions.
- **compliance_requests** – GDPR/Swiss DSG export or deletion workflows.
- **consents** – Records of consent grants/revocations.
- **email_bounces** – Tracking of bounced transactional emails.
- **idempotency_keys** – Stored responses to deduplicate requests.

Relationships:
- `audit_log.tenant_id` → `tenants.id`
- `compliance_requests.tenant_id` → `tenants.id`
- `consents.tenant_id` → `tenants.id`
- `email_bounces.tenant_id` → `tenants.id`
- `idempotency_keys.tenant_id` → `tenants.id`

## Diagram Tips
To visualise the schema:
1. Run `supabase db inspect --schema app_public > schema.dot`.
2. Convert to SVG using Graphviz (`dot -Tsvg schema.dot -o docs/schema.svg`).
3. Store diagrams under `docs/` while keeping personal data out of examples.
