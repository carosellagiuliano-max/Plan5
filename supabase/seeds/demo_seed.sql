-- Seed demo data for development and tests
truncate table app_public.order_items cascade;
truncate table app_public.orders cascade;
truncate table app_public.product_stock cascade;
truncate table app_public.products cascade;
truncate table app_public.appointments cascade;
truncate table app_public.staff_availability cascade;
truncate table app_public.services cascade;
truncate table app_public.vouchers cascade;
truncate table app_public.cms_blocks cascade;
truncate table app_public.cms_pages cascade;
truncate table app_public.audit_log cascade;
truncate table app_public.uploads cascade;
truncate table app_public.error_reports cascade;
truncate table app_public.idempotency_keys cascade;
truncate table app_public.profiles cascade;
truncate table app_public.organisations cascade;

-- Create a demo organisation
insert into app_public.organisations (id, slug, name, billing_email)
values
  ('11111111-1111-1111-1111-111111111111', 'demo', 'Demo Salon', 'billing@demo.local');

-- Demo auth users
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@demo.local', crypt('Password123!', gen_salt('bf')), timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{"role":"admin"}', timezone('utc', now()), timezone('utc', now())),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@demo.local', crypt('Password123!', gen_salt('bf')), timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{"role":"staff"}', timezone('utc', now()), timezone('utc', now())),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer@demo.local', crypt('Password123!', gen_salt('bf')), timezone('utc', now()), '{"provider":"email","providers":["email"]}', '{"role":"customer"}', timezone('utc', now()), timezone('utc', now()))
on conflict (id) do nothing;

-- Profiles for each user
insert into app_public.profiles (id, tenant_id, role, full_name, phone)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin', 'Alex Admin', '+10000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'staff', 'Sam Stylist', '+10000000002'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'customer', 'Casey Customer', '+10000000003')
on conflict (id) do update set tenant_id = excluded.tenant_id, role = excluded.role;

-- Services
insert into app_public.services (id, tenant_id, name, description, duration_minutes, price_cents, buffer_minutes)
values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Haircut', 'Signature haircut service', 45, 5000, 15),
  ('21111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Coloring', 'Full colour treatment', 90, 12000, 30)
on conflict (id) do update set name = excluded.name;

-- Staff availability
insert into app_public.staff_availability (id, tenant_id, staff_id, weekday, start_time, end_time, capacity)
values
  ('31111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, '09:00', '17:00', 1),
  ('31111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 3, '10:00', '18:00', 1)
on conflict (id) do update set start_time = excluded.start_time, end_time = excluded.end_time;

-- Appointments
insert into app_public.appointments (id, tenant_id, service_id, customer_id, staff_id, start_at, end_at, status, total_price_cents)
values
  ('41111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', timezone('utc', now()) + interval '1 day', timezone('utc', now()) + interval '1 day 45 minutes', 'confirmed', 5000)
  on conflict (id) do update set status = excluded.status, start_at = excluded.start_at, end_at = excluded.end_at;

-- Products and stock
insert into app_public.products (id, tenant_id, sku, name, description, price_cents)
values
  ('51111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'SKU-HAIR-OIL', 'Hair Oil', 'Argan oil treatment', 2500),
  ('51111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'SKU-SHAMPOO', 'Shampoo', 'Sulfate-free shampoo', 1800)
on conflict (id) do update set name = excluded.name;

insert into app_public.product_stock (id, tenant_id, product_id, quantity, reserved, available_at)
values
  ('61111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '51111111-1111-1111-1111-111111111111', 50, 5, timezone('utc', now()) - interval '1 day'),
  ('61111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', '51111111-1111-1111-1111-111111111112', 100, 0, timezone('utc', now()) - interval '1 hour')
on conflict (id) do update set quantity = excluded.quantity, reserved = excluded.reserved;

-- Orders & items
insert into app_public.orders (id, tenant_id, customer_id, status, total_cents, payment_intent_id)
values
  ('71111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'paid', 7500, 'stripe_pi_demo')
on conflict (id) do update set status = excluded.status, total_cents = excluded.total_cents;

insert into app_public.order_items (id, order_id, product_id, appointment_id, description, quantity, unit_price_cents)
values
  ('81111111-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111', '51111111-1111-1111-1111-111111111111', null, 'Hair Oil', 1, 2500),
  ('81111111-1111-1111-1111-111111111112', '71111111-1111-1111-1111-111111111111', null, '41111111-1111-1111-1111-111111111111', 'Haircut service', 1, 5000)
on conflict (id) do update set quantity = excluded.quantity, unit_price_cents = excluded.unit_price_cents;

-- Vouchers
insert into app_public.vouchers (id, tenant_id, code, type, amount_cents, percent, max_redemptions, starts_at, ends_at)
values
  ('91111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'WELCOME10', 'percent', null, 10, 100, timezone('utc', now()) - interval '1 day', timezone('utc', now()) + interval '30 days')
on conflict (id) do update set percent = excluded.percent;

-- CMS sample page
insert into app_public.cms_pages (id, tenant_id, slug, title, status)
values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'welcome', 'Welcome', 'published')
on conflict (id) do update set title = excluded.title, status = excluded.status;

insert into app_public.cms_blocks (id, page_id, position, kind, content)
values
  ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 1, 'hero', jsonb_build_object('headline', 'Experience the Demo Salon', 'cta', 'Book now'))
on conflict (id) do update set content = excluded.content;

-- Demo audit log entries
insert into app_public.audit_log (tenant_id, actor_id, actor_role, action, resource, changes)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', 'seeded', 'system', jsonb_build_object('message', 'Demo data seeded'));

-- Idempotency example entry
insert into app_public.idempotency_keys (key, tenant_id, request_hash, response, expires_at)
values
  ('demo-booking-1', '11111111-1111-1111-1111-111111111111', 'hash-demo', jsonb_build_object('status', 'ok'), timezone('utc', now()) + interval '1 day')
on conflict (key) do update set response = excluded.response, expires_at = excluded.expires_at;

