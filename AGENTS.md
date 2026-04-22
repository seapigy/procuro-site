# Agent / AI context (ProcuroApp)

Read this before making large changes. Long-form setup lives in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Do not duplicate full guides here—update those files instead.

## What this repo is

- **Product:** QuickBooks-integrated price monitoring: items, retailer price checks, alerts, savings, Stripe billing.
- **Backend:** `server/` — Express + TypeScript, Prisma, PostgreSQL (Supabase) or SQLite for local experiments.
- **Frontend:** `client/` — React + Vite + Tailwind + shadcn-style UI.
- **Retailers:** Provider modules under `server/src/providers/` (aggregated via `aggregateProvider` and related services).

## Entry points

| Area | Path |
|------|------|
| API bootstrap | [server/src/index.ts](server/src/index.ts) |
| React app | [client/src/App.tsx](client/src/App.tsx) |
| Company / tenant context | [server/src/middleware/companyContext.ts](server/src/middleware/companyContext.ts) |
| Tenant DB helper | [server/src/db/tenantDb.ts](server/src/db/tenantDb.ts) |

## Environment files

- **Template:** [.env.example](.env.example) at repo root — copy to **`server/.env`** (backend loads from `server/` when running from `server/`).
- **Client:** [client/.env.example](client/.env.example) → `client/.env` for `VITE_API_URL` in production builds; local dev often uses Vite proxy.

Key groups in `server/.env`: `DATABASE_URL`, QuickBooks (`QUICKBOOKS_*`), Stripe if used, **Bright Data** (`BRIGHTDATA_*`) for Amazon dataset pricing, optional `TEST_MODE`, `TENANCY_ENFORCEMENT_MODE`.

## Commands (from repo root)

```bash
npm run install:all    # install root + server + client workspaces
npm run dev:server     # backend (default port 5000)
npm run dev:client     # frontend (Vite, default 5173)
npm run build          # build server then client
```

**Server** (`cd server`):

- `npm run dev` — `tsx watch src/index.ts`
- `npm test` — Jest
- `npx prisma migrate dev` / `npm run db:deploy` — migrations
- `npm run seed` — seed script
- `npm run test:rls`, `npm run tenancy:verify` — tenancy checks

**Client** (`cd client`):

- `npm test` — Vitest
- `npm run build` — production build

## Docs map (canonical)

| Topic | File |
|--------|------|
| Local setup, testing, troubleshooting | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Which retailers run on price check (Amazon vs Home Depot) | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — *Amazon vs Home Depot (price check routing)* |
| SQLite vs Postgres / Supabase | [docs/DATABASE-SWITCH.md](docs/DATABASE-SWITCH.md) |
| Pooler / P1001 issues | [docs/SUPABASE-P1001-FIX.md](docs/SUPABASE-P1001-FIX.md) |
| Tenancy & RLS | [server/docs/tenancy.md](server/docs/tenancy.md) |
| Retailer architecture (optional) | [server/docs/MULTI-RETAILER-ARCHITECTURE.md](server/docs/MULTI-RETAILER-ARCHITECTURE.md) |
| Retailer API notes | [docs/RETAILER-APIS.md](docs/RETAILER-APIS.md) |
| Backend details / QB | [server/README.md](server/README.md) |
| Frontend deploy | [client/DEPLOYMENT.md](client/DEPLOYMENT.md) |
| Intuit App Store | [docs/APP-SUBMISSION/](docs/APP-SUBMISSION/), [docs/APP-REVIEWER-FLOW/](docs/APP-REVIEWER-FLOW/) |

## Conventions

- Prefer **tenant-safe** DB access: `withCompany` + explicit `companyId` filters; see [server/docs/tenancy.md](server/docs/tenancy.md).
- Match existing TypeScript and component patterns in each package before introducing new abstractions.
