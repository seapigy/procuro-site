# Procuro architecture (price discovery)

## Production item search and monitoring

**Monitored discovery** (scheduled checks, Fix Match, price check API) uses **only**:

- **Amazon** — Bright Data dataset (`amazonBrightDataProvider`)
- **Home Depot** — Bright Data dataset (`homeDepotBrightDataProvider`)

Entry points:

- `server/src/providers/retailerProviders.ts` — `enabledRetailerProviders`
- `server/src/services/priceCheck.ts` — `runPriceCheckForItem`
- `server/src/services/matchItem.ts` — catalog match / rematch

Routing hints: `server/src/services/retailerSearchPolicy.ts`, optional `server/src/services/discoveryProfile.ts` (when `GLOBAL_DISCOVERY_PROFILES_ENABLED=true`).

## Legacy / auxiliary (not Bright Data discovery)

- **`server/src/providers/aggregateProvider.ts`** — aggregates via HTTP to **`/api/provider/officedepot`** (Office Depot HTML proxy). Used by tests and tooling, not the monitored pipeline above.
- **`server/src/routes/providers.ts`** — `officedepot`, `rakuten`, `staples` (stub) proxies.
- **Root `providers/` + `jobs/dailyCheck.ts`** — Target-only prototype; not wired to `package.json` scripts. Prefer `server/src/workers/dailyPriceCheck.ts` for production.

## Workers

- **`server/src/workers/dailyPriceCheck.ts`** — production cron for price checks.
- **Root `jobs/`** — legacy / examples; see `jobs/README.md`.

## Test and debug routes

In **production**, `/api/test`, `/api/debug`, and `/api/debug/context` should be disabled unless `ALLOW_TEST_ROUTES=true` (implementation: `server/src/middleware/allowTestRoutes.ts` and route registration in `server/src/index.ts`).
