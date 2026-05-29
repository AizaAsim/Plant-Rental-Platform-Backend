# Plant Rental Platform — Backend API Reference

Complete list of HTTP endpoints with **purpose** and **request payloads** (body, query, path).

> **Related:** [Inventory & Package Allocation](./INVENTORY_AND_PACKAGE_ALLOCATION.md) — stock lifecycle, package plant allocation, rental-stage integration, and API mapping.

| Symbol | Meaning |
|--------|---------|
| **—** | No body |
| **Q:** | Query string |
| **P:** | Path param |
| **B:** | JSON body |
| **F:** | `multipart/form-data` |

**Base URL:** Your server origin (e.g. `http://localhost:3002`)

**Auth:** `Authorization: Bearer <JWT>` unless marked **Public**

**Roles:** `USER` | `VENDOR` | `GARDENER` | `ADMIN`

**Interactive docs:** Swagger UI at **`/v1/api`** (restart server after code changes)

**Static uploads:** `GET /uploads/...`

**Legacy alias:** `/rentals/*` mirrors `/api/v1/rentals/*`

**Common list queries** (many `GET` list routes): `page`, `limit`, `status`, `date_from`, `date_to`, `order_type`

---

## Root

| Method | Path | Auth | Purpose | Payload |
|--------|------|------|---------|---------|
| GET | `/` | Public | Health / hello | — |

---

## 1. Authentication — `/api/v1/auth`

| Method | Path | Auth | Purpose | Payload |
|--------|------|------|---------|---------|
| POST | `/register` | Public | Create account; starts signup flow | **B:** `email`, `password`, `full_name`, `phone`, `role` (`USER`\|`VENDOR`\|`GARDENER`\|`ADMIN`); optional `is_corporate`, `company_name`, `gst_number`, `gardener_type` |
| POST | `/verify-otp` | Public | Confirm email/phone with OTP | **B:** `identifier` (email or phone), `otp` (6 digits), `purpose` (`SIGNUP`, `PASSWORD_RESET`, etc.) |
| POST | `/resend-otp` | Public | Resend OTP | **B:** `identifier`, `purpose` |
| POST | `/login` | Public | Login; issue access + refresh tokens | **B:** `email`, `password`; optional `device_info` |
| POST | `/logout` | JWT | Revoke refresh token / session | **B:** `refresh_token` |
| POST | `/refresh-token` | Public | New access token | **B:** `refresh_token` |
| POST | `/forgot-password` | Public | Send reset OTP | **B:** `email` |
| POST | `/reset-password` | Public | Set new password with OTP | **B:** `email`, `otp`, `new_password` |
| PUT | `/change-password` | JWT | Change password while logged in | **B:** `currentPassword`, `newPassword` |
| GET | `/me` | JWT | Current user profile | — |
| GET | `/sessions` | JWT | Active sessions/devices | — |
| DELETE | `/sessions/:session_id` | JWT | Revoke one session | **P:** `session_id` |

---

## 2. Users — `/api/v1/users`

**Auth:** JWT (any role)

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/profile` | Full profile + addresses summary | — |
| PUT | `/profile` | Update profile | **B:** optional `full_name`, `phone`, `avatar_url`, `company_name`, `gst_number` |
| GET | `/addresses` | List saved addresses | — |
| GET | `/addresses/:address_id` | One address | **P:** `address_id` |
| POST | `/addresses` | Add delivery address | **B:** `address_line1`, `city`, `state`, `pincode`; optional `label`, `address_line2`, `latitude`, `longitude`, `is_default` |
| PUT | `/addresses/:address_id` | Update address | **B:** same fields (partial OK) |
| DELETE | `/addresses/:address_id` | Delete address | **P:** `address_id` |
| GET | `/wishlist` | Saved plants | **Q:** `page`, `limit` |
| POST | `/wishlist/:plant_id` | Add plant to wishlist | **P:** `plant_id` |
| DELETE | `/wishlist/:plant_id` | Remove from wishlist | **P:** `plant_id` |
| GET | `/notifications` | In-app notification inbox | **Q:** `page`, `limit`, `type`, `is_read` |
| PUT | `/notifications/:notification_id/read` | Mark one read | **P:** `notification_id` |
| PUT | `/notifications/read-all` | Mark all read | — |
| GET | `/rented-plants` | Plants user is renting | **Q:** `status` (`RentalStatus`) |
| GET | `/order-history` | Paginated orders | **Q:** `page`, `limit`, `status`, `order_type` |
| GET | `/booking-history` | Past service bookings | **Q:** `page`, `limit`, `status` |

---

## 3. Favorites — `/api/v1/favorites`

**Auth:** JWT, `USER` — alias of wishlist (`/users/wishlist`)

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/` | List favorites | **Q:** `page`, `limit` |
| POST | `/:plant_id` | Add favorite | **P:** `plant_id` |
| DELETE | `/:plant_id` | Remove favorite | **P:** `plant_id` |

---

## 4. Preferences — `/api/v1/preferences`

**Auth:** JWT

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/recommendation` | Load saved plant-recommendation prefs for AI | — |
| PUT | `/recommendation` | Save prefs (used by `POST /ai/recommender/recommend`) | **B:** `city`, `light_pref` (`low`\|`medium`\|`high`), `pet_friendly` (bool), `space` (`small`\|`medium`\|`large`); optional `water_pref`, `top_n` (1–20) |

---

## 5. Plants — `/api/v1/plants`

### Public

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/` | Browse catalog | **Q:** `page`, `limit`, `category`, `maintenanceLevel`, `sunlightRequirement`, `price_min`, `price_max`, `is_indoor`, `is_pet_friendly`, `available_for` (`RENT`\|`BUY`), `nursery_id`, `search`, `sort_by` |
| GET | `/featured` | Admin-curated featured list | **Q:** `feature_type`, `limit` |
| GET | `/trending` | Trending by orders/views | **Q:** `limit`, `days` |
| GET | `/seasonal` | Seasonal picks | **Q:** `limit` |
| GET | `/categories` | Category tree | — |
| GET | `/categories/:category_id` | Category + plants | **P:** `category_id`; **Q:** plant filters |
| GET | `/slug/:nursery_slug/:plant_slug` | SEO detail by slug | **P:** slugs |
| GET | `/:plant_id` | Plant detail by ID | **P:** `plant_id` |
| GET | `/:plant_id/reviews` | Reviews for plant | **Q:** `page`, `limit`, `rating` |
| GET | `/:plant_id/availability` | Stock/date check | **Q:** `start_date`, `end_date`, `quantity` |

### Vendor — JWT, `VENDOR`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/vendor/plants` | Add plant to nursery catalog | **B:** `name`; optional `category_id`, `scientific_name`, `description`, care fields, `rent_price_*`, `buy_price`, `stock_quantity`, `images[]`, flags |
| GET | `/vendor/plants` | Own inventory | **Q:** plant filters |
| PUT | `/vendor/plants/bulk-update` | Bulk patch | **B:** `plant_ids[]` + fields to update |
| GET | `/vendor/plants/:plant_id` | Vendor view of one plant | **P:** `plant_id` |
| PUT | `/vendor/plants/:plant_id` | Update metadata | **B:** `UpdatePlantDto` fields |
| PATCH | `/vendor/plants/:plant_id` | Update + upload images | **F:** `data` (JSON string), `images[]` |
| DELETE | `/vendor/plants/:plant_id` | Deactivate plant | **P:** `plant_id` |
| PUT | `/vendor/plants/:plant_id/stock` | Stock count | **B:** `stock_quantity` and/or `adjustment` |
| PATCH | `/vendor/plants/:plant_id/stock` | Stock + optional images | **F:** `data`, `images[]` |
| POST | `/vendor/plants/:plant_id/images/upload` | Upload files to `/uploads` | **F:** `images[]` |
| POST | `/vendor/plants/:plant_id/images` | Attach image URLs | **B:** `images[]`: `{ image_url, is_primary?, display_order? }` |
| DELETE | `/vendor/plants/:plant_id/images/:image_id` | Remove image | **P:** ids |
| PUT | `/vendor/plants/:plant_id/pricing` | Rent/buy/deposit prices | **B:** `rent_price_daily`, `rent_price_weekly`, `rent_price_monthly`, `buy_price`, `deposit_amount` |

### User — JWT, `USER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/:plant_id/reviews` | Review plant (verified if order linked) | **B:** `rating` (1–5); optional `title`, `comment`, `order_id`, `images[]` |

---

## 6. Nurseries — `/api/v1/nurseries`

### Vendor — JWT, `VENDOR`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/` | Create nursery for vendor | **B:** `name`, `address_line1`, `city`, `state`, `pincode`; optional `description`, `logo_url`, `cover_image_url`, `phone`, `email`, `latitude`, `longitude` |
| GET | `/my-nursery` | Own nursery profile | — |
| PUT | `/my-nursery` | Update nursery | **B:** partial `CreateNurseryDto` |
| POST | `/my-nursery/images` | Add gallery images | **B:** `images[]` with URLs |
| DELETE | `/my-nursery/images/:image_id` | Remove image | **P:** `image_id` |
| PUT | `/my-nursery/working-hours` | Set open hours | **B:** per-day slots |
| GET | `/my-nursery/working-hours` | Get hours | — |
| PUT | `/my-nursery/service-areas` | Delivery pincodes/areas | **B:** `service_areas[]` |
| GET | `/my-nursery/service-areas` | Get areas | — |
| GET | `/my-nursery/gardeners` | Staff + linked gardeners | — |
| POST | `/my-nursery/gardeners` | Create staff gardener account | **B:** `email`, `phone` required; optional name fields → returns **temporary password** |
| GET | `/my-nursery/gardeners/:gardener_id` | Staff detail | **P:** `gardener_id` |
| PUT | `/my-nursery/gardeners/:gardener_id` | Update staff | **B:** profile fields |
| POST | `/my-nursery/gardeners/:gardener_id/reset-credentials` | New temp password | — |
| POST | `/my-nursery/gardeners/:gardener_id/status` | Activate/deactivate staff | **B:** `is_active`, optional `reason` |
| POST | `/my-nursery/gardeners/:gardener_id/invite` | Invite existing gardener | **B:** optional `message` |
| GET | `/my-nursery/invitations` | Sent invitations | — |
| DELETE | `/my-nursery/gardeners/:gardener_id` | Remove from nursery | — |

### Public

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/check-serviceability` | Can nursery deliver to pincode? | **Q:** `nursery_id`, `pincode` |
| GET | `/slug/:slug` | Nursery by slug | **P:** `slug` |
| GET | `/` | Browse nurseries | **Q:** `page`, `limit`, `city`, `state`, `pincode`, `latitude`, `longitude`, `radius_km`, `rating_min`, `is_verified`, `sort_by` |
| GET | `/:nursery_id` | Nursery detail | **P:** `nursery_id` |
| GET | `/:nursery_id/plants` | Nursery catalog | **Q:** category, price, `available_for`, etc. |
| GET | `/:nursery_id/reviews` | Nursery reviews | **Q:** `page`, `limit`, `rating` |
| GET | `/:nursery_id/vendor-packages` | Public vendor package tiers | **P:** `nursery_id` |

---

## 7. Vendor staff gardeners — `/api/v1/vendor/staff-gardeners`

**Auth:** JWT, `VENDOR` — same behavior as `my-nursery/gardeners/*`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/invitations/sent` | Sent invitations | — |
| GET | `/` | List staff gardeners | — |
| POST | `/` | Create staff account | **B:** `email`, `phone` (+ optional profile fields) |
| GET | `/:gardener_id` | Staff detail | **P:** `gardener_id` |
| PUT | `/:gardener_id` | Update staff | **B:** profile fields |
| POST | `/:gardener_id/reset-credentials` | Reset password | — |
| POST | `/:gardener_id/status` | Activate/deactivate | **B:** `is_active`, optional `reason` |
| POST | `/:gardener_id/invite` | Invite gardener | **B:** optional `message` |
| DELETE | `/:gardener_id` | Remove staff | — |

---

## 8. Vendor onboarding — `/api/v1/vendor/onboarding`

**Auth:** JWT, `VENDOR`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/` | Setup checklist (profile, areas, packages, staff) with counts and route map | — |

---

## 9. Vendor packages — `/api/v1/vendor/packages`

**Auth:** JWT, `VENDOR`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/` | Create rental package tier | **B:** `name`, `tier`, `max_plant_count`, `rental_duration_days`, `includes_maintenance`, `base_price`; optional `description`, `maintenance_visits_per_month`, `deposit_amount`, `allows_installments`, `installment_options`, `add_ons`, `is_active`, **`plants[]`** (`plant_id`, `quantity` per line) |
| GET | `/` | List own packages | **Q:** `is_active` |
| GET | `/:package_id` | Detail (`VPkg-…` or UUID) | **P:** `package_id` |
| PUT | `/:package_id` | Update | **B:** partial update fields; optional **`plants[]`** replaces allocated plant lines |
| DELETE | `/:package_id` | Soft-deactivate | — |

---

## 10. Cart — `/api/v1/cart`

**Auth:** JWT, `USER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/` | Current cart + pricing summary | — |
| POST | `/items` | Add plant line | **B:** `plant_id`, `order_type` (`RENT`\|`BUY`), `quantity`; for **RENT:** `rent_start_date`, `rent_end_date` |
| PUT | `/items/:item_id` | Change qty or rent dates | **B:** `quantity`, `rent_start_date`, `rent_end_date` (partial) |
| DELETE | `/items/:item_id` | Remove line | **P:** `item_id` |
| DELETE | `/` | Clear cart | — |
| POST | `/validate` | Validate stock, dates, rules before checkout | — |
| POST | `/apply-coupon` | Apply platform coupon | **B:** `coupon_code` |
| DELETE | `/coupon` | Remove coupon | — |
| POST | `/packages` | Add fixed/custom/**vendor** package | **B:** exactly one of `package_id`, `custom_package_id`, or **`vendor_package_id`** (`VPkg-…` or UUID); optional `quantity` |
| DELETE | `/packages/:item_id` | Remove package line | **P:** `item_id` |

---

## 11. Packages (legacy) — `/api/v1/packages`

| Method | Path | Auth | Purpose | Payload |
|--------|------|------|---------|---------|
| GET | `/` | Public | All fixed `PlantPackage` records | — |
| GET | `/nursery/:nursery_id` | Public | Packages for nursery | **P:** `nursery_id` |
| GET | `/:package_id` | Public | Fixed package detail | **P:** `package_id` |
| POST | `/custom` | JWT | User-built custom package | **B:** name, plant lines, pricing |
| GET | `/custom` | JWT | My custom packages | — |
| GET | `/custom/:package_id` | JWT | Custom package detail | **P:** `package_id` |
| PUT | `/custom/:package_id` | JWT | Update custom package | **B:** update fields |
| DELETE | `/custom/:package_id` | JWT | Delete custom package | — |

---

## 12. Rentals — `/api/v1/rentals` and `/rentals`

**Auth:** JWT, `USER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/` | Standalone rental request (legacy) | **B:** `plantId`, `nurseryId`, `duration` (weeks), `serviceType`, `startDate`; optional `deliveryAddressId`, `customDeliveryAddress`, `deliveryInstructions`, `includeMaintenance`, `maintenanceFrequency` |
| GET | `/` | List my rentals | **Q:** status, page, etc. |
| POST | `/draft` | Save rent intent in cart | **B:** `plant_id`, `rent_start_date`, `rent_end_date`; optional `quantity` |
| GET | `/draft` | Rental-only cart lines | — |
| POST | `/availability` | Check dates for a plant | **B:** `plantId`, `startDate`, `endDate`; optional `quantity` |
| GET | `/:id` | Rental/order-item detail | **P:** id |
| PUT | `/:id` | Update pending rental | **B:** `UpdateRentalDto` |
| POST | `/:id/extend` | Extend (prefer orders route) | **B:** `additionalWeeks`; optional `reason` |
| POST | `/:id/convert-to-purchase` | Buy out rental | **B:** per `ConvertToPurchaseDto` |

---

## 13. Orders — `/api/v1/orders`

### Customer — JWT, `USER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/checkout` | Create order from cart | **B:** `delivery_address_id`, `payment_method`; optional `notes`, `coupon_code` |
| GET | `/` | My orders | **Q:** page, status, `order_type`, dates |
| GET | `/history` | Same as `/users/order-history` | **Q:** same |
| GET | `/customer/active-rentals` | Hub: ongoing, overdue, pickup, extensions, penalties | — |
| POST | `/:order_id/customer-delivery-response` | Accept/reschedule delivery slots | **B:** `action`: `CONFIRM` \| `REQUEST_DIFFERENT_TIME` \| `REQUEST_DIFFERENT_GARDENER`; for CONFIRM: `selected_slot_id`, optional `selected_gardener_proposal_id`; for reschedule: `preferred_date`, `preferred_time_from/to`, `note` |
| POST | `/:order_id/customer-return-response` | Accept/reschedule return pickup | **B:** `action`: `CONFIRM` \| `REQUEST_DIFFERENT_TIME`; `pickup_slot_id` or preferred date/times, `note` |
| GET | `/:order_id/penalty` | Late/overdue penalty breakdown | — |
| POST | `/:order_id/finalize-penalty` | Confirm penalty at pickup | penalty fields per contract |
| POST | `/:order_id/complaints` | Report issue (notifies vendor + admin) | **B:** `subject`, `description`; optional `attachments[]` (URLs) |
| GET | `/my-complaints` | My complaints | **Q:** `page`, `limit` |
| GET | `/:order_id/fulfillment-summary` | Delivery/return audit (no raw proof URLs) | — |
| GET | `/:order_id/line-items/:order_item_id/fulfillment-summary` | One line audit | **P:** ids |
| GET | `/:order_id` | Order detail | — |
| GET | `/:order_id/tracking` | Status timeline | — |
| POST | `/:order_id/cancel` | Cancel if policy allows | **B:** optional `reason` |
| POST | `/:order_id/items/:item_id/extend-rental` | Request extension | **B:** `new_end_date` **or** `additional_weeks` (≥1); optional `reason` |
| POST | `/:order_id/items/:item_id/return` | Customer-initiated return | **B:** optional `return_date`, `pickup_time_slot` |

### Vendor — JWT, `VENDOR`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/vendor/orders` | Nursery order queue | **Q:** filters |
| GET | `/vendor/orders/stats` | Counts/revenue by period | **Q:** `period` = day\|week\|month\|year |
| GET | `/vendor/orders/:order_id/fulfillment-audit` | Proof flags all lines | — |
| GET | `/vendor/orders/:order_id/line-items/:order_item_id/fulfillment` | One line proof | — |
| GET | `/vendor/orders/:order_id` | Vendor order view | — |
| GET | `/vendor/orders/:order_id/payment-status` | Can vendor process yet? | — |
| PUT | `/vendor/orders/:order_id/approve` | Approve PENDING; map plants to lines | **B:** `plant_selections[]`: `{ order_item_id, plant_id }` |
| POST | `/vendor/orders/:order_id/process` | Move to processing after paid | — |
| POST | `/vendor/orders/:order_id/propose-delivery-slots` | Offer delivery windows | **B:** `delivery_slots[]` `{ date, time_from, time_to }`; optional `note`, `slot_ttl_hours`, `gardener_proposals[]` |
| POST | `/:order_id/propose-delivery-slots` | Same (shorter path) | same body |
| POST | `/vendor/orders/:order_id/initiate-return` | Propose return pickup slots | **B:** `pickup_slots[]`; optional `assigned_staff_gardener_id`, `notes` |
| POST | `/vendor/orders/:order_id/complete-return` | Close return per line | **B:** `collection_date`, `items[]` each `{ order_item_id, condition, restock?, proof_image_urls?, notes? }`; optional `collection_proof_at` |
| POST | `/vendor/orders/:order_id/complete-delivery` | Mark delivered; start rent clock | **B:** optional `actual_start_date`, `delivery_notes`, `proof_image_urls[]`, `line_items[]` per rental row |
| PUT | `/vendor/orders/:order_id/status` | Manual status change | **B:** `status` (`OrderStatus`), optional `notes` |
| POST | `/vendor/orders/:order_id/reject` | Reject before fulfillment | **B:** `reason` (or `rejection_reason` / `cancellation_reason`, 3–2000 chars) |
| GET | `/vendor/complaints` | Complaints on nursery orders | **Q:** page, limit |
| POST | `/vendor/orders/:order_id/assign-gardener` | Schedule maintenance visits | **B:** `gardener_id`, `order_item_id`, `maintenance_schedule` (`WEEKLY`\|`BIWEEKLY`\|`MONTHLY`); optional `delivery_slots[]` |
| POST | `/vendor/orders/:order_id/rental-extensions/:extension_id/approve` | Approve extension request | — |
| POST | `/vendor/orders/:order_id/rental-extensions/:extension_id/reject` | Reject extension | **B:** optional `reason` |
| GET | `/vendor/rentals/active` | Legacy active rental lines | **Q:** `status` ACTIVE\|OVERDUE\|DUE_TODAY, page, limit |

---

## 14. Vendor rentals — `/api/v1/vendor/rentals`

**Auth:** JWT, `VENDOR`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/` | Rental board with bucket counts | **Q:** `bucket` = `ONGOING`\|`DUE_TODAY`\|`OVERDUE`\|`COMPLETED`; `page`, `limit` |

---

## 15. Bookings — `/api/v1/bookings`

### User — JWT, `USER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/` | Book gardener for a visit | **B:** `gardener_id`, `service_address_id`, `service_type`, `service_date`, `service_time`, `duration_hours`; optional `recurrence_pattern`, `recurrence_end_date`, `notes` |
| GET | `/` | My bookings | **Q:** page, status, dates |
| GET | `/:booking_id` | Detail | **P:** `booking_id` |
| POST | `/:booking_id/cancel` | Cancel (24h policy) | **B:** `reason` |
| POST | `/:booking_id/reschedule` | New date/time | **B:** `new_date`, `new_time` |
| POST | `/:booking_id/review` | Rate completed booking | **B:** `rating`, `comment` |

### Gardener — JWT, `GARDENER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/gardener/bookings` | Assigned bookings | **Q:** filters |
| GET | `/gardener/bookings/:booking_id` | Detail | — |
| POST | `/gardener/bookings/:booking_id/accept` | Accept PENDING booking | — |
| POST | `/gardener/bookings/:booking_id/reject` | Decline | **B:** `reason` |
| POST | `/gardener/bookings/:booking_id/start` | Start service (IN_PROGRESS) | — |
| POST | `/gardener/bookings/:booking_id/complete` | Finish service | **B:** optional `completion_notes` |
| GET | `/gardener/bookings/calendar` | Month calendar | **Q:** `month`, `year` |

---

## 16. Payments — `/api/v1/payments`

| Method | Path | Auth | Purpose | Payload |
|--------|------|------|---------|---------|
| POST | `/initiate` | USER | Start mock gateway payment | **B:** `payment_for` (e.g. `ORDER`, `RENTAL_EXTENSION`, `FREELANCE_JOB`), `reference_id`, `payment_method`; optional `return_url`. **Header:** `Idempotency-Key` (optional) |
| POST | `/verify` | USER | Complete payment after client callback | **B:** `gateway_order_id`, `gateway_payment_id`, `gateway_signature` |
| POST | `/webhook` | **Public** | Gateway webhook | gateway payload |
| GET | `/history` | USER | User payment history | **Q:** page, `status`, `payment_type`, dates |
| GET | `/:payment_id` | USER | Payment detail | **P:** `payment_id` |
| POST | `/:payment_id/refund` | USER | Request refund | **B:** `reason`; optional `amount` |

---

## 17. Bank details — `/api/v1/bank-details`

**Auth:** JWT, `VENDOR` | `GARDENER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/` | List payout accounts | — |
| POST | `/` | Add account | **B:** `account_holder_name`, `account_number`, `bank_name`, `ifsc_code`, `account_type` (`SAVINGS`\|`CURRENT`); optional `is_primary` |
| PUT | `/:id` | Update | **B:** same fields (partial) |
| DELETE | `/:id` | Remove | **P:** `id` |

---

## 18. Vendor finances — `/api/v1/vendor`

**Auth:** JWT, `VENDOR`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/earnings` | Ledger of earnings | **Q:** page, status, dates |
| GET | `/earnings/summary` | Totals | **Q:** `period` week\|month\|year |
| GET | `/payouts` | Payout history | **Q:** page, status |
| POST | `/payouts/request` | Request withdrawal | **B:** `amount`, `bank_detail_id` |

---

## 19. Gardener finances — `/api/v1/gardener`

**Auth:** JWT, `GARDENER` — same four routes and payloads as vendor finances.

---

## 20. Gardeners — `/api/v1/gardeners`

### Gardener — JWT, `GARDENER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/profile` | Create gardener profile | **B:** optional `bio`, `experience_years`, `hourly_rate`, `is_freelancer`, `skills[]`, `service_areas`, `availability` (freelancers need `hourly_rate`) |
| GET | `/profile` | Own profile | — |
| PUT | `/profile` | Update profile | **B:** profile fields |
| PUT | `/availability` | Weekly schedule | **B:** availability slots |
| PUT | `/service-areas` | Pincodes/cities served | **B:** areas array |
| POST | `/skills` | Link skills | **B:** `skill_ids[]` or similar |
| DELETE | `/skills/:skill_id` | Remove skill | **P:** `skill_id` |
| GET | `/invitations` | Nursery invites received | — |
| POST | `/nursery-invitation/:invitation_id/accept` | Join nursery | — |
| POST | `/nursery-invitation/:invitation_id/decline` | Decline invite | — |
| POST | `/leave-nursery` | Leave current employer | — |
| GET | `/onboarding/me` | Staff vs freelance next steps | — |

### Public

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/freelance` | Search freelancers | **Q:** page, `pincode`, `city`, `skill_ids`, `rating_min`, `hourly_rate_min/max`, `available_date`, `available_time`, `sort_by` |
| GET | `/skills/all` | Skill catalog | — |
| GET | `/onboarding` | Static API map for mobile | — |
| GET | `/:gardener_id` | Public profile | **P:** `gardener_id` |
| GET | `/:gardener_id/reviews` | Reviews | **Q:** page, rating |
| GET | `/:gardener_id/availability` | Free slots | **Q:** `date`, `duration_hours` |

---

## 21. Tasks — `/api/v1/tasks`

| Method | Path | Role | Purpose | Payload |
|--------|------|------|---------|---------|
| POST | `/vendor/tasks/:task_id/propose-maintenance` | VENDOR | Propose visit to customer | **B:** proposed date/time, message |
| POST | `/:task_id/customer-response` | USER | Approve/reschedule proposal | **B:** `action`, slot fields |
| POST | `/:task_id/maintenance-feedback` | USER | Post-visit rating | **B:** rating, comment |
| GET | `/` | GARDENER | List my tasks | **Q:** status, `task_type`, dates |
| GET | `/:task_id` | JWT | Task detail | — |
| GET | `/:task_id/images` | JWT | Proof photos | — |
| POST | `/:task_id/accept` | GARDENER | Accept assignment | — |
| POST | `/:task_id/reject` | GARDENER | Decline | **B:** `reason` |
| POST | `/:task_id/start` | GARDENER | Start visit | — |
| POST | `/:task_id/complete` | GARDENER | Complete with notes/photos | **B:** notes, `image_urls[]` |
| POST | `/:task_id/images` | GARDENER | Attach images | **B:** `images[]` URLs |

---

## 22. User tasks — `/api/v1/user/tasks`

**Auth:** JWT, `USER`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/` | Maintenance tasks tied to my rentals | **Q:** page, `status`, dates |

---

## 23. Vendor tasks — `/api/v1/vendor/tasks`

**Auth:** JWT, `VENDOR`

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| GET | `/` | Nursery maintenance tasks | **Q:** `gardener_id`, status, dates |
| POST | `/` | Create task | **B:** `order_item_id`, `gardener_id`, `scheduled_date`, `scheduled_time`; optional `priority`, `description` |
| PUT | `/:task_id/reassign` | Change gardener | **B:** `gardener_id` |
| PUT | `/:task_id/reschedule` | New schedule | **B:** `scheduled_date`, `scheduled_time` |
| POST | `/:task_id/cancel` | Cancel task | **B:** `reason` |

---

## 24. Freelance jobs — `/api/v1/freelance-jobs`

| Method | Path | Role | Purpose | Payload |
|--------|------|------|---------|---------|
| POST | `/` | USER | Post open maintenance job | **B:** `delivery_address_id`, `preferred_date`; optional `care_types[]`, `preferred_time_from/to`, `plant_details`, `special_instructions`, `budget_amount`, `order_id` |
| GET | `/my-requests` | USER | Jobs I posted | **Q:** `status`, page |
| GET | `/open` | GARDENER | Browse OPEN jobs | **Q:** `city`, `pincode`, `care_type`, dates, page |
| GET | `/my-jobs` | GARDENER | Jobs I accepted | **Q:** status, page |
| POST | `/:job_id/cancel` | USER | Cancel before paid | **B:** optional `reason` |
| POST | `/:job_id/withdraw` | GARDENER | Release ACCEPTED job | **B:** optional `reason` |
| GET | `/:job_id` | USER/GARDENER | Detail (`FJB-…` or UUID) | — |
| POST | `/:job_id/accept` | GARDENER | ACCEPTED | — |
| POST | `/:job_id/start` | GARDENER | IN_PROGRESS | — |
| POST | `/:job_id/complete` | GARDENER | COMPLETED | **B:** `completion_notes`, `photo_urls[]` |
| POST | `/:job_id/review` | USER | Rate gardener | **B:** `rating` (1–5), optional `comment` |

---

## 25. Reviews — `/api/v1/reviews`

| Method | Path | Auth | Purpose | Payload |
|--------|------|------|---------|---------|
| POST | `/` | USER | Create review (any entity) | **B:** `reviewable_type` (`PLANT`\|`NURSERY`\|`GARDENER`), `reviewable_id`, `rating`; optional `title`, `comment`, `order_id`, `booking_id`, `images[]` |
| GET | `/` | Public | List reviews | **Q:** type, target id, page, rating |
| PUT | `/:review_id` | USER | Update own review | **B:** rating, title, comment |
| DELETE | `/:review_id` | JWT | Delete (owner/admin) | — |

---

## 26. Disputes — `/api/v1/disputes`

**Auth:** JWT

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/` | Open dispute on order/booking | **B:** `subject`, `description`, `dispute_type`; optional `order_id`, `booking_id`, `attachments[]` |
| GET | `/` | My disputes | **Q:** page, status |
| GET | `/:dispute_id` | Thread + metadata | — |
| POST | `/:dispute_id/messages` | Reply in thread | **B:** `message`; optional attachments |

---

## 27. AI — `/api/v1/ai`

| Method | Path | Auth | Purpose | Payload |
|--------|------|------|---------|---------|
| POST | `/plant-doctor/diagnose` | JWT | Full diagnosis (species + disease + care) | **F:** `file` (image) |
| POST | `/plant-doctor/plant-diagnosis` | JWT | Quick leaf disease | **F:** `file` |
| GET | `/plant-doctor` | Public | Upstream service info | — |
| POST | `/recommender/recommend` | JWT | Prefs-based recommendations | **B:** optional overrides (`city`, `light_pref`, etc.) or `{}` for saved prefs |
| POST | `/recommender/chat` | JWT | Free-form plant Q&A | **B:** `message`; optional `include_catalog_matches` |
| POST | `/recommender/feedback/:log_id` | JWT | Rate a recommendation | **B:** per `RecommendFeedbackDto` |
| GET | `/recommender/health` | Public | Upstream health | — |
| GET | `/recommender/schema` | Public | UI schema for preference modal | — |

---

## 28. Media — `/api/v1/media`

**Auth:** JWT

| Method | Path | Purpose | Payload |
|--------|------|---------|---------|
| POST | `/upload` | Store one image | **F:** `file`; **Q:** `folder`, `resize` |
| POST | `/upload/multiple` | Store many | **F:** `files[]`; **Q:** same |
| POST | `/presigned-url` | S3/mock upload URL | **B:** filename, content-type, folder |
| DELETE | `/:key` | Delete object | **P:** storage key (URL-encoded) |

---

## 29. Notifications — `/api/v1/notifications`

| Method | Path | Auth | Purpose | Payload |
|--------|------|------|---------|---------|
| POST | `/send` | ADMIN | Send to one user | **B:** `user_id`, `title`, `message`, `type`, `channels[]` (`IN_APP`, `EMAIL`, etc.); optional `reference_type`, `reference_id` |
| POST | `/bulk-send` | ADMIN | Batch send | **B:** audience + message (service-defined) |
| GET | `/settings` | JWT | Push/email/SMS prefs | — |
| PUT | `/settings` | JWT | Update prefs | **B:** `email_notifications`, `push_notifications`, `sms_notifications`, `notification_types` |
| POST | `/device-token` | JWT | Register FCM token | **B:** `token`, `platform` (`IOS`\|`ANDROID`\|`WEB`) |

> User inbox: `GET /api/v1/users/notifications`

---

## 30. Admin — `/api/v1/admin`

**Auth:** JWT, `ADMIN`

| Area | Method | Path | Purpose | Body / query |
|------|--------|------|---------|--------------|
| Users | GET | `/users` | List users | **Q:** search, role, status, page |
| | GET | `/users/:user_id` | Detail | — |
| | PUT | `/users/:user_id/status` | Ban/activate | **B:** `is_active` |
| | PUT | `/users/:user_id/verify` | Manual verify | — |
| Nurseries | GET | `/nurseries` | List | **Q:** filters |
| | GET | `/nurseries/:nursery_id` | Detail | — |
| | PUT | `/nurseries/:nursery_id/verify` | Approve nursery | optional notes |
| | PUT | `/nurseries/:nursery_id/status` | Active flag | **B:** `is_active` |
| Gardeners | GET | `/gardeners` | List | **Q:** filters |
| | GET | `/gardeners/:gardener_id` | Detail | — |
| | PUT | `/gardeners/:gardener_id/verify` | Verify gardener | optional body |
| Orders | GET | `/orders` | Support view | **Q:** filters |
| | GET | `/orders/:order_id` | Order detail | — |
| Bookings | GET | `/bookings` | List | **Q:** filters |
| | GET | `/bookings/:booking_id` | Detail | — |
| Payouts | GET | `/payouts` | List payout requests | **Q:** status |
| | PUT | `/payouts/:payout_id/process` | Mark paid/failed | **B:** `status`, `transaction_ref`, `note` |
| Disputes | GET | `/disputes` | List | **Q:** filters |
| | GET | `/disputes/:dispute_id` | Detail | — |
| | POST | `/disputes/:dispute_id/message` | Admin reply | **B:** `message` |
| | PUT | `/disputes/:dispute_id/resolve` | Close dispute | **B:** `resolution`, optional `refund_amount` |
| Featured | GET | `/featured-plants` | List curated | **Q:** filters |
| | POST | `/featured-plants` | Add | **B:** `plant_id`, `feature_type`, `sort_order`, dates |
| | PUT | `/featured-plants/:id` | Update | **B:** fields |
| | DELETE | `/featured-plants/:id` | Remove | — |
| Plants | GET | `/plants` | Search for picker | **Q:** `search`, `limit` |
| Coupons | GET | `/coupons` | List | — |
| | POST | `/coupons` | Create | **B:** `code`, `discount_type`, `discount_value`, `valid_from`, `valid_until`; optional `min_order_amount`, `max_uses` |
| | PUT | `/coupons/:coupon_id` | Update | **B:** fields |
| | DELETE | `/coupons/:coupon_id` | Deactivate | — |
| Commission | GET | `/settings/commission` | Get rates | — |
| | PUT | `/settings/commission` | Set rates | **B:** vendor/gardener commission % |
| Settings | GET | `/settings` | All key/value | — |
| | PUT | `/settings/:key` | Upsert one | **B:** `value` (JSON) |
| Categories | GET | `/categories` | Tree | — |
| | POST | `/categories` | Create | **B:** `name`, `parent_id`, `slug`, `image_url` |
| | PUT | `/categories/:category_id` | Update | **B:** fields |
| | DELETE | `/categories/:category_id` | Delete | — |
| Skills | GET | `/skills` | List | — |
| | POST | `/skills` | Create | **B:** `name`, `description` |
| | DELETE | `/skills/:skill_id` | Delete | — |
| Complaints | GET | `/order-complaints` or `/complaints` | Customer order complaints | **Q:** `status`, page |
| Manual orders | GET | `/manual-orders` | Ops queue | **Q:** `status`, `priority` |
| | POST | `/manual-orders/:order_id/resolve` | Resolve case | **B:** `action`, optional `note` |
| Freelance | GET | `/settings/freelance-match-config` | Auto-match config | — |
| | PUT | `/settings/freelance-match-config` | Update config | **B:** `auto_match_enabled`, `auto_match_score_threshold`, `gardener_accept_window_minutes` |

---

## 31. Admin analytics — `/api/v1/admin/analytics`

**Auth:** JWT, `ADMIN`

| Method | Path | Purpose | Query |
|--------|------|---------|-------|
| GET | `/overview` | KPIs snapshot | `period` |
| GET | `/revenue` | Revenue time series | `period`, `group_by` |
| GET | `/orders` | Order volume breakdown | `period`, `group_by`, `order_type` |
| GET | `/top-nurseries` | Leaderboard | `period`, `limit`, `metric` |
| GET | `/top-plants` | Leaderboard | same |
| GET | `/user-growth` | Signups over time | `period`, `group_by`, `role` |

---

## 32. Vendor analytics — `/api/v1/vendor/analytics`

**Auth:** JWT, `VENDOR`

| Method | Path | Purpose | Query |
|--------|------|---------|-------|
| GET | `/overview` | Nursery KPIs | optional `period` |
| GET | `/sales` | Sales breakdown | optional filters |
| GET | `/inventory` | Stock snapshot | — |
| GET | `/rentals` | Rental metrics | — |

---

## 33. Inventory — `/api/v1/inventory`

**Auth:** JWT, `VENDOR`

| Method | Path | Purpose | Query |
|--------|------|---------|-------|
| GET | `/` | Inventory board — available / reserved / delivered per plant | `search`, `page`, `limit` |
| GET | `/picker` | Searchable plant picker for package creation (available stock only) | `search` |

---

## 34. Internal jobs — `/api/v1/internal/jobs`

**Auth:** JWT, `ADMIN` — cron-style triggers for operations

| Method | Path | Purpose | Body |
|--------|------|---------|------|
| POST | `/orders/expire-unpaid` | Cancel stale unpaid checkouts + release stock | optional `{}` |
| POST | `/orders/expire-stale-slot-proposals` | Expire SLOT_PROPOSED after TTL | optional `{}` |
| POST | `/orders/expire-stale-payment-windows` | Expire AWAITING_PAYMENT | optional `{}` |
| POST | `/orders/expire-sweep` | Run all expiry jobs | — |
| POST | `/orders/due-reminders` | Send due-date reminders | optional `{}` |
| POST | `/orders/penalty-sweep` | Accrue overdue penalties | **B:** `{ notify?: boolean }` |
| POST | `/freelance-jobs/auto-match` | Auto-assign freelancers (stub) | optional `{}` |

---

## Response shape

Most business routes return a **contract envelope** (`ok`, `data`, sometimes `meta` for pagination). Auth routes return `access_token`, `refresh_token`, and user object.

---

## DTO source files

| Module | Location |
|--------|----------|
| Auth | `src/modules/app/auth/dto/` |
| Users | `src/modules/app/users/dto/` |
| Plants | `src/modules/app/plants/dto/` |
| Rentals | `src/modules/app/rentals/dto/` |
| Nurseries | `src/modules/app/nurseries/dto/` |
| Vendor packages | `src/modules/app/vendor-packages/dto/` |
| Inventory | `src/modules/app/inventory/` |
| Preferences / AI | `src/modules/app/preferences/dto/`, `src/modules/app/ai/dto/` |
| Order workflow (Swagger) | `src/modules/app/orders/order-workflow.swagger.ts` |
| Freelance jobs (Swagger) | `src/modules/app/freelance-jobs/freelance-jobs.swagger.ts` |

---

## Order workflow — detailed body schemas

See `src/modules/app/orders/order-workflow.swagger.ts` and **Orders** tag in `/v1/api` for:

- `propose-delivery-slots` — `delivery_slots[]`, `gardener_proposals[]`
- `customer-delivery-response` — `action`, `selected_slot_id`, etc.
- `vendor-initiate-return` — `pickup_slots[]`
- `vendor-complete-return` — `collection_date`, `items[]`
- `complete-delivery` — `line_items[]` proof per row
- `assign-gardener` — `gardener_id`, `order_item_id`, `maintenance_schedule`

---

*Generated from NestJS controllers in this repository. For live request/response schemas, use Swagger at `/v1/api`.*
