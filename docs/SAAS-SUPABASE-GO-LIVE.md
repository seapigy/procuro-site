# SaaS Supabase Go-Live Checklist

This checklist is for production readiness with Supabase + hosted backend.

## 1) Deployment topology (always-on jobs)

Use one authoritative scheduler process:

- API processes: `SCHEDULER_ROLE=api`
- Worker process (single replica): `SCHEDULER_ROLE=worker`

Alternative (small deployment):

- Single process: `SCHEDULER_ROLE=all`

Do not run multiple `worker` or `all` replicas unless you intentionally rely on advisory lock + have duplicate-run monitoring.

## 2) Required production env

Production startup now fails fast if these are missing:

- `DATABASE_URL`
- `ENCRYPTION_KEY`
- `MONITORING_ADMIN_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `QUICKBOOKS_CLIENT_ID`
- `QUICKBOOKS_CLIENT_SECRET`

Recommended:

- `SCHEDULER_ROLE` (`api`, `worker`, `all`, `off`)
- `SCHEDULER_INSTANCE_ID` (explicit instance label for logs)
- `CORS_ORIGINS`
- Bright Data env vars if discovery is enabled

## 3) Scheduler reliability checks

Daily job now includes:

- Postgres advisory lock (cross-replica lock)
- Persisted run records in `JobRun`
- Retry/backoff for transient provider failures
- Runtime status in memory and persisted status snapshot

Ops endpoints:

- `GET /api/monitoring/daily/status`
- `POST /api/monitoring/daily/run`

In production, both require header:

- `x-monitoring-token: <MONITORING_ADMIN_TOKEN>`

## 4) Supabase tenancy validation

Choose tenancy mode via `TENANCY_ENFORCEMENT_MODE`:

- `rls` for direct Postgres connections
- `app_only` for Supabase session pooler

Run:

```bash
cd server
npm run tenancy:verify
```

Behavior:

- `rls` mode -> runs `npm run test:rls`
- `app_only` mode -> skips RLS test by design and validates mode alignment

## 5) Pre-launch verification

- `GET /health` returns `db: true`
- `GET /api/monitoring/daily/status` returns runtime + latest run
- Trigger `POST /api/monitoring/daily/run` and confirm:
  - run status is success/skipped with reason
  - `JobRun` row is written
- Confirm at least one subscribed + QB-connected company receives updates
- Confirm alerts dedupe behavior over repeated runs

## 6) Operational alerts

Create alerts on:

- No successful `daily_price_check` run in 24h
- Error count spike in latest run metrics
- Repeated lock-not-acquired skips during scheduled windows

## 7) Incident runbook

When daily cycle fails:

1. Query `GET /api/monitoring/daily/status`
2. Inspect latest `JobRun.error` and metrics
3. Validate worker process/replica count and `SCHEDULER_ROLE`
4. Validate DB connectivity and provider dependencies
5. Run emergency cycle:
   - `POST /api/monitoring/daily/run` with monitoring token
6. Confirm resulting updates in alerts/savings routes

