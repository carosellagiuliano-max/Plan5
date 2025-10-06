#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI is required" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

supabase db push --linked
supabase db remote commit --message "apply core schema" || true

supabase db query < "$PROJECT_ROOT/supabase/seeds/demo_seed.sql"

echo "Demo data loaded."
