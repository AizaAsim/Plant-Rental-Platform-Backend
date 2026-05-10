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

echo "== Gardener onboarding catalog (public) =="
curl -sS "${BASE}/api/v1/gardeners/onboarding" | head -c 500
echo

if [[ -n "$VJ" ]]; then
  echo "== Vendor orders list (?page=&limit= must be numeric; regression) =="
  curl -sS "${BASE}/api/v1/orders/vendor/orders?page=1&limit=2" $(hdr_auth "$VJ") | head -c 500
  echo
  echo "== Vendor fulfillment-audit (bogus order id expect 404) =="
  curl -sS "${BASE}/api/v1/orders/vendor/orders/00000000-0000-4000-8000-000000000098/fulfillment-audit" $(hdr_auth "$VJ") | head -c 380
  echo
  echo "== Vendor onboarding (Phase 00) =="
  curl -sS "${BASE}/api/v1/vendor/onboarding" $(hdr_auth "$VJ") | head -c 800
  echo
  echo "== Vendor staff-gardeners list (alias) =="
  curl -sS "${BASE}/api/v1/vendor/staff-gardeners" $(hdr_auth "$VJ") | head -c 600
  echo
  echo "== Vendor package create (sample) =="
  curl -sS -X POST "${BASE}/api/v1/vendor/packages" \
    $(hdr_auth "$VJ") -H "Content-Type: application/json" \
    -d '{"name":"TestPkg","tier":"BASIC","max_plant_count":3,"rental_duration_days":30,"includes_maintenance":false,"maintenance_visits_per_month":0,"base_price":100,"deposit_amount":0,"allows_installments":false,"is_active":true}' | head -c 400
  echo
  echo "== Vendor package list =="
  curl -sS "${BASE}/api/v1/vendor/packages" $(hdr_auth "$VJ") | head -c 400
  echo
  echo "== Vendor rentals by bucket (canonical) =="
  curl -sS "${BASE}/api/v1/vendor/rentals?bucket=DUE_TODAY&page=1&limit=3" $(hdr_auth "$VJ") | head -c 520
  echo
  NID="$(curl -sS "${BASE}/api/v1/vendor/onboarding" $(hdr_auth "$VJ") | jq -r '.nursery_id // empty')"
  if [[ -n "$NID" && "$NID" != "null" ]]; then
    echo "== Public nursery vendor-packages (Phase 02) =="
    curl -sS "${BASE}/api/v1/nurseries/${NID}/vendor-packages" | head -c 600
    echo
  fi
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

if [[ -n "$UJ" ]]; then
  echo "== Customer fulfillment-summary (bogus order → 404) =="
  curl -sS "${BASE}/api/v1/orders/00000000-0000-4000-8000-000000000097/fulfillment-summary" $(hdr_auth "$UJ") | head -c 380
  echo
  echo "== Freelance jobs — customer my-requests =="
  curl -sS "${BASE}/api/v1/freelance-jobs/my-requests?page=1&limit=5" $(hdr_auth "$UJ") | head -c 450
  echo
  echo "== Freelance jobs — cancel bogus id (expect not found envelope) =="
  curl -sS -X POST "${BASE}/api/v1/freelance-jobs/00000000-0000-4000-8000-000000000099/cancel" $(hdr_auth "$UJ") \
    -H "Content-Type: application/json" -d '{}' | head -c 380
  echo
  echo "== Payments initiate FREELANCE bogus ref (expect 404) =="
  curl -sS -X POST "${BASE}/api/v1/payments/initiate" $(hdr_auth "$UJ") \
    -H "Content-Type: application/json" \
    -d '{"payment_for":"FREELANCE_JOB","reference_id":"00000000-0000-4000-8000-000000000099","payment_method":"card"}' | head -c 380
  echo
fi

if [[ -n "$GJ" ]]; then
  echo "== Freelance jobs — open marketplace (gardener) =="
  curl -sS "${BASE}/api/v1/freelance-jobs/open?page=1&limit=5" $(hdr_auth "$GJ") | head -c 450
  echo
  echo "== Freelance jobs — withdraw bogus id (expect not found envelope) =="
  curl -sS -X POST "${BASE}/api/v1/freelance-jobs/00000000-0000-4000-8000-000000000099/withdraw" $(hdr_auth "$GJ") \
    -H "Content-Type: application/json" -d '{}' | head -c 380
  echo
fi

echo "Done. Set USER_JWT, VENDOR_JWT, ADMIN_JWT, GARDENER_JWT to exercise authenticated routes fully."
