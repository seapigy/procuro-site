# Development guide

Short reference for running and testing ProcuroApp locally. **Env templates:** [.env.example](../.env.example) → `server/.env`, [client/.env.example](../client/.env.example) → `client/.env` when needed.

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL (e.g. Supabase) or SQLite for local-only experiments — see [DATABASE-SWITCH.md](DATABASE-SWITCH.md)

## Install

From the repository root:

```bash
npm run install:all
```

## Backend

```bash
cd server
copy ..\.env.example .env   # Windows; or cp on Unix — then edit .env
npx prisma generate
npx prisma migrate dev        # or migrate deploy against your DATABASE_URL
npm run dev
```

Default API: `http://localhost:5000`. Health check: `GET /health` (expect `"status":"ok"` and DB connectivity).

### Windows PowerShell helpers (repo root)

| Script | Purpose |
|--------|---------|
| `start-backend.ps1` | `cd server`, set `TEST_MODE`, optional SQLite `DATABASE_URL`, bootstrap minimal `.env`, `npm run dev` |
| `stop-backend.ps1` | Stop process(es) listening on port 5000 |
| `test-founder-demo.ps1` | Wait for `/health`, then hit common API URLs |
| `force-generate-prisma.ps1` | Stop Node, `npx prisma generate` in `server/` (path via repo root) |
| `complete-price-history-setup.ps1` | Interactive pause, then `prisma generate` only |
| `run-pending-migrations.ps1` | Interactive pause, then `prisma migrate dev` + `generate` |

Prefer `npm run dev:server` from the root for day-to-day dev; these scripts are optional.

### Test mode

For flows that rely on test users / headers, set in `server/.env`:

```env
TEST_MODE=true
```

Restart the server after changes. Adjust test user email in seed/config as your project expects.

### Tenancy / RLS (Postgres)

See [server/docs/tenancy.md](../server/docs/tenancy.md). Apply migrations, then `npm run db:rls` or run `server/sql/rls_tenancy.sql` in Supabase SQL Editor. Use `npm run tenancy:verify` when diagnosing connection mode vs RLS.

## Frontend

```bash
cd client
npm run dev
```

Default UI: `http://localhost:5173`. For production builds and `VITE_API_URL`, see [client/DEPLOYMENT.md](../client/DEPLOYMENT.md).

## Testing

| Location | Command |
|----------|---------|
| Server | `cd server && npm test` |
| Server E2E script | `cd server && npm run test:e2e` |
| Client | `cd client && npm test` |

Use `npm run lint` in `client/` when changing UI.

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| DB connection / P1001 (Prisma) | [SUPABASE-P1001-FIX.md](SUPABASE-P1001-FIX.md), [DATABASE-SWITCH.md](DATABASE-SWITCH.md) |
| Wrong API URL in browser | `client/.env` `VITE_API_URL` or Vite proxy; see client README in repo root |
| QuickBooks redirect mismatch | `QUICKBOOKS_REDIRECT_URI` must match the Intuit app settings (canonical: `/api/qb/callback`; legacy `/oauth/callback` is alias-only for backward compatibility) |
| Port in use | Change `PORT` in `server/.env` or stop the process on 5000 / 5173 |

## Amazon vs Home Depot (price check routing)

There is no per-item DB toggle for “search Amazon vs Home Depot.” Routing is two layers:

1. **Which providers exist in the process** — [`server/src/providers/retailerProviders.ts`](../server/src/providers/retailerProviders.ts) builds `enabledRetailerProviders` from env (Bright Data for Amazon; `BRIGHTDATA_HOMEDEPOT_DATASET_ID` for Home Depot; mock/simulate in dev).
2. **Per-item policy** — [`getRetailerVisibility`](../server/src/services/retailerSearchPolicy.ts) uses `item.name` and optional `item.category`: both retailers default on; **structural / building** patterns exclude Amazon; **office / printer consumables** patterns exclude Home Depot; if both rules would exclude both, the policy **fail-opens** and includes both again.

[`runPriceCheckForItem`](../server/src/services/priceCheck.ts) skips providers when visibility says so. Set `DISCOVERY_DEBUG=true` in `server/.env` to log `retailer policy: amazon=… homeDepot=…`. Search strings: Amazon uses `buildAmazonDiscoveryKeyword`; Home Depot uses `buildAggregateProviderKeyword` (brand + hint + name, no ASIN).

## Further reading

- [AGENTS.md](../AGENTS.md) — repo map for automation / AI
- [server/README.md](../server/README.md) — API and integration notes
- [docs/SAAS-SUPABASE-GO-LIVE.md](SAAS-SUPABASE-GO-LIVE.md) — production / Supabase checklist (if deploying)
