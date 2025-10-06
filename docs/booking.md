# Booking Domain Guide

## Overview
Plan5 orchestrates appointment bookings for tenant-specific services. Bookings are persisted in Supabase tables (`appointments`, `services`, `staff_availability`, `reminders`) and augmented by edge functions to enforce business rules and automation.

### Booking Workflow
1. **Availability lookup** – Clients call the [`/calendar`](./api.md#calendar) edge function to retrieve staff availability and existing appointments in a requested range.
2. **Slot validation** – When `/bookings` receives a reservation request it revalidates the requested slot against availability windows, overlapping appointments, and service duration/buffer rules.
3. **Appointment persistence** – Confirmed reservations are written to `appointments` with tenant, service, staff, and customer identifiers. The edge function ensures `appointments_no_overlap` constraints are respected and returns the created record to the caller.
4. **Reminder scheduling** – For appointments with lead-time larger than the service buffer, the function creates an email reminder job in the `reminders` table.
5. **Payments and invoicing** – `orders`, `payment_transactions`, and `invoices` associate with appointment IDs so that downstream payment flows can confirm or release reservations.

### Data Relationships
- `appointments.service_id` → `services.id`
- `appointments.staff_id` → `profiles.id` (staff)
- `appointments.customer_id` → `profiles.id` (customer)
- `reminders.resource_id` references `appointments.id`

### Validation Rules
- Appointment duration = service duration, `end_at` = `start_at + duration`.
- Slot must fall within staff availability window for the appointment weekday.
- No overlap with other `confirmed` appointments for the same staff member.
- Booking source is tagged via `source` (e.g., `edge:bookings`, `web`), enabling audit trails.

### Operational Tips
- **Idempotency** – Provide an `Idempotency-Key` header combining customer, slot, or cart identifiers to make retries safe.
- **Audit logging** – Booking creates audit events accessible from `audit_log` for compliance reporting.
- **Regional compliance** – Store timestamps in UTC; presentation logic localises to Switzerland-supported locales (`en-CH`, `de-CH`, `fr-CH`). Data residency remains in EU-central deployments of Supabase.

## Common Scenarios
| Scenario | Guidance |
| --- | --- |
| Double-booking detection | 409 status with `Slot unavailable`; prompt user to choose new time. |
| Outside availability | 422 status with `Outside staff availability`; update staff rota or adjust requested slot. |
| Reminder opt-out | Remove reminder entries for a customer via `reminders` table or add per-tenant preference flags. |
| Manual overrides | Staff can update `appointments.status` (`tentative`, `cancelled`) via Supabase UI while preserving audit log history. |

## Testing Checklist
- Create booking via edge function and confirm `appointments` row.
- Attempt overlapping booking – expect 409.
- Create booking outside availability – expect 422.
- Verify reminder inserted for qualifying appointments.
- Confirm audit log entry `appointment.booked` emitted with request id.
