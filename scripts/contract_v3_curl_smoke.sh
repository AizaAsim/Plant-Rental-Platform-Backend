#!/usr/bin/env bash
# Smoke tests for contract v3.1 routes. Requires a running API and valid JWTs.
# Usage: export API_BASE=http://localhost:3002 USER_JWT=... VENDOR_JWT=... ADMIN_JWT=... GARDENER_JWT=...
set -euo pipefail
BASE="${API_BASE:-http://localhost:3002}"
UJ="${USER_JWT:-}"
VJ="${VENDOR_JWT:-}"
AJ="${ADMIN_JWT:-}"
GJ="${GARDENER_JWT:-}"

hdr_auth() { [[ -n "$1" ]] && echo -H "Authorization: Bearer $1"; }

echo "== Health (no auth) =="
curl -sS -o /dev/null -w "%{http_code}\n" "${BASE}/" || true

if [[ -n "$VJ" ]]; then
  echo "== Vendor package create (sample) =="
  curl -sS -X POST "${BASE}/api/v1/vendor/packages" \
    $(hdr_auth "$VJ") -H "Content-Type: application/json" \
    -d '{"name":"TestPkg","tier":"BASIC","max_plant_count":3,"rental_duration_days":30,"includes_maintenance":false,"maintenance_visits_per_month":0,"base_price":100,"deposit_amount":0,"allows_installments":false,"is_active":true}' | head -c 400
  echo
  echo "== Vendor package list =="
  curl -sS "${BASE}/api/v1/vendor/packages" $(hdr_auth "$VJ") | head -c 400
  echo
fi

if [[ -n "$UJ" ]]; then
  echo "== Freelance create (needs real address_id) =="
  echo "skip if no address — set delivery_address_id in body"
  echo
fi

if [[ -n "$AJ" ]]; then
  echo "== Admin manual orders =="
  curl -sS "${BASE}/api/v1/admin/manual-orders?page=1&limit=5" $(hdr_auth "$AJ") | head -c 400
  echo
  echo "== Admin freelance config =="
  curl -sS "${BASE}/api/v1/admin/settings/freelance-match-config" $(hdr_auth "$AJ") | head -c 400
  echo
  echo "== Internal expire-unpaid (dry run) =="
  curl -sS -X POST "${BASE}/api/v1/internal/jobs/orders/expire-unpaid" $(hdr_auth "$AJ") \
    -H "Content-Type: application/json" -d '{"dry_run":true,"window_hours":6}' | head -c 400
  echo
fi

if [[ -n "$GJ" ]]; then
  echo "== Freelance open jobs =="
  curl -sS "${BASE}/api/v1/freelance-jobs/open" $(hdr_auth "$GJ") | head -c 400
  echo
fi

echo "Done. Set USER_JWT, VENDOR_JWT, ADMIN_JWT, GARDENER_JWT to exercise authenticated routes fully."
