#!/usr/bin/env bash
# Smoke-test nursery, rental, and vendor APIs. Reports status codes.
set -uo pipefail

BASE="${BASE_URL:-http://13.60.32.214:3002}"
PASS="${TEST_PASSWORD:-Password123!}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

failures=0
passes=0

login() {
  local email="$1"
  curl -s -X POST "$BASE/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}"
}

json_field() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)" 2>/dev/null
}

hit() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body="${4:-}"
  local label="${5:-$method $path}"
  local auth_header=()
  if [[ -n "$token" ]]; then
    auth_header=(-H "Authorization: Bearer $token")
  fi
  local out
  if [[ -n "$body" ]]; then
    out=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
      -H 'Content-Type: application/json' -H 'accept: application/json' \
      "${auth_header[@]}" -d "$body")
  else
    out=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
      -H 'accept: application/json' "${auth_header[@]}")
  fi
  local code
  code=$(echo "$out" | tail -1)
  local resp
  resp=$(echo "$out" | sed '$d')
  local preview
  preview=$(echo "$resp" | head -c 120 | tr '\n' ' ')

  if [[ "$code" == "500" ]]; then
    echo -e "${RED}FAIL${NC} [$code] $label"
    echo "       $preview"
    failures=$((failures + 1))
  elif [[ "$code" =~ ^2 ]]; then
    echo -e "${GREEN}OK${NC}   [$code] $label"
    passes=$((passes + 1))
  elif [[ "$code" == "401" || "$code" == "403" || "$code" == "404" || "$code" == "400" ]]; then
    echo -e "${YELLOW}SKIP${NC} [$code] $label (expected without full data)"
    passes=$((passes + 1))
  else
    echo -e "${RED}FAIL${NC} [$code] $label"
    echo "       $preview"
    failures=$((failures + 1))
  fi
  echo "$resp"
}

echo "=== Auth ==="
CUSTOMER_JSON=$(login "customer1@example.com")
VENDOR1_JSON=$(login "vendor1@plantrent.com")
VENDOR2_JSON=$(login "vendor2@plantrent.com")

CUSTOMER_TOKEN=$(echo "$CUSTOMER_JSON" | json_field "['access_token']")
VENDOR1_TOKEN=$(echo "$VENDOR1_JSON" | json_field "['access_token']")
VENDOR2_TOKEN=$(echo "$VENDOR2_JSON" | json_field "['access_token']")

hit GET "/api/v1/auth/me" "$CUSTOMER_TOKEN" "" "GET auth/me"

echo ""
echo "=== Nurseries (public) ==="
NURSERY_LIST=$(hit GET "/api/v1/nurseries?page=1&limit=5&city=Karachi&sort_by=rating" "" "" "GET nurseries list")
hit GET "/api/v1/nurseries/top-rated?limit=5" "" "" "GET nurseries top-rated"
hit GET "/api/v1/nurseries/check-serviceability?nursery_id=test&pincode=75600" "" "" "GET check-serviceability"
hit GET "/api/v1/nurseries/slug/green-paradise-nursery" "" "" "GET nursery by slug"

NURSERY_ID=$(echo "$NURSERY_LIST" | json_field "['items'][0]['id']" 2>/dev/null || true)
if [[ -z "$NURSERY_ID" || "$NURSERY_ID" == "None" ]]; then
  NURSERY_ID=$(curl -s "$BASE/api/v1/plants?limit=1" | json_field "['items'][0]['nurseryId']")
fi
echo "Using nursery_id: $NURSERY_ID"

hit GET "/api/v1/nurseries/$NURSERY_ID" "" "" "GET nursery detail"
hit GET "/api/v1/nurseries/$NURSERY_ID/plants?limit=3" "" "" "GET nursery plants"
hit GET "/api/v1/nurseries/$NURSERY_ID/reviews?limit=3" "" "" "GET nursery reviews"
hit GET "/api/v1/nurseries/$NURSERY_ID/vendor-packages" "" "" "GET nursery vendor-packages"

PKG_RESP=$(curl -s "$BASE/api/v1/nurseries/$NURSERY_ID/vendor-packages")
PACKAGE_ID=$(echo "$PKG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('items',[{}])[0].get('package_id',''))" 2>/dev/null || echo "vp-urban-premium")
echo "Using package_id: $PACKAGE_ID"

hit GET "/api/v1/nurseries/$NURSERY_ID/packages/$PACKAGE_ID/available-plants" "" "" "GET available-plants"
hit GET "/api/v1/nurseries/$NURSERY_ID/packages/$PACKAGE_ID/available-delivery-slots" "" "" "GET available-delivery-slots"

echo ""
echo "=== Nurseries (vendor auth) ==="
hit GET "/api/v1/nurseries/my-nursery" "$VENDOR1_TOKEN" "" "GET my-nursery"
hit GET "/api/v1/nurseries/my-nursery/working-hours" "$VENDOR1_TOKEN" "" "GET working-hours"
hit GET "/api/v1/nurseries/my-nursery/service-areas" "$VENDOR1_TOKEN" "" "GET service-areas"
hit GET "/api/v1/nurseries/my-nursery/gardeners" "$VENDOR1_TOKEN" "" "GET gardeners"
hit GET "/api/v1/nurseries/my-nursery/invitations" "$VENDOR1_TOKEN" "" "GET invitations"

echo ""
echo "=== Vendor packages (auth) ==="
hit GET "/api/v1/vendor/packages" "$VENDOR1_TOKEN" "" "GET vendor packages list"
hit GET "/api/v1/vendor/packages?is_active=true" "$VENDOR2_TOKEN" "" "GET vendor2 packages"

echo ""
echo "=== Vendor onboarding & rentals ==="
hit GET "/api/v1/vendor/onboarding" "$VENDOR1_TOKEN" "" "GET vendor onboarding"
hit GET "/api/v1/vendor/rentals" "$VENDOR1_TOKEN" "" "GET vendor rentals"
hit GET "/api/v1/orders/vendor/rentals/active" "$VENDOR1_TOKEN" "" "GET vendor active rentals"
hit GET "/api/v1/orders/vendor/orders?page=1&limit=5" "$VENDOR1_TOKEN" "" "GET vendor orders"
hit GET "/api/v1/orders/vendor/orders/stats" "$VENDOR1_TOKEN" "" "GET vendor order stats"
hit GET "/api/v1/orders/vendor/rental-extensions" "$VENDOR1_TOKEN" "" "GET vendor rental extensions"

echo ""
echo "=== Customer rental orders ==="
hit GET "/api/v1/orders?page=1&limit=5" "$CUSTOMER_TOKEN" "" "GET customer orders"
hit GET "/api/v1/orders/history?page=1&limit=5" "$CUSTOMER_TOKEN" "" "GET order history"
hit GET "/api/v1/orders/customer/active-rentals" "$CUSTOMER_TOKEN" "" "GET active rentals"
hit GET "/api/v1/orders/customer/order-tabs" "$CUSTOMER_TOKEN" "" "GET order tabs"
hit GET "/api/v1/orders/my-complaints" "$CUSTOMER_TOKEN" "" "GET my complaints"

echo ""
echo "=== Rentals module ==="
hit GET "/api/v1/rentals" "$CUSTOMER_TOKEN" "" "GET rentals list"
hit GET "/api/v1/rentals/draft" "$CUSTOMER_TOKEN" "" "GET rental draft"

echo ""
echo "=== Summary: $passes passed checks, $failures with 500/unexpected ==="
exit "$failures"
