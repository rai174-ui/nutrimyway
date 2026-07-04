---
name: Per-center configurable check-in cap and renewal days
description: How checkin_cap/renewal_days replaced global CHECKIN_CAP/RENEWAL_DAYS constants, and where they must stay in sync.
---

Check-in cap and renewal-day extension are stored per-center (`centers.checkin_cap`, `centers.renewal_days`; defaults 32/40), not global constants. Center Admins edit them on the Settings page.

**Why:** different centers wanted different check-in allowances/renewal lengths; hardcoded constants were duplicated across `admin.ts` and `members.ts`, which was already a maintenance smell before the ask.

**How to apply:**
- Read limits through the helpers, never re-hardcode: `getCenterLimits(centerId)` in `admin.ts`, `getCenterCheckinCap(centerId)` / `getMemberCheckinCap(memberId)` in `members.ts`.
- A member can map to multiple centers (many-to-many), so member-facing self-service status uses `MIN(checkin_cap)` across their mapped centers — the conservative bound. Center-scoped endpoints (checkin with explicit `center_id`, admin dashboard/renew) use that one center's value directly.
- Any new endpoint that checks a check-in count or extends validity on renewal must go through these helpers, not a literal `32`/`40`.
