# Access Roles & Responsibilities

Plan5 enforces tenant-scoped RBAC with three primary roles exposed through Supabase JWT claims. Understanding responsibilities per role is critical for enforcing Swiss data-protection regulations.

## Role Matrix
| Role | Description | Typical Actors | Capabilities |
| --- | --- | --- | --- |
| `customer` | End customers booking services. | Public users. | Create bookings, view their appointments, receive reminders. No access to staff data beyond own bookings. |
| `staff` | Staff members fulfilling services. | Therapists, consultants. | Manage personal availability, confirm or cancel their assigned appointments, view customer contact data relevant to assigned bookings. |
| `admin` | Tenant administrators. | Clinic managers, franchise owners. | Configure services, manage staff accounts, view financial reports, trigger compliance exports/deletions, manage invoices and payments. |

## Security Expectations
- **Least privilege** – Ensure JWT claims embed `tenant_id` to scope database policies. Review PostgREST policies to avoid cross-tenant leakage.
- **2FA requirement** – Staff and admin logins must enforce 2FA via Supabase Auth or external identity provider. Document recovery codes and rotation procedures per tenant.
- **Audit logging** – All admin actions feed into `audit_log`. Review logs quarterly to meet GDPR accountability obligations.
- **Data minimisation** – Customers should only see their appointments; staff should only handle data necessary for service delivery.

## Onboarding Checklist
1. Invite user via Supabase Auth with tenant metadata.
2. Assign role in JWT or via Postgres function on signup.
3. Capture acceptance of data processing agreement for admins.
4. Enable 2FA and store backup codes in encrypted vault.

## Offboarding Checklist
- Revoke Supabase Auth session and delete refresh tokens.
- Rotate shared secrets (SumUp access tokens, Stripe restricted keys) if admins depart.
- Transfer ownership of scheduled reports to another admin.
- Confirm compliance exports or deletions are completed for leaving staff per Swiss labour law retention policies.
