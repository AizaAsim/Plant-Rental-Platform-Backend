#!/usr/bin/env python3
"""
Discover every HTTP route from all Nest controllers under src/**/*.controller.ts
(including src/app.controller.ts) and probe each against API_BASE (default
http://localhost:3002).

Multipart file uploads (media upload, AI plant-doctor) are probed with a minimal
PNG via curl -F. POST /api/v1/auth/register is probed once per run with a unique
email (does not flood the database).

Outputs:
  - Full table to stdout
  - JSON report to exhaustive_api_report.json in cwd

Classification:
  - BROKEN: unexpected 5xx, or connection error
  - OK: 2xx, or expected 401/403 when no/wrong token, or 404 with dummy id on detail routes
  - CLIENT: 400/422 (validation — endpoint reachable; body/query incomplete for automated test)
"""
from __future__ import annotations

import base64
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
from datetime import date, timedelta
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[1]
SRC_CONTROLLERS = ROOT / "src"
# 1×1 transparent PNG
_MINI_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
BASE = os.environ.get("API_BASE", "http://localhost:3002").rstrip("/")
SEED_PW = "Password123!"

HTTP_DECORATORS = ("Get", "Post", "Put", "Delete", "Patch")


@dataclass
class RouteInfo:
    file: str
    verb: str
    path: str  # full path, may contain :params
    class_jwt: bool
    class_roles: list[str]
    method_jwt: bool
    method_roles: list[str]
    method_public: bool = False
    handler: str = ""

    def needs_jwt(self) -> bool:
        if self.method_public:
            return False
        return self.class_jwt or self.method_jwt

    def roles(self) -> list[str]:
        r = list({*self.class_roles, *self.method_roles})
        return r


def _parse_roles(s: str) -> list[str]:
    return re.findall(r"UserRole\.(\w+)", s)


def _parse_controller_line(s: str) -> Optional[str]:
    m = re.match(r"@Controller\(\s*(['\"])(.*?)\1\s*\)", s.strip())
    if m:
        return m.group(2)
    m = re.match(r"@Controller\(\s*\)", s.strip())
    if m:
        return ""
    return None


def _parse_http_decorator(s: str) -> Optional[tuple[str, str]]:
    st = s.strip()
    for name in HTTP_DECORATORS:
        if st.startswith(f"@{name}("):
            inner = st[len(f"@{name}(") :].rstrip(")")
            inner = inner.strip()
            if not inner:
                return name.upper(), ""
            m = re.match(r"['\"]([^'\"]*)['\"]", inner)
            if m:
                return name.upper(), m.group(1)
            return name.upper(), ""
        if st == f"@{name}()":
            return name.upper(), ""
    return None


def discover_routes() -> list[RouteInfo]:
    routes: list[RouteInfo] = []
    for path in sorted(SRC_CONTROLLERS.rglob("*.controller.ts")):
        lines = path.read_text(encoding="utf-8").splitlines()
        rel = str(path.relative_to(ROOT))
        class_idx = None
        for i, line in enumerate(lines):
            if re.search(r"export\s+class\s+\w+Controller\b", line):
                class_idx = i
                break
        if class_idx is None:
            continue
        base = ""
        for line in lines[:class_idx]:
            p = _parse_controller_line(line.strip())
            if p is not None:
                base = p
        # opening brace of class
        brace_i = None
        for j in range(class_idx, min(class_idx + 8, len(lines))):
            if "{" in lines[j]:
                brace_i = j
                break
        if brace_i is None:
            continue
        # class-level guards: decorators above `export class` + lines after `{` until constructor
        class_jwt = False
        class_roles: list[str] = []
        for line in lines[:class_idx]:
            if "JwtAuthGuard" in line:
                class_jwt = True
            class_roles.extend(_parse_roles(line))
        k = brace_i + 1
        while k < len(lines):
            st = lines[k].strip()
            if "constructor(" in st:
                break
            if "JwtAuthGuard" in lines[k]:
                class_jwt = True
            class_roles.extend(_parse_roles(lines[k]))
            k += 1
        class_roles = list(dict.fromkeys(class_roles))

        pending: list[str] = []
        k = brace_i + 1
        while k < len(lines):
            raw = lines[k]
            st = raw.strip()
            # skip entire constructor block
            if "constructor(" in st:
                depth = 0
                seen = False
                while k < len(lines):
                    depth += lines[k].count("{") - lines[k].count("}")
                    if "{" in lines[k]:
                        seen = True
                    k += 1
                    if seen and depth <= 0:
                        break
                continue
            meth = re.match(r"^(?:async\s+)?(\w+)\s*\(", st)
            if meth and meth.group(1) not in {
                "if",
                "for",
                "while",
                "switch",
                "catch",
                "constructor",
                "return",
                "throw",
            }:
                handler = meth.group(1)
                method_jwt = any("JwtAuthGuard" in d for d in pending)
                method_public = any("@Public(" in d or "@Public()" in d for d in pending)
                method_roles: list[str] = []
                for d in pending:
                    method_roles.extend(_parse_roles(d))
                verb_path = None
                for d in pending:
                    hp = _parse_http_decorator(d)
                    if hp:
                        verb_path = hp
                        break
                if verb_path:
                    verb, sub = verb_path
                    full = join_paths(base, sub)
                    routes.append(
                        RouteInfo(
                            file=rel,
                            verb=verb,
                            path=full,
                            class_jwt=class_jwt,
                            class_roles=class_roles,
                            method_jwt=method_jwt,
                            method_roles=method_roles,
                            method_public=method_public,
                            handler=handler,
                        )
                    )
                pending = []
                k += 1
                continue
            if st.startswith("@") and not st.startswith("@Injectable"):
                pending.append(st)
            k += 1
    return routes


def join_paths(base: str, sub: str) -> str:
    base = base.strip().strip("/")
    sub = (sub or "").strip().strip("/")
    if not base:
        return "/" + sub if sub else "/"
    if not sub:
        return "/" + base
    return "/" + base + "/" + sub


def login(email: str, password: str) -> Optional[str]:
    sc, body = curl_json("POST", "/api/v1/auth/login", None, {"email": email, "password": password})
    if sc != 200:
        return None
    data = json.loads(body) if body else {}
    return data.get("access_token")


def curl_json(
    verb: str,
    path: str,
    token: Optional[str],
    body: Any = None,
    extra_headers: Optional[list[tuple[str, str]]] = None,
) -> tuple[int, str]:
    url = BASE + (path if path.startswith("/") else "/" + path)
    cmd = ["curl", "-sS", "-w", "\n%{http_code}", "-X", verb, url]
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])
    if extra_headers:
        for k, v in extra_headers:
            cmd.extend(["-H", f"{k}: {v}"])
    if body is not None and verb in ("POST", "PUT", "PATCH"):
        cmd.extend(["-H", "Content-Type: application/json", "-d", json.dumps(body)])
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired:
        return 0, '{"error":"timeout"}'
    out = (p.stdout or "").strip()
    if "\n" not in out:
        return 0, out[:2000]
    b, _, c = out.rpartition("\n")
    try:
        return int(c), b
    except ValueError:
        return 0, b[:2000]


def curl_multipart_post(
    path: str,
    token: Optional[str],
    field: str,
    filepath: str,
    repeat_field: bool,
) -> tuple[int, str]:
    url = BASE + (path if path.startswith("/") else "/" + path)
    cmd = ["curl", "-sS", "-w", "\n%{http_code}", "-X", "POST", url]
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])
    if repeat_field:
        cmd.extend(
            [
                "-F",
                f"{field}=@{filepath};type=image/png",
                "-F",
                f"{field}=@{filepath};type=image/png",
            ]
        )
    else:
        cmd.extend(["-F", f"{field}=@{filepath};type=image/png"])
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return 0, '{"error":"timeout"}'
    out = (p.stdout or "").strip()
    if "\n" not in out:
        return 0, out[:2000]
    b, _, c = out.rpartition("\n")
    try:
        return int(c), b
    except ValueError:
        return 0, b[:2000]


def module_name_from_file(rel_path: str) -> str:
    p = rel_path.replace("\\", "/")
    if p.endswith("/app.controller.ts") or p.endswith("app.controller.ts"):
        return "app-root"
    if "/modules/app/" in p:
        return p.split("/modules/app/", 1)[1].split("/", 1)[0]
    parts = p.split("/")
    if "app" in parts:
        i = parts.index("app")
        if i + 1 < len(parts):
            return parts[i + 1]
    stem = Path(p).stem
    return stem.replace(".controller", "") if stem else "?"


def pick_token(
    roles: list[str],
    tokens: dict[str, Optional[str]],
) -> tuple[Optional[str], str]:
    """Returns (token, label)."""
    if not roles:
        # prefer user if jwt needed elsewhere; try user first for generic jwt
        return tokens.get("USER"), "USER(default)"
    if "ADMIN" in roles and tokens.get("ADMIN"):
        return tokens["ADMIN"], "ADMIN"
    if "VENDOR" in roles and tokens.get("VENDOR"):
        return tokens["VENDOR"], "VENDOR"
    if "GARDENER" in roles and tokens.get("GARDENER"):
        return tokens["GARDENER"], "GARDENER"
    if "USER" in roles and tokens.get("USER"):
        return tokens["USER"], "USER"
    # any available
    for k in ("USER", "VENDOR", "ADMIN", "GARDENER"):
        if tokens.get(k):
            return tokens[k], f"{k}(fallback)"
    return None, "none"


def substitute_path(template: str, ctx: dict[str, str]) -> str:
    """Fill :params from ctx; disambiguate repeated param names like :id."""
    UUID_PH = "00000000-0000-0000-0000-000000000001"
    out = template
    out = out.replace(":nursery_slug", ctx.get("nursery_slug") or "nursery")
    out = out.replace(":plant_slug", ctx.get("plant_slug") or "plant")
    out = out.replace(":slug", ctx.get("nursery_slug") or ctx.get("slug") or "nursery")

    # :id is reused across modules — pick the right uuid
    if ":id" in out:
        if "admin/featured-plants/" in out:
            val = ctx.get("featured_row_id") or UUID_PH
        elif out.startswith("/rentals") or "/rentals/" in out:
            val = ctx.get("rental_item_id") or UUID_PH
        elif "/bank-details/" in out:
            val = ctx.get("bank_detail_id") or UUID_PH
        else:
            val = ctx.get("generic_id") or UUID_PH
        out = re.sub(r":id(?=/|$)", val, out, count=1)

    if ":order_id" in out:
        if "vendor/orders" in out:
            if "/approve" in out or "/reject" in out:
                val = ctx.get("vendor_order_pending_id") or ctx.get("vendor_order_id") or UUID_PH
            elif "/process" in out:
                val = ctx.get("vendor_order_paid_confirmed_id") or ctx.get("vendor_order_id") or UUID_PH
            elif "complete-delivery" in out:
                val = ctx.get("vendor_order_processing_id") or ctx.get("vendor_order_id") or UUID_PH
            elif "assign-gardener" in out:
                val = ctx.get("vendor_order_assign_id") or ctx.get("vendor_order_paid_confirmed_id") or UUID_PH
            else:
                val = ctx.get("vendor_order_id") or UUID_PH
        elif "extend-rental" in out or ("/items/" in out and "return" in out):
            val = ctx.get("order_extend_id") or ctx.get("order_return_id") or ctx.get("order_id") or UUID_PH
        elif "cancel" in out:
            val = ctx.get("order_cancel_id") or ctx.get("order_id") or UUID_PH
        else:
            val = ctx.get("order_id") or UUID_PH
        out = re.sub(r":order_id(?=/|$)", val, out, count=1)

    if ":item_id" in out:
        if "/cart/items/" in out:
            val = ctx.get("cart_item_id") or UUID_PH
        elif "/cart/packages/" in out:
            val = ctx.get("cart_package_item_id") or UUID_PH
        elif "extend-rental" in out:
            val = ctx.get("item_extend_id") or ctx.get("item_id") or UUID_PH
        elif "return" in out:
            val = ctx.get("item_return_id") or ctx.get("item_id") or UUID_PH
        else:
            val = ctx.get("item_id") or UUID_PH
        out = re.sub(r":item_id(?=/|$)", val, out, count=1)

    if ":task_id" in out:
        if "/vendor/tasks/" in out:
            val = ctx.get("vendor_task_id") or ctx.get("task_id") or UUID_PH
        else:
            val = ctx.get("task_id") or UUID_PH
        out = re.sub(r":task_id(?=/|$)", val, out, count=1)

    if ":booking_id" in out:
        if "/cancel" in out:
            val = ctx.get("booking_cancel_id") or ctx.get("booking_id") or UUID_PH
        elif "reschedule" in out:
            val = ctx.get("booking_reschedule_id") or ctx.get("booking_id") or UUID_PH
        elif "/review" in out:
            val = ctx.get("booking_review_id") or ctx.get("booking_id") or UUID_PH
        elif "gardener/bookings" in out:
            if "/accept" in out or "/reject" in out:
                val = (
                    ctx.get("gardener_booking_pending_id")
                    or ctx.get("gardener_booking_id")
                    or ctx.get("booking_id")
                    or UUID_PH
                )
            else:
                val = ctx.get("gardener_booking_id") or ctx.get("booking_id") or UUID_PH
        else:
            val = ctx.get("booking_id") or UUID_PH
        out = re.sub(r":booking_id(?=/|$)", val, out, count=1)

    if ":log_id" in out:
        val = ctx.get("log_id") or "00000000-0000-0000-0000-000000000099"
        out = re.sub(r":log_id(?=/|$)", val, out, count=1)

    if ":image_id" in out and "/plants/vendor/plants/" in out and "/images/" in out:
        val = ctx.get("plant_image_id") or UUID_PH
        out = re.sub(r":image_id(?=/|$)", val, out, count=1)

    if ":dispute_id" in out:
        if "/admin/disputes/" in out:
            val = ctx.get("dispute_id") or UUID_PH
        else:
            val = ctx.get("user_dispute_id") or ctx.get("dispute_id") or UUID_PH
        out = re.sub(r":dispute_id(?=/|$)", val, out, count=1)

    if ":key" in out:
        if "/media/" in out:
            val = ctx.get("media_delete_key") or "nonexistent-key"
        elif "/admin/settings/" in out:
            val = ctx.get("settings_key") or "commission.vendor_rate"
        else:
            val = ctx.get("key") or UUID_PH
        out = re.sub(r":key(?=/|$)", val, out, count=1)

    for name in list(dict.fromkeys(re.findall(r":([a-zA-Z0-9_]+)", out))):
        if name in (
            "nursery_slug",
            "plant_slug",
            "slug",
            "id",
            "order_id",
            "item_id",
            "task_id",
            "booking_id",
            "log_id",
            "key",
            "dispute_id",
            "image_id",
        ):
            continue
        val = ctx.get(name)
        if not val:
            val = UUID_PH
        out = re.sub(r":" + re.escape(name) + r"(?=/|$)", val, out, count=1)
    return out


def multipart_upload_spec(r: RouteInfo) -> Optional[tuple[str, bool]]:
    """If this route expects multipart file(s), return (field_name, repeat_field_for_array)."""
    if r.verb != "POST":
        return None
    p = r.path.lower()
    if "media/upload/multiple" in p:
        return ("files", True)
    if "media/upload" in p:
        return ("file", False)
    if "plant-doctor/diagnose" in p:
        return ("file", False)
    if "plant-doctor/plant-diagnosis" in p:
        return ("file", False)
    return None


def _j(sc: int, raw: str) -> Any:
    if sc != 200 or not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def build_context(tokens: dict[str, Optional[str]], suffix: str) -> dict[str, str]:
    """Harvest real ids from the API for path substitution and JSON bodies."""
    ctx: dict[str, str] = {}
    user_tok = tokens.get("USER") or ""
    adm = tokens.get("ADMIN")
    ven = tokens.get("VENDOR")
    gar = tokens.get("GARDENER")

    sc, body = curl_json("GET", "/api/v1/plants?limit=5", None, None)
    d = _j(sc, body)
    if isinstance(d, dict):
        items = d.get("items") or []
        if items:
            p0 = items[0]
            ctx["plant_id"] = str(p0.get("id") or "")
            ctx["nursery_id"] = str(
                p0.get("nurseryId") or (p0.get("nursery") or {}).get("id") or ""
            )

    if ven:
        sc, body = curl_json("GET", "/api/v1/plants/vendor/plants?limit=5", ven, None)
        vd = _j(sc, body)
        if isinstance(vd, dict):
            vitems = vd.get("items") or vd.get("plants") or []
            if isinstance(vitems, list) and vitems:
                ctx["plant_id"] = str(vitems[0].get("id") or ctx.get("plant_id", ""))

    sc, body = curl_json("GET", "/api/v1/packages", None, None)
    arr = _j(sc, body)
    if isinstance(arr, list) and arr:
        ctx["package_id"] = str(arr[0].get("id") or "")

    if user_tok:
        curl_json(
            "PUT",
            "/api/v1/preferences/recommendation",
            user_tok,
            {
                "city": "Karachi",
                "light_pref": "medium",
                "water_pref": "low",
                "pet_friendly": True,
                "space": "small",
                "top_n": 3,
            },
        )
        sc, body = curl_json("GET", "/api/v1/users/addresses", user_tok, None)
        adl = _j(sc, body)
        if isinstance(adl, list) and adl:
            ctx["address_id"] = str(adl[0].get("id") or "")
            ctx["address_pincode"] = str(adl[0].get("pincode") or "75500")

        sc, body = curl_json("GET", "/api/v1/orders?limit=20", user_tok, None)
        od = _j(sc, body)
        if isinstance(od, dict):
            orders = od.get("items") or []
            for o in orders:
                oid = str(o.get("id") or "")
                if not oid:
                    continue
                ctx.setdefault("order_id", oid)
                st = str(o.get("status") or "")
                if st == "PENDING" and not ctx.get("order_cancel_id"):
                    ctx["order_cancel_id"] = oid
                its = o.get("items") or []
                for it in its:
                    iid = str(it.get("id") or "")
                    if not iid:
                        continue
                    ctx.setdefault("item_id", iid)
                    rs = str(it.get("rentalStatus") or "")
                    ot = str(it.get("orderType") or "")
                    if ot == "RENT" and rs in ("ACTIVE", "EXTENDED"):
                        ctx["order_extend_id"] = oid
                        ctx["item_extend_id"] = iid
                        ctx["item_return_id"] = iid
                        ctx["order_return_id"] = oid
                    break
                if ctx.get("order_extend_id"):
                    break

        sc, body = curl_json("GET", "/api/v1/orders/customer/active-rentals", user_tok, None)
        ar = _j(sc, body)
        if isinstance(ar, list) and ar:
            ln = ar[0]
            ctx.setdefault("rental_item_id", str(ln.get("id") or ln.get("orderItemId") or ""))
            if isinstance(ln.get("orderId"), str):
                ctx.setdefault("order_id", ln["orderId"])

        sc, body = curl_json("GET", "/api/v1/rentals", user_tok, None)
        rl = _j(sc, body)
        if isinstance(rl, list) and rl:
            ctx.setdefault("rental_item_id", str(rl[0].get("id") or ctx.get("rental_item_id", "")))

        sc, body = curl_json("GET", "/api/v1/auth/me", user_tok, None)
        me = _j(sc, body)
        if isinstance(me, dict) and me.get("id"):
            ctx["customer_user_id"] = str(me["id"])

        sc, body = curl_json("GET", "/api/v1/payments/history?limit=5", user_tok, None)
        ph = _j(sc, body)
        if isinstance(ph, dict):
            pays = ph.get("items") or ph.get("payments") or []
            if isinstance(pays, list) and pays:
                ctx["payment_id"] = str(pays[0].get("id") or "")

        sc, body = curl_json("GET", "/api/v1/auth/sessions", user_tok, None)
        ss = _j(sc, body)
        if isinstance(ss, list) and ss:
            ctx["session_id"] = str(ss[0].get("id") or ss[0].get("session_id") or "")

        sc, body = curl_json("GET", "/api/v1/users/notifications?limit=1", user_tok, None)
        nd = _j(sc, body)
        if isinstance(nd, dict):
            ni = (nd.get("items") or nd.get("notifications") or [])
            if isinstance(ni, list) and ni:
                ctx["notification_id"] = str(ni[0].get("id") or "")

        sc, body = curl_json("GET", "/api/v1/cart", user_tok, None)
        cd = _j(sc, body)
        if isinstance(cd, dict):
            cis = cd.get("items") or []
            if isinstance(cis, list) and cis:
                ctx["cart_item_id"] = str(cis[0].get("id") or "")
            pk = cd.get("packageItems") or cd.get("package_items") or []
            if isinstance(pk, list) and pk:
                ctx["cart_package_item_id"] = str(pk[0].get("id") or "")

        sc, body = curl_json("GET", "/api/v1/packages/custom", user_tok, None)
        cp = _j(sc, body)
        if isinstance(cp, list) and cp:
            ctx["custom_package_id"] = str(cp[0].get("id") or "")
        elif isinstance(cp, dict) and (cp.get("items") or []):
            ctx["custom_package_id"] = str(cp["items"][0].get("id") or "")

    if adm:
        sc, body = curl_json("GET", "/api/v1/admin/users?limit=20", adm, None)
        aud = _j(sc, body)
        if isinstance(aud, dict):
            for u in aud.get("items") or []:
                if u.get("email") and "admin" not in str(u.get("email", "")).lower():
                    ctx["user_id"] = str(u.get("id") or "")
                    break

        sc, body = curl_json("GET", "/api/v1/admin/gardeners?limit=10", adm, None)
        gd = _j(sc, body)
        if isinstance(gd, dict):
            for g in gd.get("items") or []:
                if g.get("id"):
                    ctx["gardener_id"] = str(g["id"])
                    break

        sc, body = curl_json("GET", "/api/v1/admin/orders?limit=5", adm, None)
        aod = _j(sc, body)
        if isinstance(aod, dict):
            for o in aod.get("items") or []:
                if o.get("id"):
                    ctx.setdefault("order_id", str(o["id"]))
                    break

        sc, body = curl_json("GET", "/api/v1/admin/disputes?limit=5", adm, None)
        dd = _j(sc, body)
        if isinstance(dd, dict):
            for x in dd.get("items") or []:
                if not x.get("id"):
                    continue
                st = str(x.get("status") or "")
                if st in ("RESOLVED", "CLOSED"):
                    continue
                ctx["dispute_id"] = str(x["id"])
                break

        sc, body = curl_json("GET", "/api/v1/admin/payouts?limit=5", adm, None)
        pd = _j(sc, body)
        if isinstance(pd, dict):
            for x in pd.get("items") or []:
                if x.get("id"):
                    ctx["payout_id"] = str(x["id"])
                    break

        sc, body = curl_json("GET", "/api/v1/admin/featured-plants", adm, None)
        fe = _j(sc, body)
        if isinstance(fe, list) and fe:
            ctx["featured_row_id"] = str(fe[0].get("id") or "")
        elif isinstance(fe, dict) and fe.get("items"):
            ctx["featured_row_id"] = str(fe["items"][0].get("id") or "")

        sc, body = curl_json("GET", "/api/v1/admin/coupons?limit=5", adm, None)
        co = _j(sc, body)
        if isinstance(co, dict):
            for x in co.get("items") or []:
                if x.get("id"):
                    ctx["coupon_id"] = str(x["id"])
                    if x.get("code"):
                        ctx["coupon_code"] = str(x["code"])
                    break

        sc, body = curl_json("GET", "/api/v1/admin/categories", adm, None)
        ct = _j(sc, body)
        if isinstance(ct, list) and ct:
            ctx["category_id"] = str(ct[0].get("id") or "")

        sc, body = curl_json("GET", "/api/v1/admin/skills", adm, None)
        sk = _j(sc, body)
        if isinstance(sk, list) and sk:
            ctx["skill_id"] = str(sk[0].get("id") or "")

        sc, body = curl_json("GET", "/api/v1/admin/settings", adm, None)
        stl = _j(sc, body)
        if isinstance(stl, list) and stl:
            ctx["settings_key"] = str(stl[0].get("key") or "commission.vendor_rate")

    if ven:
        sc, body = curl_json("GET", "/api/v1/orders/vendor/orders?limit=20", ven, None)
        vod = _j(sc, body)
        if isinstance(vod, dict):
            vpend = vproc = vproc_deliv = vassign = vany = ""
            for o in vod.get("items") or []:
                oid = str(o.get("id") or "")
                if not oid:
                    continue
                if not vany:
                    vany = oid
                st = str(o.get("status") or "")
                ps = str(o.get("paymentStatus") or o.get("payment_status") or "")
                if st == "PENDING" and not vpend:
                    vpend = oid
                if st == "CONFIRMED" and ps == "PAID" and not vproc:
                    vproc = oid
                if st in ("PROCESSING", "OUT_FOR_DELIVERY") and not vproc_deliv:
                    vproc_deliv = oid
                if st == "CONFIRMED" and ps == "PAID" and not vassign:
                    vassign = oid
            ctx["vendor_order_id"] = vpend or vany
            ctx["vendor_order_pending_id"] = vpend
            ctx["vendor_order_paid_confirmed_id"] = vproc
            ctx["vendor_order_processing_id"] = vproc_deliv
            ctx["vendor_order_assign_id"] = vassign or vproc

        sc, body = curl_json("GET", "/api/v1/nurseries/my-nursery", ven, None)
        mn = _j(sc, body)
        if isinstance(mn, dict):
            gl = mn.get("gardeners") or []
            if isinstance(gl, list) and gl and isinstance(gl[0], dict):
                gid = gl[0].get("id")
                if gid:
                    ctx["vendor_nursery_gardener_id"] = str(gid)

        oid_detail = ctx.get("vendor_order_pending_id") or ctx.get("vendor_order_id")
        if oid_detail:
            sc, body = curl_json("GET", f"/api/v1/orders/vendor/orders/{oid_detail}", ven, None)
            det = _j(sc, body)
            if isinstance(det, dict):
                lines: list[dict[str, str]] = []
                for it in det.get("items") or []:
                    iid = str(it.get("id") or "")
                    pid = str(it.get("plantId") or (it.get("plant") or {}).get("id") or "")
                    if iid and pid:
                        lines.append({"order_item_id": iid, "plant_id": pid})
                if lines:
                    ctx["vendor_approve_json"] = json.dumps({"plant_selections": lines})
                st0 = str(det.get("status") or "")
                nxt = {
                    "CONFIRMED": "PROCESSING",
                    "PROCESSING": "OUT_FOR_DELIVERY",
                    "OUT_FOR_DELIVERY": "DELIVERED",
                    "DELIVERED": "COMPLETED",
                }.get(st0)
                if nxt:
                    ctx["vendor_status_update_json"] = json.dumps(
                        {"status": nxt, "notes": "exhaustive-api-probe"}
                    )

        assign_oid = ctx.get("vendor_order_assign_id")
        if assign_oid and ven:
            sc, body = curl_json("GET", f"/api/v1/orders/vendor/orders/{assign_oid}", ven, None)
            adet = _j(sc, body)
            if isinstance(adet, dict):
                for it in adet.get("items") or []:
                    if str(it.get("orderType") or "") == "RENT" and it.get("id"):
                        ctx["vendor_assign_order_item_id"] = str(it["id"])
                        break

        sc, body = curl_json("GET", "/api/v1/vendor/tasks?limit=5", ven, None)
        vtd = _j(sc, body)
        if isinstance(vtd, dict):
            for t in vtd.get("items") or []:
                if t.get("id"):
                    ctx["vendor_task_id"] = str(t["id"])
                    break

        sc, body = curl_json("GET", "/api/v1/bank-details", ven, None)
        bl = _j(sc, body)
        if isinstance(bl, list) and bl:
            ctx["bank_detail_id"] = str(bl[0].get("id") or "")

        if ctx.get("plant_id"):
            sc, body = curl_json(
                "GET",
                f"/api/v1/plants/vendor/plants/{ctx['plant_id']}",
                ven,
                None,
            )
            vp = _j(sc, body)
            if isinstance(vp, dict):
                imgs = vp.get("images") or []
                non_primary = [im for im in imgs if not im.get("isPrimary")]
                pick = non_primary[0] if non_primary else (imgs[1] if len(imgs) > 1 else None)
                if pick and pick.get("id"):
                    ctx["plant_image_id"] = str(pick["id"])

    if gar:
        sc, body = curl_json("GET", "/api/v1/bank-details", gar, None)
        blg = _j(sc, body)
        if isinstance(blg, list) and blg and not ctx.get("bank_detail_id"):
            ctx["bank_detail_id"] = str(blg[0].get("id") or "")

        sc, body = curl_json("GET", "/api/v1/tasks?limit=5", gar, None)
        td = _j(sc, body)
        if isinstance(td, dict):
            for t in td.get("items") or []:
                if t.get("id"):
                    ctx["task_id"] = str(t["id"])
                    break

        sc, body = curl_json("GET", "/api/v1/gardeners/invitations", gar, None)
        invl = _j(sc, body)
        if isinstance(invl, list) and invl:
            ctx["invitation_id"] = str(invl[0].get("id") or "")
        elif isinstance(invl, dict):
            il = invl.get("items") or []
            if isinstance(il, list) and il:
                ctx["invitation_id"] = str(il[0].get("id") or "")

        sc, body = curl_json("GET", "/api/v1/bookings/gardener/bookings?limit=15", gar, None)
        gb = _j(sc, body)
        if isinstance(gb, dict):
            for b in gb.get("items") or []:
                bid = str(b.get("id") or "")
                if not bid:
                    continue
                ctx.setdefault("gardener_booking_id", bid)
                st = str(b.get("status") or "")
                if st == "PENDING":
                    ctx.setdefault("gardener_booking_pending_id", bid)
                    break

    if user_tok and ctx.get("address_pincode"):
        sc, body = curl_json(
            "GET",
            f"/api/v1/gardeners/freelance?pincode={ctx['address_pincode']}&limit=5",
            None,
            None,
        )
        fr = _j(sc, body)
        if isinstance(fr, dict):
            fl = fr.get("items") or fr.get("gardeners") or []
            if isinstance(fl, list) and fl:
                ctx["freelance_gardener_id"] = str(
                    fl[0].get("id") or fl[0].get("gardener_id") or ""
                )

    fg = ctx.get("freelance_gardener_id")
    if fg:
        sc, body = curl_json("GET", f"/api/v1/gardeners/{fg}", None, None)
        ginfo = _j(sc, body)
        if isinstance(ginfo, dict):
            ctx["booking_gardener_id"] = fg
            avs = ginfo.get("availability") or []
            today = date.today()
            for add in range(0, 28):
                d = today + timedelta(days=add)
                js_dow = (d.weekday() + 1) % 7
                for av in avs:
                    if not av.get("isAvailable", av.get("is_available", True)):
                        continue
                    dow = av.get("dayOfWeek", av.get("day_of_week"))
                    if dow is None or int(dow) != js_dow:
                        continue
                    stt = av.get("startTime", av.get("start_time"))
                    try:
                        st_time = float(stt) if stt is not None else 9.0
                    except (TypeError, ValueError):
                        st_time = 9.0
                    ctx["booking_service_date"] = d.isoformat()
                    ctx["booking_service_time"] = st_time
                    break
                if ctx.get("booking_service_date"):
                    break

    if user_tok:
        sc, body = curl_json("GET", "/api/v1/bookings?limit=20", user_tok, None)
        bk = _j(sc, body)
        if isinstance(bk, dict):
            bl = bk.get("items") or []
            nowd = date.today()
            for b in bl:
                bid = str(b.get("id") or "")
                if not bid:
                    continue
                ctx.setdefault("booking_id", bid)
                st = str(b.get("status") or "")
                sd_raw = b.get("serviceDate") or b.get("service_date")
                try:
                    sd = date.fromisoformat(str(sd_raw)[:10]) if sd_raw else nowd
                except Exception:
                    sd = nowd
                hours_ok = (sd - nowd).days >= 2
                if st in ("PENDING", "CONFIRMED") and hours_ok and not ctx.get("booking_cancel_id"):
                    ctx["booking_cancel_id"] = bid
                if st in ("PENDING", "CONFIRMED") and not ctx.get("booking_reschedule_id"):
                    ctx["booking_reschedule_id"] = bid
                if st == "COMPLETED" and not ctx.get("booking_review_id"):
                    ctx["booking_review_id"] = bid

        sc, body = curl_json("GET", "/api/v1/disputes?limit=10", user_tok, None)
        ud = _j(sc, body)
        if isinstance(ud, dict):
            for z in ud.get("items") or []:
                if z.get("id"):
                    ctx["user_dispute_id"] = str(z["id"])
                    break

    if ctx.get("plant_id"):
        sc, body = curl_json("GET", f"/api/v1/plants/{ctx['plant_id']}", None, None)
        pd = _j(sc, body)
        if isinstance(pd, dict) and pd.get("slug"):
            ctx["plant_slug"] = str(pd["slug"])

    if ctx.get("plant_id") and ctx.get("customer_user_id"):
        sc, body = curl_json(
            "GET",
            f"/api/v1/reviews?reviewable_type=PLANT&reviewable_id={ctx['plant_id']}&limit=30",
            None,
            None,
        )
        rv = _j(sc, body)
        if isinstance(rv, dict):
            for r0 in rv.get("items") or []:
                u = r0.get("user") or {}
                if str(u.get("id") or "") == ctx["customer_user_id"] and r0.get("id"):
                    ctx["review_id"] = str(r0["id"])
                    break

    sc, body = curl_json("GET", "/api/v1/nurseries?limit=1", None, None)
    nl = _j(sc, body)
    if isinstance(nl, list) and nl and nl[0].get("slug"):
        ctx["nursery_slug"] = str(nl[0]["slug"])

    ctx["run_suffix"] = suffix
    return ctx


def pick_json_body(verb: str, path_template: str, ctx: dict[str, str], suffix: str) -> dict[str, Any]:
    """Return a JSON body that matches common DTOs so probes return 2xx when data exists."""
    if verb not in ("POST", "PUT", "PATCH"):
        return {}
    p = path_template.rstrip("/")
    suf = ctx.get("run_suffix", suffix) or str(int(time.time()))

    def lj(key: str, default: Any = None) -> Any:
        raw = ctx.get(key) or ""
        if not raw:
            return default
        try:
            return json.loads(raw)
        except Exception:
            return default

    def iso_days(n: int) -> str:
        return (date.today() + timedelta(days=n)).isoformat()

    # --- Cart / orders ---
    if p.endswith("/api/v1/cart/items") and verb == "POST":
        return {
            "plant_id": ctx.get("plant_id"),
            "order_type": "BUY",
            "quantity": 1,
        }
    if "/api/v1/cart/items/" in p and verb == "PUT":
        return {"quantity": 2}
    if p.endswith("/api/v1/cart/apply-coupon") and verb == "POST":
        return {"coupon_code": ctx.get("coupon_code") or "WELCOME10"}
    if p.endswith("/api/v1/cart/packages") and verb == "POST":
        return {"package_id": ctx.get("package_id"), "quantity": 1}
    if p.endswith("/api/v1/orders/checkout") and verb == "POST":
        return {
            "delivery_address_id": ctx.get("address_id"),
            "payment_method": "COD",
            "notes": f"probe-{suf}",
        }
    if "/api/v1/orders/" in p and p.endswith("/cancel") and verb == "POST":
        return {"reason": f"probe-cancel-{suf}"}
    if "extend-rental" in p and verb == "POST":
        return {"new_end_date": iso_days(120)}
    if "/items/" in p and "return" in p and verb == "POST":
        return {"return_date": iso_days(3), "pickup_time_slot": "10:00-12:00"}
    if "vendor/orders" in p and p.endswith("/approve") and verb == "PUT":
        b = lj("vendor_approve_json")
        return b if isinstance(b, dict) else {"plant_selections": []}
    if "vendor/orders" in p and p.endswith("/reject") and verb == "POST":
        return {"reason": f"probe-reject-{suf}"}
    if "vendor/orders" in p and p.endswith("/status") and verb == "PUT":
        b = lj("vendor_status_update_json")
        return b if isinstance(b, dict) else {"status": "PROCESSING", "notes": "probe"}
    if "vendor/orders" in p and p.endswith("/assign-gardener") and verb == "POST":
        return {
            "gardener_id": ctx.get("vendor_nursery_gardener_id"),
            "order_item_id": ctx.get("vendor_assign_order_item_id"),
            "maintenance_schedule": "WEEKLY",
        }

    # --- Bookings ---
    if p.endswith("/api/v1/bookings") and verb == "POST":
        return {
            "gardener_id": ctx.get("booking_gardener_id"),
            "service_address_id": ctx.get("address_id"),
            "service_type": "ONE_TIME",
            "service_date": ctx.get("booking_service_date") or iso_days(7),
            "service_time": ctx.get("booking_service_time") or 10.0,
            "duration_hours": 2,
            "notes": f"probe-{suf}",
        }
    if "/api/v1/bookings/" in p and p.endswith("/cancel") and verb == "POST":
        return {"reason": f"probe-{suf}"}
    if "/api/v1/bookings/" in p and "reschedule" in p and verb == "POST":
        return {
            "service_date": ctx.get("booking_service_date") or iso_days(10),
            "service_time": float(ctx.get("booking_service_time") or 10),
            "duration_hours": 2,
        }
    if "/api/v1/bookings/" in p and p.endswith("/review") and verb == "POST":
        return {"rating": 5, "title": "Great", "comment": "probe", "would_recommend": True}
    if "gardener/bookings" in p and p.endswith("/reject") and verb == "POST":
        return {"reason": f"busy-{suf}"}
    if "gardener/bookings" in p and p.endswith("/complete") and verb == "POST":
        return {"notes": "done", "actual_duration_hours": 2}

    # --- Rentals (legacy module; controller is /rentals, not /api/v1/rentals) ---
    if p.endswith("/rentals/availability") and verb == "POST":
        return {
            "plantId": ctx.get("plant_id"),
            "startDate": iso_days(14),
            "endDate": iso_days(21),
            "quantity": 1,
        }
    if "/rentals/" in p and "/extend" in p and verb == "POST":
        return {"additionalWeeks": 1, "reason": "probe"}
    if re.match(r"^/rentals/[^/]+$", p) and verb == "PUT":
        return {"notes": f"probe-{suf}"}

    # --- Bank / payments ---
    if p.endswith("/api/v1/bank-details") and verb == "POST":
        return {
            "account_holder_name": f"Probe Holder {suf}",
            "account_number": f"50100{random.randint(100000, 999999)}",
            "bank_name": "Mock Bank",
            "ifsc_code": "MOCK0001234",
            "account_type": "SAVINGS",
            "is_primary": False,
        }
    if "/api/v1/bank-details/" in p and verb == "PUT":
        return {"bank_name": f"Mock Bank Updated {suf}"}
    if p.endswith("/api/v1/payments/initiate") and verb == "POST":
        return {
            "payment_for": "ORDER",
            "reference_id": ctx.get("order_id"),
            "payment_method": "CARD",
        }
    if p.endswith("/api/v1/payments/verify") and verb == "POST":
        return {
            "gateway_order_id": ctx.get("gateway_order_id") or "mock",
            "gateway_payment_id": ctx.get("gateway_payment_id") or "mock_gp",
            "gateway_signature": "mock_ok",
        }
    if "/api/v1/payments/" in p and "/refund" in p and verb == "POST":
        return {"reason": f"probe-refund-{suf}", "amount": 1}

    # --- Payout requests (vendor / gardener) ---
    if p.endswith("/payouts/request") and verb == "POST":
        return {
            "amount": 100,
            "bank_detail_id": ctx.get("bank_detail_id"),
            "notes": f"probe-{suf}",
        }

    # --- Users ---
    if p.endswith("/api/v1/users/profile") and verb == "PUT":
        return {"full_name": f"Probe User {suf}"}
    if p.endswith("/api/v1/users/addresses") and verb == "POST":
        return {
            "label": f"Probe-{suf}",
            "address_line1": "123 Probe Street Suite",
            "city": "Karachi",
            "state": "Sindh",
            "pincode": ctx.get("address_pincode") or "75500",
        }
    if "/api/v1/users/addresses/" in p and verb == "PUT":
        return {"city": "Lahore"}
    if p.endswith("/api/v1/users/notifications/read-all") and verb == "PUT":
        return {}
    if "/api/v1/users/notifications/" in p and p.endswith("/read") and verb == "PUT":
        return {}

    # --- Reviews / disputes ---
    if p.endswith("/api/v1/reviews") and verb == "POST":
        return {
            "reviewable_type": "PLANT",
            "reviewable_id": ctx.get("plant_id"),
            "order_id": ctx.get("order_id"),
            "rating": 4,
            "title": "Nice",
            "comment": f"probe-{suf}",
        }
    if "/api/v1/reviews/" in p and verb == "PUT":
        return {"rating": 5, "title": "Updated", "comment": "probe"}
    if p.endswith("/api/v1/disputes") and verb == "POST":
        return {
            "order_id": ctx.get("order_id"),
            "dispute_type": "OTHER",
            "subject": f"Probe dispute {suf}",
            "description": "Automated exhaustive API probe dispute body.",
        }
    if "/api/v1/disputes/" in p and p.endswith("/messages") and verb == "POST":
        return {"message": f"User note {suf}"}

    # --- Notifications (admin) ---
    if p.endswith("/api/v1/notifications/send") and verb == "POST":
        return {
            "user_id": ctx.get("customer_user_id") or ctx.get("user_id"),
            "title": "Probe",
            "message": f"hello-{suf}",
            "type": "SYSTEM",
            "channels": ["IN_APP"],
        }
    if p.endswith("/api/v1/notifications/bulk-send") and verb == "POST":
        return {
            "user_ids": [ctx.get("customer_user_id") or ctx.get("user_id")],
            "title": "Bulk",
            "message": f"bulk-{suf}",
            "type": "SYSTEM",
            "channels": ["IN_APP"],
        }
    if p.endswith("/api/v1/notifications/settings") and verb == "PUT":
        return {"email_enabled": True, "push_enabled": True, "sms_enabled": False}
    if p.endswith("/api/v1/notifications/device-token") and verb == "POST":
        return {"device_token": f"dt_{suf}", "platform": "ios"}

    # --- Admin ---
    if "/api/v1/admin/users/" in p and p.endswith("/status") and verb == "PUT":
        return {"is_active": True, "reason": ""}
    if "/api/v1/admin/nurseries/" in p and p.endswith("/verify") and verb == "PUT":
        return {"is_verified": True}
    if "/api/v1/admin/nurseries/" in p and p.endswith("/status") and verb == "PUT":
        return {"is_active": True}
    if "/api/v1/admin/gardeners/" in p and p.endswith("/verify") and verb == "PUT":
        return {"is_verified": True}
    if "/api/v1/admin/payouts/" in p and p.endswith("/process") and verb == "PUT":
        return {"status": "PROCESSING", "bank_reference": f"BR-{suf}", "notes": "probe"}
    if "/api/v1/admin/disputes/" in p and p.endswith("/message") and verb == "POST":
        return {"message": f"admin note {suf}"}
    if "/api/v1/admin/disputes/" in p and p.endswith("/resolve") and verb == "PUT":
        return {"resolution": f"Resolved in probe {suf}", "refund_amount": 0}
    if p.endswith("/api/v1/admin/featured-plants") and verb == "POST":
        return {
            "plant_id": ctx.get("plant_id"),
            "feature_type": "TRENDING",
            "display_order": 99,
        }
    if "/api/v1/admin/featured-plants/" in p and verb == "PUT":
        return {"display_order": 1, "is_active": True}
    if p.endswith("/api/v1/admin/coupons") and verb == "POST":
        return {
            "code": f"PROBE{suf}"[-16:],
            "discount_type": "PERCENTAGE",
            "discount_value": 5,
            "valid_from": iso_days(0),
            "valid_until": iso_days(365),
            "description": "probe",
        }
    if "/api/v1/admin/coupons/" in p and verb == "PUT":
        return {"description": f"updated-{suf}", "is_active": True}
    if p.endswith("/api/v1/admin/settings/commission") and verb == "PUT":
        return {"vendor_commission_rate": 0.1, "gardener_commission_rate": 0.1}
    if "/api/v1/admin/settings/" in p and verb == "PUT" and "commission" not in p:
        return {"value": "0.12"}
    if p.endswith("/api/v1/admin/categories") and verb == "POST":
        return {"name": f"Cat {suf}", "description": "probe"}
    if "/api/v1/admin/categories/" in p and verb == "PUT":
        return {"description": f"upd-{suf}"}
    if p.endswith("/api/v1/admin/skills") and verb == "POST":
        return {"name": f"Skill {suf}"}

    # --- Packages ---
    if p.endswith("/api/v1/packages/custom") and verb == "POST":
        return {
            "name": f"Custom {suf}",
            "items": [{"plant_id": ctx.get("plant_id"), "quantity": 1}],
        }
    if "/api/v1/packages/custom/" in p and verb == "PUT":
        return {"name": f"Renamed {suf}"}

    # --- Tasks ---
    if "vendor/tasks/" in p and "propose-maintenance" in p and verb == "POST":
        return {
            "proposed_date": iso_days(5),
            "proposed_time": 10,
            "visit_type": "SCHEDULED_MAINTENANCE",
            "description": f"visit-{suf}",
        }
    if "/api/v1/tasks/" in p and "customer-response" in p and verb == "POST":
        return {"action": "approve"}
    if "/api/v1/tasks/" in p and "maintenance-feedback" in p and verb == "POST":
        return {"rating": 5, "comment": "good"}
    if "/api/v1/tasks/" in p and p.endswith("/reject") and verb == "POST":
        return {"reason": f"no-{suf}"}
    if "/api/v1/tasks/" in p and p.endswith("/complete") and verb == "POST":
        return {"completion_notes": "ok", "issues_found": ""}
    if "/api/v1/tasks/" in p and p.endswith("/images") and verb == "POST":
        return {
            "images": [
                {
                    "image_url": "https://example.com/p.png",
                    "image_type": "BEFORE",
                    "caption": "probe",
                }
            ]
        }
    if "/api/v1/vendor/tasks/" in p and p.endswith("/reassign") and verb == "PUT":
        return {"gardener_id": ctx.get("vendor_nursery_gardener_id")}
    if "/api/v1/vendor/tasks/" in p and p.endswith("/reschedule") and verb == "PUT":
        return {"scheduled_date": iso_days(6), "scheduled_time": 11, "reason": "probe"}
    if "/api/v1/vendor/tasks/" in p and p.endswith("/cancel") and verb == "POST":
        return {"reason": f"cancel-{suf}"}
    if p.endswith("/api/v1/vendor/tasks") and verb == "POST":
        return {
            "order_item_id": ctx.get("vendor_assign_order_item_id") or ctx.get("item_extend_id"),
            "gardener_id": ctx.get("vendor_nursery_gardener_id"),
            "scheduled_date": iso_days(4),
            "scheduled_time": 10,
            "priority": "MEDIUM",
            "description": f"task-{suf}",
        }

    # --- Plants vendor ---
    if p.endswith("/api/v1/plants/vendor/plants") and verb == "POST":
        return {
            "category_id": ctx.get("category_id"),
            "name": f"Probe Plant {suf}",
            "scientific_name": "Probus plantus",
            "description": "Exhaustive API probe plant.",
            "care_instructions": "Water weekly",
            "sunlight_requirement": "INDIRECT",
            "water_frequency": "WEEKLY",
            "maintenance_level": "LOW",
            "height_cm": 30,
            "rent_price_weekly": 5,
            "rent_price_monthly": 15,
            "buy_price": 40,
            "stock_quantity": 3,
            "images": [{"image_url": "https://example.com/plant.png", "is_primary": True}],
        }
    if "vendor/plants/bulk-update" in p and verb == "PUT":
        pid = ctx.get("plant_id")
        return {
            "plant_ids": [pid] if pid else [],
            "updates": {"is_active": True},
        }
    if "/api/v1/plants/vendor/plants/" in p and "/images" in p and verb == "POST":
        return {"images": [{"image_url": "https://example.com/i.png", "is_primary": True}]}
    if "/api/v1/plants/vendor/plants/" in p and "/stock" in p and verb == "PUT":
        return {"stock_quantity": 10}
    if "/api/v1/plants/vendor/plants/" in p and "/pricing" in p and verb == "PUT":
        return {"rent_price_weekly": 6, "buy_price": 45}
    if "/api/v1/plants/vendor/plants/" in p and verb == "PUT" and "/stock" not in p and "/pricing" not in p:
        return {"description": f"upd-{suf}"}
    if "/api/v1/plants/" in p and p.endswith("/reviews") and verb == "POST":
        return {
            "rating": 5,
            "title": "Great plant",
            "comment": "probe",
            "order_id": ctx.get("order_id"),
        }

    # --- Nurseries vendor ---
    if p.endswith("/api/v1/nurseries") and verb == "POST":
        return {"name": f"Nursery {suf}", "city": "City", "pincode": "75500"}
    if p.endswith("/api/v1/nurseries/my-nursery") and verb == "PUT":
        return {"description": f"upd-{suf}"}
    if p.endswith("/api/v1/nurseries/my-nursery/working-hours") and verb == "PUT":
        return {
            "hours": [
                {"day": i, "open": "09:00", "close": "17:00", "closed": i == 0}
                for i in range(7)
            ]
        }
    if p.endswith("/api/v1/nurseries/my-nursery/service-areas") and verb == "PUT":
        return {"pincodes": [ctx.get("address_pincode") or "75500"]}
    if "/api/v1/nurseries/my-nursery/gardeners/" in p and p.endswith("/invite") and verb == "POST":
        return {"message": f"join-{suf}"}

    # --- Gardeners ---
    if p.endswith("/api/v1/gardeners/profile") and verb == "POST":
        return {
            "bio": f"bio-{suf}",
            "hourly_rate": 25,
            "experience_years": 1,
            "is_freelancer": True,
        }
    if p.endswith("/api/v1/gardeners/profile") and verb == "PUT":
        return {"bio": f"bio2-{suf}"}
    if p.endswith("/api/v1/gardeners/availability") and verb == "PUT":
        return {
            "slots": [
                {"day_of_week": d, "start_time": 9, "end_time": 17, "is_available": True}
                for d in range(7)
            ]
        }
    if p.endswith("/api/v1/gardeners/service-areas") and verb == "PUT":
        return {"pincodes": [ctx.get("address_pincode") or "75500"]}
    if p.endswith("/api/v1/gardeners/skills") and verb == "POST":
        return {"skill_ids": [ctx.get("skill_id")]}

    # --- AI (JSON routes only; multipart handled elsewhere) ---
    if p.endswith("/api/v1/preferences/recommendation") and verb == "PUT":
        return {
            "city": "Karachi",
            "light_pref": "medium",
            "water_pref": "low",
            "pet_friendly": True,
            "space": "small",
            "top_n": 3,
        }
    if p.endswith("/api/v1/ai/recommender/recommend") and verb == "POST":
        return {}
    if "/api/v1/ai/recommender/feedback/" in p and verb == "POST":
        return {"helpful": True, "comment": "ok"}
    if p.endswith("/api/v1/media/presigned-url") and verb == "POST":
        return {
            "filename": f"x-{suf}.png",
            "content_type": "image/png",
            "folder": "plants",
        }

    return {}


def classify_register(sc: int) -> str:
    if sc == 0 or sc >= 500:
        return "BROKEN"
    if sc in (200, 201, 204):
        return "OK"
    if sc in (400, 422):
        return "CLIENT"
    if sc == 409:
        return "OK"
    if sc == 401:
        return "CLIENT"
    return "CLIENT"


def classify(
    sc: int,
    needs_jwt: bool,
    roles: list[str],
    has_detail_placeholder: bool,
    path: str = "",
) -> str:
    if sc == 0:
        return "BROKEN"
    if sc >= 500:
        # Upstream Plant Doctor may return 5xx; we surface 502 — treat as client/upstream, not app bug
        if sc == 502 and "plant-doctor" in path.lower():
            return "CLIENT"
        return "BROKEN"
    if sc in (200, 201, 204):
        return "OK"
    if sc == 401 and needs_jwt:
        return "OK"
    if sc == 403:
        return "OK"
    if sc == 404 and has_detail_placeholder:
        return "OK"
    if sc in (400, 422):
        return "CLIENT"
    if sc == 404:
        return "CLIENT"
    return "CLIENT"


def register_user(role: str, suffix: str) -> Optional[str]:
    email = f"e2e_{role.lower()}_{suffix}@test.com"
    phone = f"+1{random.randint(2000000000, 9999999999)}"
    body = {
        "email": email,
        "password": "TestPass1!",
        "full_name": f"E2E {role}",
        "phone": phone,
        "role": role,
    }
    sc, raw = curl_json("POST", "/api/v1/auth/register", None, body)
    if sc not in (200, 201):
        return None
    try:
        return json.loads(raw).get("access_token")
    except Exception:
        return None


def main() -> int:
    routes = discover_routes()
    suffix = str(int(time.time()))[-8:]
    tokens: dict[str, Optional[str]] = {
        "USER": login("customer1@example.com", SEED_PW),
        "VENDOR": login("vendor1@plantrent.com", SEED_PW),
        "ADMIN": login("admin@plantrent.com", SEED_PW),
        "GARDENER": register_user("GARDENER", suffix) or login("customer1@example.com", SEED_PW),
    }
    if not tokens["USER"]:
        print("Cannot login customer1 — set API_BASE and DB/seed.", file=sys.stderr)
        return 1

    refresh_token: Optional[str] = None
    sc0, b0 = curl_json(
        "POST",
        "/api/v1/auth/login",
        None,
        {"email": "customer1@example.com", "password": SEED_PW},
    )
    if sc0 == 200:
        try:
            refresh_token = json.loads(b0).get("refresh_token")
        except Exception:
            pass

    ctx = build_context(tokens, suffix)

    ut = tokens.get("USER")
    if ut and ctx.get("plant_id"):
        curl_json(
            "POST",
            "/api/v1/cart/items",
            ut,
            {"plant_id": ctx["plant_id"], "order_type": "BUY", "quantity": 1},
        )
        sc_c, body_c = curl_json("GET", "/api/v1/cart", ut, None)
        cd2 = _j(sc_c, body_c)
        if isinstance(cd2, dict):
            cis2 = cd2.get("items") or []
            if isinstance(cis2, list) and cis2:
                ctx["cart_item_id"] = str(cis2[0].get("id") or ctx.get("cart_item_id", ""))
    if ut and ctx.get("order_id"):
        sc_p, body_p = curl_json(
            "POST",
            "/api/v1/payments/initiate",
            ut,
            {
                "payment_for": "ORDER",
                "reference_id": ctx["order_id"],
                "payment_method": "CARD",
            },
        )
        pi2 = _j(sc_p, body_p)
        if isinstance(pi2, dict):
            if pi2.get("gateway_order_id"):
                ctx["gateway_order_id"] = str(pi2["gateway_order_id"])
            if pi2.get("gateway_payment_id"):
                ctx["gateway_payment_id"] = str(pi2["gateway_payment_id"])
    if ut:
        sc_r, body_r = curl_json(
            "POST",
            "/api/v1/ai/recommender/recommend",
            ut,
            pick_json_body("POST", "/api/v1/ai/recommender/recommend", ctx, suffix),
        )
        rr = _j(sc_r, body_r)
        if isinstance(rr, dict):
            lid = rr.get("log_id") or rr.get("logId")
            if lid:
                ctx["log_id"] = str(lid)

    png_fd, png_path = tempfile.mkstemp(suffix=".png")
    os.write(png_fd, _MINI_PNG)
    os.close(png_fd)

    rows: list[dict[str, Any]] = []
    try:
        for r in routes:
            mp = multipart_upload_spec(r)
            if mp:
                field, repeat = mp
                needs_jwt = r.needs_jwt()
                roles = r.roles()
                tok, tlabel = pick_token(roles, tokens)
                if needs_jwt and not tok:
                    tok = tokens["USER"]
                    tlabel = "USER(fallback-jwt)"
                path_resolved = substitute_path(r.path, ctx)
                sc, body_out = curl_multipart_post(path_resolved, tok, field, png_path, repeat)
                cat = classify(sc, needs_jwt, roles, ":" in r.path, path_resolved)
                snippet = (body_out or "").replace("\n", " ")[:180]
                rows.append(
                    {
                        "module": module_name_from_file(r.file),
                        "file": r.file,
                        "handler": r.handler,
                        "verb": r.verb,
                        "path": r.path,
                        "resolved": path_resolved,
                        "http": sc,
                        "token": tlabel,
                        "category": cat,
                        "snippet": snippet,
                        "probe": "multipart",
                    }
                )
                continue

            if r.path.rstrip("/") == "/api/v1/auth/register" and r.verb == "POST":
                reg_email = f"strict_api_{suffix}_{random.randint(10000, 99999)}@e2e.local"
                phone = f"+1{random.randint(2000000000, 9999999999)}"
                reg_body = {
                    "email": reg_email,
                    "password": "TestPass1!",
                    "full_name": "Strict API Probe",
                    "phone": phone,
                    "role": "USER",
                }
                path_resolved = substitute_path(r.path, ctx)
                sc, body_out = curl_json("POST", path_resolved, None, reg_body)
                cat = classify_register(sc)
                snippet = (body_out or "").replace("\n", " ")[:180]
                rows.append(
                    {
                        "module": module_name_from_file(r.file),
                        "file": r.file,
                        "handler": r.handler,
                        "verb": r.verb,
                        "path": r.path,
                        "resolved": path_resolved,
                        "http": sc,
                        "token": "none",
                        "category": cat,
                        "snippet": snippet,
                        "probe": "register-once",
                    }
                )
                continue

            needs_jwt = r.needs_jwt()
            roles = r.roles()
            tok, tlabel = pick_token(roles, tokens)
            if needs_jwt and not tok:
                tok = tokens["USER"]
                tlabel = "USER(fallback-jwt)"
            if not needs_jwt:
                tok_try = [None, tokens["USER"]]
            else:
                tok_try = [tok]

            best_sc = -1
            best_body = ""
            used_tok = ""
            path_resolved = substitute_path(r.path, ctx)
            if "check-serviceability" in path_resolved and "nursery_id=" not in path_resolved:
                q = f"nursery_id={ctx.get('nursery_id', '00000000-0000-0000-0000-000000000001')}&pincode=75500"
                path_resolved = path_resolved + ("&" if "?" in path_resolved else "?") + q
            for t in tok_try:
                body = None
                if r.verb in ("POST", "PUT", "PATCH"):
                    pl = path_resolved.lower()
                    if "auth/login" in pl:
                        body = {"email": "customer1@example.com", "password": SEED_PW}
                    elif "auth/refresh-token" in pl:
                        body = {"refresh_token": refresh_token or "invalid"}
                    elif "logout" in pl:
                        body = {"refresh_token": refresh_token or "invalid"}
                    elif "webhook" in pl:
                        body = {}
                    elif "forgot-password" in pl:
                        body = {"email": "customer1@example.com"}
                    elif "reset-password" in pl:
                        body = {"email": "x", "otp": "0", "password": "TestPass1!"}
                    else:
                        body = pick_json_body(r.verb, r.path, ctx, suffix)
                sc, body_out = curl_json(r.verb, path_resolved, t, body)
                best_sc, best_body, used_tok = sc, body_out, ("none" if t is None else tlabel)
                if sc not in (401, 0) or t is not None:
                    break

            if best_sc < 0:
                best_sc = 0
                best_body = "no-request-sent"

            cat = classify(best_sc, needs_jwt, roles, ":" in r.path, path_resolved)
            snippet = (best_body or "").replace("\n", " ")[:180]
            rows.append(
                {
                    "module": module_name_from_file(r.file),
                    "file": r.file,
                    "handler": r.handler,
                    "verb": r.verb,
                    "path": r.path,
                    "resolved": path_resolved,
                    "http": best_sc,
                    "token": used_tok,
                    "category": cat,
                    "snippet": snippet,
                }
            )
    finally:
        try:
            os.unlink(png_path)
        except OSError:
            pass

    out_path = ROOT / "exhaustive_api_report.json"
    out_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    broken = [x for x in rows if x.get("category") == "BROKEN"]
    print(f"Discovered {len(routes)} routes; probed {len(rows)}; BROKEN={len(broken)}")
    print(f"JSON report: {out_path}\n")

    print("| Module | Verb | Path | HTTP | Category | Snippet |")
    print("|--------|------|------|------|----------|---------|")
    for x in rows:
        if x.get("category") == "SKIP":
            continue
        sn = (x.get("snippet") or "").replace("|", "/")[:80]
        print(
            f"| {x['module']} | {x['verb']} | `{x['path']}` | {x['http']} | {x['category']} | {sn} |"
        )

    print("\n## Not working properly (BROKEN = 5xx or connection failure)\n")
    if not broken:
        print("_None in this run._")
    else:
        for x in broken:
            print(
                f"- **{x['verb']} `{x['path']}`** ({x['module']}/{x['handler']}) → **{x['http']}** — `{x.get('snippet', '')[:200]}`"
            )

    return 0 if not broken else 2


if __name__ == "__main__":
    raise SystemExit(main())
