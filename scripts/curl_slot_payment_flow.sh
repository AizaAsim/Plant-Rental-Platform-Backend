#!/usr/bin/env bash
# Full slot → initiate → verify payment flow using only curl + Python 3 JSON.
# Prerequisites: seeded users (customer1 / vendor1) and Nest running.
#
# Usage:
#   ./scripts/curl_slot_payment_flow.sh
#   API_BASE=http://127.0.0.1:3002 CUSTOMER_EMAIL=... VENDOR_EMAIL=... ./scripts/curl_slot_payment_flow.sh
#
set -euo pipefail

BASE="${API_BASE:-http://127.0.0.1:${APP_PORT:-3002}}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-customer1@example.com}"
CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-Password123!}"
VENDOR_EMAIL="${VENDOR_EMAIL:-vendor1@plantrent.com}"
VENDOR_PASSWORD="${VENDOR_PASSWORD:-Password123!}"

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

have_py3() {
  command -v python3 >/dev/null 2>&1 || die "python3 is required to parse JSON responses"
}

login_token() {
  local email="$1" password="$2"
  curl -sS -X POST "$BASE/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" |
    python3 -c 'import sys,json; j=json.load(sys.stdin); print(j.get("access_token") or "")' ||
    echo ""
}

echo "== Slot + payment curl flow =="
echo "   BASE=$BASE"
have_py3

for _attempt in $(seq 1 25); do
  if curl -sS --connect-timeout 2 -m 3 "$BASE/api/v1/plants?limit=1" | grep -q '"items"'; then
    break
  fi
  if [[ $_attempt -eq 25 ]]; then die "API not reachable at $BASE (start Nest first)."; fi
  sleep 1
done

CJ="$(login_token "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD")"
VJ="$(login_token "$VENDOR_EMAIL" "$VENDOR_PASSWORD")"
[[ -n "$CJ" ]] || die "Customer login failed (wrong BASE or credentials)."
[[ -n "$VJ" ]] || die "Vendor login failed (wrong BASE or credentials)."

H_CUST=(-H "Authorization: Bearer $CJ" -H "Content-Type: application/json")
H_VEND=(-H "Authorization: Bearer $VJ" -H "Content-Type: application/json")

echo "== 1. Nursery id + BUY plant (public catalog filter = same rules as cart add) =="
NUR_JSON="$(curl -sS "$BASE/api/v1/nurseries/my-nursery" "${H_VEND[@]}")"
NID="$(echo "$NUR_JSON" | python3 -c '
import sys, json
r = json.load(sys.stdin)
nid = r.get("id")
if not nid:
    sys.stderr.write(r.get("message") or json.dumps(r)[:400])
    sys.exit(1)
print(nid)
')" || die "Vendor has no nursery (complete onboarding)"

PP_JSON="$(curl -sS -G "$BASE/api/v1/plants" --data-urlencode "nurseryId=${NID}" \
  --data-urlencode "limit=5" --data-urlencode "page=1" --data-urlencode "available_for=BUY" "${H_CUST[@]}")"
PLANT_ID="$(echo "$PP_JSON" | python3 -c '
import sys, json
r = json.load(sys.stdin)
items = r.get("items") or []
if not items:
    sys.stderr.write(r.get("message") or "no BUY plants in stock for this nursery\\n"); sys.exit(1)
print(items[0]["id"])
')" || die "Could not resolve a sale plant for cart"

echo "    nursery_id=$NID plant_id=$PLANT_ID"

echo "== 2. Delivery address id =="
ADDR_JSON="$(curl -sS "$BASE/api/v1/users/addresses" "${H_CUST[@]}")"
AID="$(echo "$ADDR_JSON" | python3 -c '
import sys, json
addrs = json.load(sys.stdin)
if isinstance(addrs, list) and addrs:
    print(addrs[0]["id"]); sys.exit(0)
if isinstance(addrs, dict) and "message" in addrs:
    sys.stderr.write(addrs["message"])
sys.exit(1)
')" || AID=""
if [[ -z "$AID" ]]; then
  echo "    (creating address)"
  curl -sS -X POST "$BASE/api/v1/users/addresses" "${H_CUST[@]}" \
    -d '{
      "label":"curl-home",
      "address_line1":"123 Test Street Karachi",
      "city":"Karachi",
      "state":"Sindh",
      "pincode":"75500",
      "is_default":true
    }' | python3 -c 'import sys,json; print(json.dumps(json.load(sys.stdin)))' >/dev/null
  ADDR_JSON="$(curl -sS "$BASE/api/v1/users/addresses" "${H_CUST[@]}")"
  AID="$(echo "$ADDR_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')"
fi
echo "    address_id=$AID"

echo "== 3. Clear cart + add BUY line + checkout =="
curl -sS -X DELETE "$BASE/api/v1/cart" "${H_CUST[@]}" >/dev/null 2>&1 || true

ADD_RAW="$(curl -sS -w "\nHTTP:%{http_code}" -X POST "$BASE/api/v1/cart/items" "${H_CUST[@]}" \
  -d "{\"plant_id\":\"$PLANT_ID\",\"quantity\":1,\"order_type\":\"BUY\"}")"
ADD_CODE="$(echo "$ADD_RAW" | tail -n1 | sed 's/HTTP://')"
ADD_BODY="$(echo "$ADD_RAW" | sed '$d')"
[[ "$ADD_CODE" =~ ^200$ ]] || die "cart add failed HTTP $ADD_CODE: $(echo "$ADD_BODY" | head -c 400)"

CART_CHK="$(curl -sS "$BASE/api/v1/cart" "${H_CUST[@]}")"
NITEMS="$(echo "$CART_CHK" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
print(len(d.get("items") or []))
')" || die "cart GET invalid JSON"
[[ "$NITEMS" != "0" ]] || die "cart still empty after add: $(echo "$ADD_BODY" | head -c 300)"

CO_JSON="$(curl -sS -X POST "$BASE/api/v1/orders/checkout" "${H_CUST[@]}" \
  -d "{\"delivery_address_id\":\"$AID\",\"payment_method\":\"ONLINE\",\"notes\":\"curl_slot_pay\"}")"

OID="$(echo "$CO_JSON" | python3 -c '
import sys, json
try:
    r = json.load(sys.stdin)
except Exception:
    sys.exit(2)
orders = r.get("orders") or []
if not orders:
    sys.stderr.write(r.get("message") or json.dumps(r))
    sys.exit(1)
print(orders[0]["id"])
')" || die "checkout failed $(echo "$CO_JSON" | head -c 400)"
echo "    order_id=$OID"

echo "== 4. Vendor set CONFIRMED =="
ST_RAW="$(curl -sS -w "\nHTTP:%{http_code}" -X PUT "$BASE/api/v1/orders/vendor/orders/$OID/status" "${H_VEND[@]}" \
  -d '{"status":"CONFIRMED"}')"
STC="$(echo "$ST_RAW" | tail -n1 | sed 's/HTTP://')"
STB="$(echo "$ST_RAW" | sed '$d')"
[[ "$STC" =~ ^200$ ]] || die "vendor CONFIRM failed HTTP $STC: $(echo "$STB" | head -c 400)"
echo "    ok HTTP $STC"

echo "== 5. Vendor propose delivery slots =="
PROP_JSON="$(curl -sS -X POST "$BASE/api/v1/orders/$OID/propose-delivery-slots" "${H_VEND[@]}" \
  -d '{"delivery_slots":[{"date":"2026-08-01","time_from":"10:00","time_to":"12:00"}],"slot_ttl_hours":48,"note":"curl"}')"
SLOT_ID="$(echo "$PROP_JSON" | python3 -c '
import sys,json
r=json.load(sys.stdin)
data=r.get("data") or {}
slots=data.get("proposed_slots") or []
if not slots:
    err=r.get("error")
    sys.stderr.write((err["message"] if isinstance(err, dict) else str(err or r.get("message") or json.dumps(r)[:500])) + chr(10))
    sys.exit(1)
print(slots[0]["id"])
')" || die "propose-slots failed: $(echo "$PROP_JSON" | head -c 500)"

echo "    selected_slot_id=$SLOT_ID"

echo "== 6. Customer confirm slot (SLOT_CONFIRMED + payment window) =="
CDF_JSON="$(curl -sS -X POST "$BASE/api/v1/orders/$OID/customer-delivery-response" "${H_CUST[@]}" \
  -d "{\"action\":\"CONFIRM\",\"selected_slot_id\":\"$SLOT_ID\"}")"
echo "$CDF_JSON" | python3 -c '
import sys,json
r=json.load(sys.stdin)
assert r.get("success") is True, r
d=r.get("data") or {}
print("    api status:", d.get("order_status"))
print("    awaits_payment:", d.get("awaits_payment"))
'

echo "== 7. Initiate ORDER payment =="
INI_JSON="$(curl -sS -X POST "$BASE/api/v1/payments/initiate" "${H_CUST[@]}" \
  -d "{\"payment_for\":\"ORDER\",\"reference_id\":\"$OID\",\"payment_method\":\"card\"}")"
GID="$(echo "$INI_JSON" | python3 -c '
import sys,json
r=json.load(sys.stdin)
g=r.get("gateway_order_id")
if not g:
    sys.stderr.write(r.get("message") or json.dumps(r))
    sys.exit(1)
print(g)
')" || die "initiate failed: $(echo "$INI_JSON" | head -c 500)"

echo "    gateway_order_id=$GID"

echo "== 8. Verify payment =="
VER_JSON="$(curl -sS -X POST "$BASE/api/v1/payments/verify" "${H_CUST[@]}" \
  -d "{\"gateway_order_id\":\"$GID\",\"gateway_payment_id\":\"mock_gp_flow\",\"gateway_signature\":\"x\"}")"
echo "$VER_JSON" | python3 -c 'import sys,json; print("   ", json.load(sys.stdin))'

echo "== 9. Final order snapshot =="
curl -sS "$BASE/api/v1/orders/$OID" "${H_CUST[@]}" | python3 -c '
import sys,json
r=json.load(sys.stdin)
print("    status=", r.get("status"), " paymentStatus=", r.get("paymentStatus"), " total=", r.get("totalAmount"))
'

echo ""
echo "== Done. Order $OID reached PAID + CONFIRMED if steps succeeded. =="
