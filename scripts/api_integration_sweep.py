#!/usr/bin/env python3
"""
Hit all app HTTP routes against a running API (default http://localhost:3002).
Usage: API_BASE=http://localhost:3002 python3 scripts/api_integration_sweep.py
"""
from __future__ import annotations

import base64
import json
import os
import random
import re
import subprocess
import tempfile
import time
from typing import Any, Optional

BASE = os.environ.get("API_BASE", "http://localhost:3002").rstrip("/")
SEED_PASSWORD = "Password123!"

results: list[tuple[str, str, str, int, str, str]] = []


def log(
    name: str,
    method: str,
    path: str,
    status: int,
    outcome: str,
    detail: str = "",
) -> None:
    results.append((name, method, path, status, outcome, detail[:500]))


def curl_raw(
    method: str,
    path: str,
    *,
    token: Optional[str] = None,
    json_body: Any = None,
    form_file_field: Optional[tuple[str, str]] = None,
    extra_headers: Optional[list[str]] = None,
) -> tuple[int, str]:
    url = f"{BASE}{path}" if path.startswith("/") else f"{BASE}/{path}"
    cmd = ["curl", "-sS", "-w", "\n%{http_code}", "-X", method, url]
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])
    if extra_headers:
        for i in range(0, len(extra_headers), 2):
            cmd.extend(["-H", f"{extra_headers[i]}: {extra_headers[i + 1]}"])
    if json_body is not None:
        cmd.extend(["-H", "Content-Type: application/json", "-d", json.dumps(json_body)])
    if form_file_field:
        field, fpath = form_file_field
        cmd.extend(["-F", f"{field}=@{fpath}"])
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    out = (p.stdout or "").strip()
    if "\n" not in out and p.returncode != 0:
        return 0, (p.stderr or str(p.returncode))[:800]
    if "\n" not in out:
        return 0, out[:800]
    body, _, code = out.rpartition("\n")
    try:
        sc = int(code)
    except ValueError:
        sc = 0
    return sc, body


def jparse(s: str) -> Any:
    try:
        return json.loads(s)
    except Exception:
        return None


def run(
    name: str,
    method: str,
    path: str,
    *,
    token: Optional[str] = None,
    json_body: Any = None,
    form_file_field: Optional[tuple[str, str]] = None,
    ok: tuple[int, ...] = (200, 201, 204),
    allow: Optional[tuple[int, ...]] = None,
) -> tuple[int, str]:
    sc, body = curl_raw(
        method,
        path,
        token=token,
        json_body=json_body,
        form_file_field=form_file_field,
    )
    allowed = set(ok)
    if allow:
        allowed |= set(allow)
    if sc in allowed:
        log(name, method, path, sc, "PASS", "")
    else:
        snippet = body.replace("\n", " ")[:240]
        log(name, method, path, sc, "FAIL", snippet)
    return sc, body


def login(email: str, password: str = SEED_PASSWORD) -> Optional[str]:
    sc, body = curl_raw(
        "POST",
        "/api/v1/auth/login",
        json_body={"email": email, "password": password},
    )
    data = jparse(body)
    tok = data.get("access_token") if isinstance(data, dict) else None
    log(f"login {email}", "POST", "/api/v1/auth/login", sc, "PASS" if sc == 200 and tok else "FAIL", body[:200])
    return tok if isinstance(tok, str) else None


def register(role: str, suffix: str) -> tuple[Optional[str], Optional[str]]:
    email = f"apitest_{role.lower()}_{suffix}@test.com"
    # E.164: +[1-9]… up to 15 digits (RegisterDto phone regex)
    digits = f"{random.randint(100000000, 999999999)}{suffix[-2:]}"[:10]
    phone = f"+1{digits}"
    body = {
        "email": email,
        "password": "TestPass1!",
        "full_name": f"API {role}",
        "phone": phone,
        "role": role,
    }
    sc, raw = curl_raw("POST", "/api/v1/auth/register", json_body=body)
    data = jparse(raw)
    tok = data.get("access_token") if isinstance(data, dict) else None
    uid = (data.get("user") or {}).get("id") if isinstance(data, dict) else None
    log(
        f"register {role}",
        "POST",
        "/api/v1/auth/register",
        sc,
        "PASS" if sc == 201 and tok else "FAIL",
        raw[:200],
    )
    return (tok if isinstance(tok, str) else None), (uid if isinstance(uid, str) else None)


def main() -> None:
    ts = str(int(time.time()))
    suffix = ts[-10:]

    # --- Auth: register USER / VENDOR / ADMIN (may fail if policy changes) ---
    tok_user_new, uid_new = register("USER", suffix)
    tok_vendor_new, _ = register("VENDOR", suffix + "v")
    tok_admin_new, _ = register("ADMIN", suffix + "a")

    tok_customer = login("customer1@example.com")
    tok_vendor = login("vendor1@plantrent.com")
    tok_admin = login("admin@plantrent.com")

    tok_user = tok_user_new or tok_customer
    if not tok_user:
        print("No user token; aborting.")
        return

    # --- Auth extras ---
    sc_me, body_me = run("auth me", "GET", "/api/v1/auth/me", token=tok_user)
    data_me = jparse(body_me)
    refresh = None
    if isinstance(data_me, dict):
        pass
    # refresh from login response — re-login to capture refresh
    sc_l, b_l = curl_raw(
        "POST",
        "/api/v1/auth/login",
        json_body={"email": "customer1@example.com", "password": SEED_PASSWORD},
    )
    login_obj = jparse(b_l)
    if isinstance(login_obj, dict):
        refresh = login_obj.get("refresh_token")
    if refresh:
        run(
            "auth refresh-token",
            "POST",
            "/api/v1/auth/refresh-token",
            json_body={"refresh_token": refresh},
        )
    run("auth sessions", "GET", "/api/v1/auth/sessions", token=tok_user)
    run(
        "auth forgot-password",
        "POST",
        "/api/v1/auth/forgot-password",
        json_body={"email": "customer1@example.com"},
        ok=(200, 201),
        allow=(400, 404, 429),
    )

    # --- Plants (public) ---
    sc_pl, plants_body = run("plants list", "GET", "/api/v1/plants?limit=3")
    plant_id = None
    nursery_id = None
    cat_id = None
    pj = jparse(plants_body)
    if isinstance(pj, dict) and isinstance(pj.get("items"), list) and pj["items"]:
        first = pj["items"][0]
        plant_id = first.get("id")
        nursery_id = first.get("nurseryId") or (first.get("nursery") or {}).get("id")
    run("plants featured", "GET", "/api/v1/plants/featured?limit=2")
    run("plants trending", "GET", "/api/v1/plants/trending?limit=2")
    run("plants seasonal", "GET", "/api/v1/plants/seasonal?limit=2")
    run("plants categories", "GET", "/api/v1/plants/categories")
    cj = jparse(curl_raw("GET", "/api/v1/plants/categories", token=None)[1])
    if isinstance(cj, list) and cj:
        cat_id = cj[0].get("id")
    if cat_id:
        run("plants category by id", "GET", f"/api/v1/plants/categories/{cat_id}")
    if plant_id:
        run("plants by id", "GET", f"/api/v1/plants/{plant_id}")
        run("plants reviews", "GET", f"/api/v1/plants/{plant_id}/reviews")
        run("plants availability", "GET", f"/api/v1/plants/{plant_id}/availability")

    # --- Packages ---
    sc_pkg, pkg_body = run("packages all", "GET", "/api/v1/packages")
    package_id = None
    pkgj = jparse(pkg_body)
    if isinstance(pkgj, list) and pkgj:
        package_id = pkgj[0].get("id")
    if nursery_id:
        run("packages by nursery", "GET", f"/api/v1/packages/nursery/{nursery_id}")
    if package_id:
        run("packages by id", "GET", f"/api/v1/packages/{package_id}")
    run("packages custom list", "GET", "/api/v1/packages/custom", token=tok_user)

    # --- Nurseries public ---
    run("nurseries list", "GET", "/api/v1/nurseries")
    if nursery_id:
        run("nursery detail", "GET", f"/api/v1/nurseries/{nursery_id}")
        run("nursery plants", "GET", f"/api/v1/nurseries/{nursery_id}/plants")
        run("nursery reviews", "GET", f"/api/v1/nurseries/{nursery_id}/reviews")
    if nursery_id:
        run(
            "nurseries check-serviceability",
            "GET",
            f"/api/v1/nurseries/check-serviceability?nursery_id={nursery_id}&pincode=75500",
        )

    # --- Users (customer token) ---
    run("users profile", "GET", "/api/v1/users/profile", token=tok_user)
    run(
        "users profile put",
        "PUT",
        "/api/v1/users/profile",
        token=tok_user,
        json_body={"bio": "api test"},
        ok=(200,),
        allow=(400,),
    )
    addr_body = {
        "label": "Test",
        "address_line1": "123 Test Street Block A",
        "city": "Karachi",
        "state": "Sindh",
        "pincode": "75500",
        "is_default": True,
    }
    sc_addr, addr_raw = run(
        "users create address",
        "POST",
        "/api/v1/users/addresses",
        token=tok_user,
        json_body=addr_body,
        ok=(200, 201),
    )
    address_id = None
    ar = jparse(addr_raw)
    if isinstance(ar, dict):
        address_id = ar.get("id")
    run("users addresses list", "GET", "/api/v1/users/addresses", token=tok_user)
    if address_id:
        run(
            "users address by id",
            "GET",
            f"/api/v1/users/addresses/{address_id}",
            token=tok_user,
        )
        run(
            "users address put",
            "PUT",
            f"/api/v1/users/addresses/{address_id}",
            token=tok_user,
            json_body={**addr_body, "label": "Home2"},
            ok=(200,),
        )
    run("users wishlist", "GET", "/api/v1/users/wishlist", token=tok_user)
    if plant_id:
        run(
            "users wishlist add",
            "POST",
            f"/api/v1/users/wishlist/{plant_id}",
            token=tok_user,
            json_body={},
            ok=(200, 201),
            allow=(400, 409),
        )
    run("users notifications", "GET", "/api/v1/users/notifications", token=tok_user)
    run("users rented-plants", "GET", "/api/v1/users/rented-plants", token=tok_user)
    run("users order-history", "GET", "/api/v1/users/order-history", token=tok_user)
    run("users booking-history", "GET", "/api/v1/users/booking-history", token=tok_user)
    run("users notifications read-all", "PUT", "/api/v1/users/notifications/read-all", token=tok_user)

    # --- Cart ---
    run("cart get", "GET", "/api/v1/cart", token=tok_user)
    # clear then add
    run("cart clear", "DELETE", "/api/v1/cart", token=tok_user, ok=(200, 204))
    start = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 86400 * 2))
    end = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 86400 * 35))
    cart_item = None
    if plant_id:
        sc_ci, ci_raw = run(
            "cart add item",
            "POST",
            "/api/v1/cart/items",
            token=tok_user,
            json_body={
                "plant_id": plant_id,
                "quantity": 1,
                "order_type": "RENT",
                "rent_start_date": start,
                "rent_end_date": end,
            },
            ok=(200, 201),
            allow=(400,),
        )
        cio = jparse(ci_raw)
        if isinstance(cio, dict) and isinstance(cio.get("items"), list) and cio["items"]:
            cart_item = cio["items"][-1].get("id")
    run("cart validate", "POST", "/api/v1/cart/validate", token=tok_user, json_body={})
    if cart_item:
        run(
            "cart update item",
            "PUT",
            f"/api/v1/cart/items/{cart_item}",
            token=tok_user,
            json_body={"quantity": 1},
            ok=(200,),
            allow=(400,),
        )

    # --- Orders checkout ---
    order_id: Optional[str] = None
    item_id: Optional[str] = None
    if address_id and plant_id:
        sc_co, co_raw = run(
            "orders checkout",
            "POST",
            "/api/v1/orders/checkout",
            token=tok_user,
            json_body={
                "delivery_address_id": address_id,
                "payment_method": "COD",
                "notes": "api sweep",
            },
            ok=(200, 201),
            allow=(400,),
        )
        co = jparse(co_raw)
        if isinstance(co, dict):
            ords = co.get("orders")
            if isinstance(ords, list) and ords:
                order_id = ords[0].get("id")
                its = ords[0].get("items")
                if isinstance(its, list) and its:
                    item_id = its[0].get("id")
            elif co.get("id"):
                order_id = co.get("id")
        if isinstance(co, list) and co:
            order_id = co[0].get("id")
    run("orders list", "GET", "/api/v1/orders", token=tok_user)
    run("orders active-rentals", "GET", "/api/v1/orders/customer/active-rentals", token=tok_user)
    if order_id:
        run("orders by id", "GET", f"/api/v1/orders/{order_id}", token=tok_user)
        run("orders tracking", "GET", f"/api/v1/orders/{order_id}/tracking", token=tok_user)

    # --- Rentals ---
    run("rentals list", "GET", "/rentals", token=tok_user)
    run(
        "rentals availability",
        "POST",
        "/rentals/availability",
        token=tok_user,
        json_body={
            "plantId": plant_id or "00000000-0000-0000-0000-000000000000",
            "startDate": start,
            "endDate": end,
            "quantity": 1,
        },
        ok=(200,),
        allow=(400, 404),
    )
    run(
        "rentals create (expected redirect)",
        "POST",
        "/rentals",
        token=tok_user,
        json_body={},
        ok=(200, 201),
        allow=(400,),
    )

    # --- Vendor orders ---
    if tok_vendor:
        run("vendor orders list", "GET", "/api/v1/orders/vendor/orders", token=tok_vendor)
        run("vendor orders stats", "GET", "/api/v1/orders/vendor/orders/stats", token=tok_vendor)
        run("vendor active rentals", "GET", "/api/v1/orders/vendor/rentals/active", token=tok_vendor)
        if order_id:
            run(
                "vendor order detail",
                "GET",
                f"/api/v1/orders/vendor/orders/{order_id}",
                token=tok_vendor,
                ok=(200,),
                allow=(403, 404),
            )
            run(
                "vendor payment-status",
                "GET",
                f"/api/v1/orders/vendor/orders/{order_id}/payment-status",
                token=tok_vendor,
                ok=(200,),
                allow=(403, 404),
            )

    # --- Payments ---
    run("payments history", "GET", "/api/v1/payments/history", token=tok_user)
    run(
        "payments initiate",
        "POST",
        "/api/v1/payments/initiate",
        token=tok_user,
        json_body={"order_id": order_id or str(plant_id), "amount": 1},
        ok=(200, 201),
        allow=(400, 404),
    )
    run("payments webhook", "POST", "/api/v1/payments/webhook", json_body={}, ok=(200, 201), allow=(400, 401))

    # --- Bookings (user) ---
    run("bookings list", "GET", "/api/v1/bookings", token=tok_user)

    # --- Tasks / user tasks ---
    run("user tasks", "GET", "/api/v1/user/tasks", token=tok_user)
    if tok_vendor:
        run("vendor tasks list", "GET", "/api/v1/vendor/tasks", token=tok_vendor)

    # --- AI (public gets + authed posts with tiny png) ---
    png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tf.write(base64.b64decode(png_b64))
        tmp_path = tf.name
    try:
        run(
            "ai plant-doctor GET",
            "GET",
            "/api/v1/ai/plant-doctor",
            ok=(200,),
            allow=(502, 504),
        )
        run(
            "ai recommender health",
            "GET",
            "/api/v1/ai/recommender/health",
            ok=(200,),
            allow=(502, 504),
        )
        run(
            "ai recommender schema",
            "GET",
            "/api/v1/ai/recommender/schema",
            ok=(200,),
            allow=(502, 504),
        )
        run(
            "preferences recommendation upsert",
            "PUT",
            "/api/v1/preferences/recommendation",
            token=tok_user,
            json_body={
                "city": "Karachi",
                "light_pref": "medium",
                "water_pref": "low",
                "pet_friendly": True,
                "space": "small",
                "top_n": 2,
            },
            ok=(200, 201),
            allow=(400,),
        )
        sc_ai, ai_body = curl_raw(
            "POST",
            "/api/v1/ai/recommender/recommend",
            token=tok_user,
            json_body={},
        )
        log(
            "ai recommend",
            "POST",
            "/api/v1/ai/recommender/recommend",
            sc_ai,
            "PASS" if sc_ai in (200, 201) else "FAIL",
            ai_body[:200] if sc_ai not in (200, 201) else "",
        )
        if sc_ai in (200, 201):
            rj = jparse(ai_body)
            lid = rj.get("log_id") if isinstance(rj, dict) else None
            if lid is not None:
                run(
                    "ai feedback",
                    "POST",
                    f"/api/v1/ai/recommender/feedback/{lid}",
                    token=tok_user,
                    json_body={"selected_plant": "Snake Plant", "rating": 5},
                    ok=(200, 201),
                    allow=(400, 502),
                )
        sc_d, _ = curl_raw(
            "POST",
            "/api/v1/ai/plant-doctor/diagnose",
            token=tok_user,
            form_file_field=("file", tmp_path),
        )
        log(
            "ai diagnose",
            "POST",
            "/api/v1/ai/plant-doctor/diagnose",
            sc_d,
            "PASS" if sc_d in (200, 201) else "FAIL",
            "",
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # --- Notifications module ---
    if tok_admin:
        run(
            "notifications send",
            "POST",
            "/api/v1/notifications/send",
            token=tok_admin,
            json_body={
                "user_id": uid_new or "",
                "title": "t",
                "message": "m",
                "type": "SYSTEM",
            },
            ok=(200, 201),
            allow=(400, 404),
        )
    run("notifications settings get", "GET", "/api/v1/notifications/settings", token=tok_user)
    run(
        "notifications settings put",
        "PUT",
        "/api/v1/notifications/settings",
        token=tok_user,
        json_body={"push_enabled": True},
        ok=(200,),
        allow=(400,),
    )
    run(
        "notifications device-token",
        "POST",
        "/api/v1/notifications/device-token",
        token=tok_user,
        json_body={"token": "test-device-token-api-sweep", "platform": "IOS"},
        ok=(200, 201),
        allow=(400,),
    )

    # --- Vendor analytics & nursery my-nursery ---
    if tok_vendor:
        run("vendor analytics overview", "GET", "/api/v1/vendor/analytics/overview", token=tok_vendor)
        run("vendor analytics sales", "GET", "/api/v1/vendor/analytics/sales", token=tok_vendor)
        run("vendor bank list", "GET", "/api/v1/bank-details", token=tok_vendor, ok=(200,), allow=(403,))
        run("vendor earnings", "GET", "/api/v1/vendor/earnings", token=tok_vendor, ok=(200,), allow=(404,))
        run("nurseries my-nursery", "GET", "/api/v1/nurseries/my-nursery", token=tok_vendor, ok=(200,), allow=(404,))

    # --- Admin (sample) ---
    if tok_admin:
        run("admin users", "GET", "/api/v1/admin/users", token=tok_admin)
        run("admin nurseries", "GET", "/api/v1/admin/nurseries", token=tok_admin)
        run("admin settings", "GET", "/api/v1/admin/settings", token=tok_admin)
        run("admin analytics overview", "GET", "/api/v1/admin/analytics/overview", token=tok_admin)

    # --- Reviews / disputes (read) ---
    run("reviews list", "GET", "/api/v1/reviews", token=tok_user, ok=(200,), allow=(401, 404))
    run("disputes list", "GET", "/api/v1/disputes", token=tok_user, ok=(200,), allow=(401,))

    # --- Plants vendor (read list) ---
    if tok_vendor:
        run("vendor plants list", "GET", "/api/v1/plants/vendor/plants", token=tok_vendor)

    # --- Media presigned (no file) ---
    run(
        "media presigned",
        "POST",
        "/api/v1/media/presigned-url",
        token=tok_user,
        json_body={"filename": "x.png", "content_type": "image/png"},
        ok=(200, 201),
        allow=(400, 501),
    )

    if tok_admin:
        run("admin orders", "GET", "/api/v1/admin/orders", token=tok_admin)
        run("admin gardeners", "GET", "/api/v1/admin/gardeners", token=tok_admin)
        run("admin bookings", "GET", "/api/v1/admin/bookings", token=tok_admin)
        run("admin payouts", "GET", "/api/v1/admin/payouts", token=tok_admin)
        run("admin disputes", "GET", "/api/v1/admin/disputes", token=tok_admin)
        run("admin featured-plants", "GET", "/api/v1/admin/featured-plants", token=tok_admin)
        run("admin coupons", "GET", "/api/v1/admin/coupons", token=tok_admin)
        run("admin commission", "GET", "/api/v1/admin/settings/commission", token=tok_admin)
        run("admin categories", "GET", "/api/v1/admin/categories", token=tok_admin)
        run("admin skills", "GET", "/api/v1/admin/skills", token=tok_admin)
    run(
        "gardener profile (expect 403 for customer)",
        "GET",
        "/api/v1/gardeners/profile",
        token=tok_user,
        ok=(200, 403),
    )
    if tok_vendor:
        run("vendor analytics inventory", "GET", "/api/v1/vendor/analytics/inventory", token=tok_vendor)
        run("vendor analytics rentals", "GET", "/api/v1/vendor/analytics/rentals", token=tok_vendor)
        run("vendor payouts summary", "GET", "/api/v1/vendor/earnings/summary", token=tok_vendor)
        run("vendor payouts list", "GET", "/api/v1/vendor/payouts", token=tok_vendor)
    run(
        "auth verify-otp dummy",
        "POST",
        "/api/v1/auth/verify-otp",
        json_body={"identifier": "x@x.com", "otp": "000000", "purpose": "SIGNUP"},
        ok=(200,),
        allow=(400,),
    )
    run(
        "auth resend-otp",
        "POST",
        "/api/v1/auth/resend-otp",
        json_body={"identifier": "customer1@example.com", "purpose": "SIGNUP"},
        ok=(200,),
        allow=(400, 429),
    )

    # --- Print summary ---
    print("\n### API sweep summary\n")
    print("| Test | Method | Path | HTTP | Result | Detail |")
    print("|------|--------|------|------|--------|--------|")
    for name, method, path, sc, out, det in results:
        det_esc = det.replace("|", "\\|").replace("\n", " ")
        print(f"| {name} | {method} | `{path}` | {sc} | {out} | {det_esc} |")

    fails = [r for r in results if r[4] == "FAIL"]
    print(f"\n**Total:** {len(results)}  **Passed:** {len(results) - len(fails)}  **Failed:** {len(fails)}\n")
    if fails:
        print("### Failures (needs attention)\n")
        for name, method, path, sc, _, det in fails:
            print(f"- **{name}** `{method} {path}` → **{sc}** — {det[:300]}")


if __name__ == "__main__":
    main()
