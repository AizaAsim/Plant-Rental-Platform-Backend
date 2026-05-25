#!/usr/bin/env bash
# Extension, penalty, payment idempotency, and complaint flow smoke tests.
#
# Usage (auto-login from seed accounts):
#   export API_BASE=http://localhost:3002
#   ./scripts/curl_rental_penalty_extension_flow.sh
#
# Or pass JWTs explicitly:
#   export USER_JWT=... ADMIN_JWT=... VENDOR_JWT=...
#   export ORDER_NUM=ORD-SEED-1004   # optional; default tries 1004 then 1005
set -euo pipefail

BASE="${API_BASE:-http://localhost:3002}"
PASSWORD="${SEED_PASSWORD:-Password123!}"
ORDER_NUM="${ORDER_NUM:-ORD-SEED-1004}"
PENALTY_ORDER_NUM="${PENALTY_ORDER_NUM:-ORD-SEED-1005}"

hdr() { [[ -n "${1:-}" ]] && echo -H "Authorization: Bearer $1"; }
json() { echo -H "Content-Type: application/json"; }

login() {
  local email="$1"
  curl -sS -X POST "${BASE}/api/v1/auth/login" $(json) \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\"}" \
    | jq -r '.access_token // .data.access_token // .token // empty'
}

if [[ -z "${USER_JWT:-}" ]]; then
  echo "== Login customer1 =="
  USER_JWT="$(login "customer1@example.com")"
  [[ -n "$USER_JWT" && "$USER_JWT" != "null" ]] || { echo "Login failed (is API up? seed run?)"; exit 1; }
fi
if [[ -z "${ADMIN_JWT:-}" ]]; then
  echo "== Login admin =="
  ADMIN_JWT="$(login "admin@plantrent.com")"
fi
if [[ -z "${VENDOR_JWT:-}" ]]; then
  echo "== Login vendor2 (Urban Jungle — order 1004/1005) =="
  VENDOR_JWT="$(login "vendor2@plantrent.com")"
fi

echo "== Health =="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "${BASE}/" || { echo "API not reachable at ${BASE}"; exit 1; }

resolve_order() {
  local num="$1"
  curl -sS "${BASE}/api/v1/orders/${num}" $(hdr "$USER_JWT") | jq -r '.id // .data.id // empty'
}

resolve_item() {
  local oid="$1"
  curl -sS "${BASE}/api/v1/orders/${oid}" $(hdr "$USER_JWT") \
    | jq -r '(.items[0].id // .data.items[0].id // empty)'
}

if [[ -z "${ORDER_ID:-}" ]]; then
  ORDER_ID="$(resolve_order "$ORDER_NUM")"
fi
if [[ -z "${ORDER_ITEM_ID:-}" && -n "${ORDER_ID:-}" ]]; then
  ORDER_ITEM_ID="$(resolve_item "$ORDER_ID")"
fi
PENALTY_ORDER_ID="$(resolve_order "$PENALTY_ORDER_NUM")"

echo "ORDER_ID=${ORDER_ID:-} ITEM_ID=${ORDER_ITEM_ID:-} PENALTY_ORDER_ID=${PENALTY_ORDER_ID:-}"

if [[ -n "$ADMIN_JWT" && "$ADMIN_JWT" != "null" ]]; then
  echo "== Admin: penalty sweep (dry run via notify=false) =="
  curl -sS -X POST "${BASE}/api/v1/internal/jobs/orders/penalty-sweep" $(hdr "$ADMIN_JWT") $(json) \
    -d '{"notify":false}' | jq -c '.' 2>/dev/null || head -c 400
  echo
  echo "== Admin: order complaints =="
  curl -sS "${BASE}/api/v1/admin/order-complaints?page=1&limit=3" $(hdr "$ADMIN_JWT") | jq -c '.' 2>/dev/null | head -c 500
  echo
fi

if [[ -n "$USER_JWT" && "$USER_JWT" != "null" ]]; then
  UJ="${USER_JWT}"
  if [[ -n "$PENALTY_ORDER_ID" && "$PENALTY_ORDER_ID" != "null" ]]; then
    echo "== Penalty GET (${PENALTY_ORDER_NUM}) =="
    curl -sS "${BASE}/api/v1/orders/${PENALTY_ORDER_ID}/penalty" $(hdr "$UJ") | jq -c '.'
    echo
    echo "== Penalty payment initiate =="
    PEN=$(curl -sS -X POST "${BASE}/api/v1/payments/initiate" $(hdr "$UJ") $(json) \
      -d "{\"payment_for\":\"PENALTY\",\"reference_id\":\"${PENALTY_ORDER_ID}\",\"payment_method\":\"CARD\"}")
    echo "$PEN" | jq -c '.'
    PG="$(echo "$PEN" | jq -r '.gateway_order_id // empty')"
    if [[ -n "$PG" && "$PG" != "null" ]]; then
      VID="pen-verify-$(date +%s)"
      echo "== Penalty verify (twice, same idempotency key) =="
      curl -sS -X POST "${BASE}/api/v1/payments/verify" $(hdr "$UJ") $(json) \
        -H "Idempotency-Key: ${VID}" \
        -d "{\"gateway_order_id\":\"${PG}\",\"gateway_payment_id\":\"mock1\",\"gateway_signature\":\"s\"}" | jq -c '.'
      curl -sS -X POST "${BASE}/api/v1/payments/verify" $(hdr "$UJ") $(json) \
        -H "Idempotency-Key: ${VID}" \
        -d "{\"gateway_order_id\":\"${PG}\",\"gateway_payment_id\":\"mock1\",\"gateway_signature\":\"s\"}" | jq -c '.'
      echo
      echo "== Penalty status after pay =="
      curl -sS "${BASE}/api/v1/orders/${PENALTY_ORDER_ID}/penalty" $(hdr "$UJ") | jq -c '.'
      echo
    fi
  fi

  if [[ -n "$ORDER_ID" && "$ORDER_ID" != "null" && -n "$ORDER_ITEM_ID" && "$ORDER_ITEM_ID" != "null" ]]; then
    NEW_END="$(date -u -v+14d +%Y-%m-%d 2>/dev/null || date -u -d '+14 days' +%Y-%m-%d)"
    echo "== Extend rental (${ORDER_NUM}) → ${NEW_END} =="
    EXT=$(curl -sS -X POST "${BASE}/api/v1/orders/${ORDER_ID}/items/${ORDER_ITEM_ID}/extend-rental" \
      $(hdr "$UJ") $(json) -d "{\"new_end_date\":\"${NEW_END}\"}")
    echo "$EXT" | jq -c '.' 2>/dev/null || echo "$EXT"
    EXT_ID="$(echo "$EXT" | jq -r '.rental_extension_id // .extension.id // empty')"
    if [[ -n "$EXT_ID" && "$EXT_ID" != "null" ]]; then
      IDEM="ext-init-$(date +%s)"
      echo "== Extension payment initiate (idempotent) =="
      PAY1=$(curl -sS -X POST "${BASE}/api/v1/payments/initiate" $(hdr "$UJ") $(json) \
        -H "Idempotency-Key: ${IDEM}" \
        -d "{\"payment_for\":\"RENTAL_EXTENSION\",\"reference_id\":\"${EXT_ID}\",\"payment_method\":\"CARD\"}")
      echo "$PAY1" | jq -c '.'
      PAY2=$(curl -sS -X POST "${BASE}/api/v1/payments/initiate" $(hdr "$UJ") $(json) \
        -H "Idempotency-Key: ${IDEM}" \
        -d "{\"payment_for\":\"RENTAL_EXTENSION\",\"reference_id\":\"${EXT_ID}\",\"payment_method\":\"CARD\"}")
      echo "replay: $(echo "$PAY2" | jq -c '{gateway_order_id,reused}')"
      GOID="$(echo "$PAY1" | jq -r '.gateway_order_id // empty')"
      if [[ -n "$GOID" && "$GOID" != "null" ]]; then
        curl -sS -X POST "${BASE}/api/v1/payments/verify" $(hdr "$UJ") $(json) \
          -d "{\"gateway_order_id\":\"${GOID}\",\"gateway_payment_id\":\"mock_ext\",\"gateway_signature\":\"s\"}" | jq -c '.'
        echo
      fi
    fi

    echo "== Complaint on ${ORDER_NUM} =="
    curl -sS -X POST "${BASE}/api/v1/orders/${ORDER_ID}/complaints" $(hdr "$UJ") $(json) \
      -d '{"subject":"Plant condition","description":"Leaves drooping after delivery."}' | jq -c '.'
    echo
    curl -sS "${BASE}/api/v1/orders/my-complaints?limit=3" $(hdr "$UJ") | jq -c '.pagination, (.items|length)'
    echo
  fi
fi

if [[ -n "${VENDOR_JWT:-}" && "$VENDOR_JWT" != "null" ]]; then
  echo "== Vendor OVERDUE bucket =="
  curl -sS "${BASE}/api/v1/vendor/rentals?bucket=OVERDUE&limit=2" $(hdr "$VENDOR_JWT") | jq -c '.counts // .'
  echo
  echo "== Vendor complaints =="
  curl -sS "${BASE}/api/v1/orders/vendor/complaints?limit=3" $(hdr "$VENDOR_JWT") | jq -c '.pagination // .'
  echo
fi

echo "✅ Flow script finished."
