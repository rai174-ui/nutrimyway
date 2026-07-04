---
name: Trial member menu/flavour filtering
description: How trial_1day/trial_3day member types are restricted to trial_eligible items across NutriMyWay admin routes
---

Trial member types (`trial_1day`, `trial_3day`, checked via `isTrialMemberType()`) must only see menu items and flavour/ingredient options where `trial_eligible = TRUE`, or items marked `is_mandatory = TRUE` (mandatory items always show regardless of trial status).

**Why:** A prior review found the filter had only been implemented on the member-facing self-service routes. The admin-side visit/check-in panel (used by center staff during in-person check-ins) called the same underlying menu-items and flavour-options endpoints but without passing member context, so trial restrictions were silently bypassed whenever staff processed the check-in instead of the member.

**How to apply:** Any new endpoint or UI surface that lists menu items, flavours, or ingredients for a specific member/check-in must resolve the member's type and apply the trial filter — do not assume the restriction only needs to exist on member-initiated routes. The admin `GET /admin/centers/:centerId/menu-items` endpoint accepts an optional `?memberId=` query param specifically for this: when omitted (e.g. the Set Menu master-data page), all items are returned unfiltered; when provided (e.g. the admin visit panel), trial filtering is applied. `GET /admin/checkins/:checkinId/flavour-options` resolves member type from the check-in itself, so no query param is needed there.

## Related: membership cap/renewal gating and cross-center ownership checks

When a hard usage cap (e.g. a fixed check-in count per cycle) can be reached independently of date-based expiry, any UI gate that only shows the renewal action based on "days until expiry" must also account for the cap being reached — otherwise staff hit an operational dead-end (member is blocked from checking in, but there's no way to renew them). Always derive gate conditions from *all* the ways a limit can trigger, not just the most obvious one (date).

Any admin endpoint that accepts a `member_id`/`assigned_member_id` in the request body (not the URL) must still verify that member is mapped to the `centerId` the admin is scoped to (via `member_center_mapping`), even if the member-type check (e.g. "must be virtual") already exists — a type check alone does not prevent cross-center IDOR.
