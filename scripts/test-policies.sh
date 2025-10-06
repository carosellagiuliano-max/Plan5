#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the service-role connection string}" 

psql_cmd=(psql "$DATABASE_URL" -v "ON_ERROR_STOP=1" -q)

echo "[anon] ensuring appointments are not accessible"
if "${psql_cmd[@]}" <<'SQL'
set local role anon;
select 1 from app_public.appointments limit 1;
SQL
then
  echo "Anon user unexpectedly read appointments" >&2
  exit 1
else
  echo "Anon blocked as expected"
fi

run_as() {
  local role=$1
  local user_id=$2
  local tenant_id=$3
  local statement=$4
  local claims
  claims=$(printf '{"role":"%s","sub":"%s","tenant_id":"%s"}' "$role" "$user_id" "$tenant_id")
  "${psql_cmd[@]}" <<SQL
begin;
set local role authenticated;
set local "request.jwt.claims" = '$claims';
$statement
commit;
SQL
}

echo "[customer] can read own appointment"
run_as customer 'cccccccc-cccc-cccc-cccc-cccccccccccc' '11111111-1111-1111-1111-111111111111' "select count(*) from app_public.appointments where customer_id = auth.uid();"

echo "[customer] cannot update others order"
if run_as customer 'cccccccc-cccc-cccc-cccc-cccccccccccc' '11111111-1111-1111-1111-111111111111' "update app_public.orders set status = 'cancelled' where customer_id <> auth.uid();"; then
  echo "Customer updated a foreign order unexpectedly" >&2
  exit 1
else
  echo "Customer prevented from updating other orders"
fi

echo "[staff] can manage services"
run_as staff 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' '11111111-1111-1111-1111-111111111111' "update app_public.services set name = name where true;"

echo "[admin] can read audit log"
run_as admin 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' '11111111-1111-1111-1111-111111111111' "select count(*) from app_public.audit_log;"

echo "Policy tests completed"
