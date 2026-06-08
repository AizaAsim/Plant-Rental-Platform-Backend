#!/usr/bin/env python3
"""
Authenticated rental workflow E2E:
  vendor package → inventory plant → public catalogue → rental booking →
  approve → pay → process → deliver → pickup request → assign → complete

Usage:
  API_BASE=https://your-api.example.com python3 scripts/rental_workflow_e2e.py

Seed accounts (after `npx prisma db seed`):
  customer: customer1@example.com / Password123!
  vendor:   vendor1@plantrent.com / Password123!
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from datetime import date, timedelta
from typing import Any, Optional

BASE = os.environ.get("API_BASE", "http://localhost:3002").rstrip("/")
PASSWORD = os.environ.get("SEED_PASSWORD", "Password123!")
CUSTOMER_EMAIL = os.environ.get("E2E_CUSTOMER_EMAIL", "customer1@example.com")
VENDOR_EMAIL = os.environ.get("E2E_VENDOR_EMAIL", "vendor1@plantrent.com")

# 1×1 PNG
_MINI_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


def curl(
    method: str,
    path: str,
    *,
    token: Optional[str] = None,
    body: Any = None,
    multipart: Optional[list[str]] = None,
) -> tuple[int, Any]:
    url = f"{BASE}{path}"
    cmd = ["curl", "-sS", "-w", "\n%{http_code}", "-X", method, url]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    if multipart:
        cmd += multipart
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    out = (p.stdout or "").strip()
    if "\n" not in out:
        return 0, out or p.stderr
    text, _, code_s = out.rpartition("\n")
    try:
        code = int(code_s)
    except ValueError:
        return 0, out
    try:
        return code, json.loads(text) if text else {}
    except json.JSONDecodeError:
        return code, text


def login(email: str) -> str:
    code, data = curl("POST", "/api/v1/auth/login", body={"email": email, "password": PASSWORD})
    if code != 200:
        raise RuntimeError(f"Login failed for {email}: {code} {data}")
    token = data.get("access_token") or data.get("data", {}).get("access_token")
    if not token:
        raise RuntimeError(f"No access_token in login response: {data}")
    return token


def ok(step: str, code: int, data: Any, expect=(200, 201)) -> Any:
    if code not in expect:
        raise RuntimeError(f"[FAIL] {step}: HTTP {code} — {data}")
    print(f"[OK] {step} ({code})")
    return data


def unwrap(data: Any) -> Any:
    if isinstance(data, dict) and data.get("success") is True and "data" in data:
        return data["data"]
    return data


def main() -> int:
    print(f"API_BASE={BASE}")
    customer = login(CUSTOMER_EMAIL)
    vendor = login(VENDOR_EMAIL)

    # Vendor nursery
    code, nursery_raw = curl("GET", "/api/v1/nurseries/my-nursery", token=vendor)
    nursery = ok("vendor my-nursery", code, nursery_raw)
    nursery_id = nursery["id"]
    print(f"  nursery_id={nursery_id} slug={nursery.get('slug')}")

    # Inventory plant (multipart)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(_MINI_PNG)
        png = f.name
    code, plant_raw = curl(
        "POST",
        "/api/v1/plants/vendor/plants/inventory",
        token=vendor,
        multipart=[
            "-F",
            "name=E2E Test Plant",
            "-F",
            "stock_quantity=10",
            "-F",
            f"image=@{png}",
        ],
    )
    plant = ok("create inventory plant", code, plant_raw, (201,))
    plant_id = plant.get("plant_id") or plant.get("id")
    print(f"  plant_id={plant_id}")

    # Vendor package
    pkg_body = {
        "name": "E2E Office Package",
        "tier": "STANDARD",
        "max_plant_count": 2,
        "rental_duration_days": 30,
        "includes_maintenance": True,
        "maintenance_visits_per_month": 1,
        "base_price": 4999,
        "deposit_amount": 500,
        "plants": [{"plant_id": plant_id, "quantity": 1}],
    }
    code, pkg_raw = curl("POST", "/api/v1/vendor/packages", token=vendor, body=pkg_body)
    pkg = unwrap(ok("create vendor package", code, pkg_raw, (201,)))
    package_id = pkg.get("package_id") or pkg.get("publicId")
    print(f"  package_id={package_id}")

    # Public catalogue (by id and slug)
    code, cat_raw = curl("GET", f"/api/v1/nurseries/{nursery_id}/vendor-packages")
    cat = unwrap(ok("public vendor-packages by id", code, cat_raw))
    items = cat.get("items") or []
    if not items:
        print("[WARN] catalogue empty — check in-stock plants on package")

    slug = nursery.get("slug")
    if slug:
        code, cat2_raw = curl("GET", f"/api/v1/nurseries/{slug}/vendor-packages")
        ok("public vendor-packages by slug", code, cat2_raw)

    code, avail_raw = curl(
        "GET",
        f"/api/v1/nurseries/{nursery_id}/packages/{package_id}/available-plants",
    )
    avail = unwrap(ok("available-plants", code, avail_raw))
    print(f"  selectable_plants={len(avail.get('plants') or [])}")

    # Customer address
    code, addr_raw = curl("GET", "/api/v1/users/addresses", token=customer)
    addrs = ok("customer addresses", code, addr_raw).get("items") or ok("customer addresses", code, addr_raw)
    if isinstance(addrs, dict):
        addrs = addrs.get("items", [])
    if not addrs:
        code, addr_create = curl(
            "POST",
            "/api/v1/users/addresses",
            token=customer,
            body={
                "label": "Home",
                "address_line1": "123 Test St",
                "city": "Karachi",
                "state": "Sindh",
                "pincode": "75600",
                "is_default": True,
            },
        )
        addr = ok("create address", code, addr_create, (200, 201))
        address_id = addr.get("id") or (addr.get("data") or {}).get("id")
    else:
        address_id = addrs[0]["id"]
    print(f"  address_id={address_id}")

    # Rental booking
    delivery = (date.today() + timedelta(days=7)).isoformat()
    booking_body = {
        "nursery_id": nursery_id,
        "package_id": package_id,
        "delivery_address_id": address_id,
        "selected_plants": [{"plant_id": plant_id, "quantity": 1}],
        "preferred_delivery_date": delivery,
        "preferred_time_slot": "09:00-12:00",
        "add_ons": {"premium_pot": True},
    }
    code, order_raw = curl(
        "POST", "/api/v1/orders/checkout/rental-booking", token=customer, body=booking_body
    )
    order = ok("rental booking", code, order_raw, (201,))
    order_id = order.get("order_id") or order.get("id")
    print(f"  order_id={order_id}")

    # Approve
    code, items_raw = curl("GET", f"/api/v1/orders/vendor/orders/{order_id}", token=vendor)
    detail = ok("vendor order detail", code, items_raw)
    lines = detail.get("items") or []
    selections = [{"order_item_id": li["id"], "plant_id": li["plantId"]} for li in lines]
    code, appr_raw = curl(
        "PUT",
        f"/api/v1/orders/vendor/orders/{order_id}/approve",
        token=vendor,
        body={"plant_selections": selections},
    )
    ok("vendor approve", code, appr_raw)

    # Pay
    code, pay_init = curl(
        "POST",
        "/api/v1/payments/initiate",
        token=customer,
        body={
            "payment_for": "ORDER",
            "reference_id": order_id,
            "payment_method": "CARD",
        },
    )
    init = ok("payment initiate", code, pay_init, (200, 201))
    gw_order = init.get("gateway_order_id")
    code, pay_ver = curl(
        "POST",
        "/api/v1/payments/verify",
        token=customer,
        body={
            "gateway_order_id": gw_order,
            "gateway_payment_id": "e2e_mock_payment",
            "gateway_signature": "mock_sig",
        },
    )
    ok("payment verify", code, pay_ver)

    # Process + deliver
    ok("vendor process", *curl("POST", f"/api/v1/orders/vendor/orders/{order_id}/process", token=vendor))
    ok(
        "complete delivery",
        *curl(
            "POST",
            f"/api/v1/orders/vendor/orders/{order_id}/complete-delivery",
            token=vendor,
            body={},
        ),
    )

    line_id = lines[0]["id"] if lines else None
    if line_id:
        ok(
            "pickup request",
            *curl(
                "POST",
                f"/api/v1/orders/{order_id}/pickup-request",
                token=customer,
                body={
                    "order_item_id": line_id,
                    "requested_pickup_date": (date.today() + timedelta(days=30)).isoformat(),
                    "preferred_time_from": "09:00",
                    "preferred_time_to": "17:00",
                },
            ),
        )

        gardeners = nursery.get("gardeners") or []
        g_id = gardeners[0]["id"] if gardeners else None
        if g_id:
            ok(
                "assign pickup",
                *curl(
                    "POST",
                    f"/api/v1/orders/vendor/orders/{order_id}/assign-pickup",
                    token=vendor,
                    body={
                        "assigned_gardener_ids": [g_id],
                        "pickup_date": (date.today() + timedelta(days=31)).isoformat(),
                        "time_from": "10:00",
                        "time_to": "12:00",
                    },
                ),
            )
            ok(
                "complete pickup",
                *curl(
                    "POST",
                    f"/api/v1/orders/vendor/orders/{order_id}/complete-pickup",
                    token=vendor,
                    body={
                        "collection_date": (date.today() + timedelta(days=31)).isoformat(),
                        "items": [
                            {
                                "order_item_id": line_id,
                                "condition": "GOOD",
                                "restock_inventory": True,
                            }
                        ],
                    },
                ),
            )

    print("\n=== E2E rental workflow completed successfully ===")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n[E2E FAILED] {e}", file=sys.stderr)
        sys.exit(1)
