---
name: Visit consumption booking
description: How per-visit set menu selection and consumption booking works end-to-end
---

## Tables (migrateAdminTables7)
- `menu_items.is_mandatory BOOLEAN DEFAULT FALSE` — marks items always served (e.g. Afresh)
- `visit_menu_selections(checkin_id, menu_item_id, UNIQUE)` — records items chosen for a visit

## Key server helpers (admin.ts)
- `bookAndCheckout(checkinId, memberId)` — inserts consumption_logs for every selection, then sets checked_out_at
- `autoCheckoutExpired(centerId)` — called at start of GET /admin/centers/:centerId/members; silently checks out any sessions > 180 min

## Check-in flow
- POST checkin auto-inserts visit_menu_selections for all `is_mandatory` items
- Center staff add/remove optional items via POST/DELETE /admin/checkin-selections
- Optional items are only selectable when all BOM ingredients have an open batch (is_available computed in GET menu-items)

## is_available computation
Uses a correlated NOT EXISTS subquery in the menu-items SELECT:
all BOM rows with ingredient_id must have a matching open batch in ingredient_batches at the center.
Items with no ingredient-linked BOM = always available.

**Why:** Prevents booking consumption against items whose ingredients aren't physically stocked at the center.

## Auto-checkout
- 180-minute limit (AUTO_CHECKOUT_MINUTES const in both server and client)
- Triggered server-side on every GET members call — no separate cron needed
- Client shows a progress bar + countdown warning at < 30 min remaining
