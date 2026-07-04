---
name: Postgres mixed-type COALESCE
description: Avoid COALESCE across a timestamptz column and a legacy TEXT date column without an explicit cast
---

When a table has both a proper `TIMESTAMPTZ` column and an older `TEXT`-typed date column (e.g. `date_of_joining TEXT` predating a newer `cycle_started_at TIMESTAMPTZ`), never `COALESCE()` them directly — Postgres throws "COALESCE types timestamp with time zone and text cannot be matched".

**Why:** Schemas evolve incrementally; new nullable timestamp columns are often backfilled from older text columns, and it's tempting to keep a defensive fallback chain in queries. But mixed-type COALESCE fails at the SQL level, not silently.

**How to apply:** Cast the text column explicitly before coalescing, e.g. `COALESCE(m.cycle_started_at, NULLIF(m.date_of_joining, '')::timestamptz, '-infinity'::timestamptz)`. Use `NULLIF(col, '')` to guard against empty-string values that would otherwise fail the cast. Grep for other COALESCE chains mixing the same two columns before shipping — one query in this pattern usually means siblings exist.
