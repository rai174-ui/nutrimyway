# NutriMyWay

A mobile-first health and nutrition tracking web app for wellness center members — tracks meals, weight, macros, and nutrition plan progress.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/nutrimyway run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)
- Required env (production, S3-compatible object storage): `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (optional `S3_REGION`, defaults to `auto`)

## Deployment

NutriMyWay deploys to **Railway only**, as a single Express service serving the member app (`/`), admin panel (`/admin`), and API (`/api`) from one process/port. See `DEPLOY.md` for the full guide, `railway.json` for build/start/health-check config, and `railway-build.sh` for the build pipeline (builds both frontends with the right `BASE_PATH`, then assembles their output into `artifacts/api-server/dist/public`).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Wouter (router), Recharts, Framer Motion
- API: Express 5
- DB: PostgreSQL + pg (raw SQL, no Drizzle for NutriMyWay tables)
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI source of truth
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/api-server/src/lib/sqlite.ts` — PostgreSQL setup + xlsx seeding logic
- `artifacts/api-server/src/routes/` — Express route handlers (members, bom, packs, health)
- `artifacts/nutrimyway/src/` — React frontend (App.tsx, screens, components)
- `data/composition.xlsx` — source data file for seeding

## Architecture decisions

- Uses PostgreSQL instead of SQLite (better-sqlite3 has native module issues on Node 24)
- DB seeding from `data/composition.xlsx` runs once on server start, tracked via `_seed_done` table
- Active member is hardcoded to ID=1 (no auth in this version)
- Calorie target is hardcoded to 2000 kcal (can be personalized later)
- `lib/api-zod/src/index.ts` only re-exports from `./generated/api` — the `./generated/types` barrel is stripped post-codegen to avoid TS2308 collisions caused by Orval generating duplicate Params types
- Check-in cap and renewal-day extension are per-center settings (`centers.checkin_cap`, `centers.renewal_days`, defaults 32/40), editable by Center Admins on the Settings page — not global constants
- Object/photo storage uses a generic S3-compatible client (`artifacts/api-server/src/lib/objectStorage.ts`), not Replit's GCS-backed object storage — works with any S3-compatible bucket (Railway bucket storage, R2, MinIO, etc). ACL metadata is stored as S3 object metadata and updated via copy-in-place (S3 has no in-place metadata update, unlike GCS)

## Product

- **Dashboard**: Calorie progress ring, macro chips, dark-teal center visit card, today's meal log by slot
- **Log**: Meal slot tabs, BOM plan items (pre-fills form), pack size reference, custom food entry
- **Center**: Center filter pills, latest health record metrics, weight trend bar chart, visit history
- **Profile**: Member info, center pills, nutrition plan progress bars, issuance history

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after modifying `lib/api-spec/openapi.yaml`
- Do NOT remove the post-codegen barrel patch in `lib/api-spec/package.json` — it prevents TS2308 on Params types
- `data/composition.xlsx` must be at the workspace root `/data/` for seeding to work
- The `_seed_done` table prevents re-seeding on every restart
- Do not hand-edit Railway's build/start commands in its dashboard — they come from `railway.json` at the repo root, which points at `railway-build.sh`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
