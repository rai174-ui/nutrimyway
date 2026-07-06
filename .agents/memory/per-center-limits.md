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

## Trial 3-Day member overrides

Trial 3-Day (`trial_3day`) members get a fixed 5-day renewal extension and a fixed 3-check-in cap that always override the center's configured values — Trial 1-Day and all other member types still use the center config unchanged.

**Why:** business rule requested per member type, not per center; must not be confused with the per-center settings above.

**How to apply:** resolve per-member effective limits via `getEffectiveMemberLimits(centerId, memberId)` in `admin.ts` (checks `member_type` before falling back to `getCenterLimits`) and via `getMemberCheckinCap(memberId)` / the inline `member_type === "trial_3day"` check in the self-checkin handler in `members.ts`. Any bulk/list query that filters or displays "checkins remaining" against a cap (e.g. the admin members-list "expiring soon" filter) must branch on `member_type = 'trial_3day'` per row instead of applying one center-wide cap to every member.

## UI copy must not assume the center's cap/renewal applies to every member

The member-facing app (dashboard/profile) already rendered `checkin_cap` dynamically from `/members/:id/status`, so trial-aware numbers "just worked" there. The admin panel's members list and renewal dialog, however, had a frontend-only hardcoded `CHECKIN_CAP = 32` constant and a literal "40 days" string baked into JSX copy (`artifacts/nutrimyway-admin/src/pages/members.tsx`) — these silently showed the wrong numbers for trial_3day members even though the backend enforced the correct limits.

**Why:** backend enforcement being correct does not guarantee the UI text agrees with it — any screen that echoes a cap/day-count in prose (not just as raw data from an API field) needs its own audit for hardcoded numbers.

**How to apply:** when a member-type-dependent limit changes, grep the frontend for the old hardcoded literal (both the numeric constant and copy strings like "40 days") in every surface that displays it — list badges, dialog body text, and button tooltips are easy to miss individually. The fix here: the admin members-list endpoint (`GET /admin/centers/:centerId/members`) now returns `effective_checkin_cap`/`effective_renewal_days` per row so the frontend never re-derives the trial override itself.
