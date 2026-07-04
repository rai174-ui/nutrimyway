---
name: Admin routes bypass OpenAPI codegen
description: NutriMyWay's /admin/* Express routes (center admin + super admin) are not defined in lib/api-spec/openapi.yaml and have no generated hooks.
---

`artifacts/api-server/src/routes/admin.ts` (center admin and super admin endpoints, including all bulk upload endpoints) is plain Express, called from `artifacts/nutrimyway-admin` via a hand-written `superFetch`/`adminFetch` wrapper — not via Orval-generated React Query hooks.

**Why:** Only the member-facing API surface (`lib/api-spec/openapi.yaml`) goes through the OpenAPI → Orval codegen pipeline. The admin panel was built directly against Express routes without a contract-first spec.

**How to apply:** When adding or changing an `/admin/*` route (including new bulk upload endpoints), do NOT edit `lib/api-spec/openapi.yaml` or run `api-spec` codegen for it — there's nothing to regenerate. Just add the Express route + call it directly from the admin frontend with `superFetch`/`adminFetch`. Only touch the OpenAPI spec for member-facing `/api/*` routes.

Also note: `requireAdmin` (center-scoped JWT) and `requireSuperAdmin` (global JWT) are separate middlewares in `admin.ts` — manual CRUD for `center_flavours`/`ingredients` uses `requireAdmin`, but bulk-upload variants should use `requireSuperAdmin` to keep bulk operations Super-Admin-only.
