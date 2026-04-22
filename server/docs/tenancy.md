# Multi-tenant isolation (RLS + app context)

## Tenant model

- **Tenancy key:** `Company.id` (integer). Every tenant-scoped row has a `companyId` column (FK to `Company.id`).
- **Company** is resolved from QuickBooks `realmId` (unique) or from the current user's `companyId`.
- **Per request:** the backend sets `req.companyId` via `companyContext` middleware (from test user or, later, JWT). All tenant DB access should run inside `withCompany(companyId, fn)` so RLS applies.

## How companyId is set per request

1. **Middleware** (`src/middleware/companyContext.ts`): runs on `/api`. Resolves the “current” user (e.g. test user by email) and sets `req.companyId = user.companyId`. In TEST_MODE, `X-Test-Company-Id` header can override.
2. **QuickBooks callback:** After resolving or creating `Company` by `realmId`, the handler uses that company’s `id` for the rest of the flow (e.g. `fetchAndStoreItems(user.id, company.id, ...)`).
3. **Test routes:** Use `testCompanyId` or `user.companyId` and pass that into `withCompany` when doing DB work.

## How `withCompany()` works

- **File:** `src/db/tenantDb.ts`
- **Usage:** `withCompany(companyId, async (tx) => { ... })`
- **Behavior:** Starts a Prisma transaction, runs `SELECT set_config('app.company_id', $1, true)` with `companyId` (as string), then runs your callback with the transaction client `tx`. All reads/writes inside the callback use the same DB session, so Postgres RLS sees `current_setting('app.company_id')::int` and restricts rows to that tenant.
- **Defense in depth:** Keep explicit `where: { companyId }` in queries; RLS still enforces if a filter is missed.

## RLS rule logic

- **Schema:** `app.current_company_id()` returns `current_setting('app.company_id', true)::integer` (null if not set).
- **Policies:** On `User`, `Item`, `Price`, `Alert`, `SavingsSummary`, `Invite`, `PriceHistory`:
  - **SELECT:** `"companyId" = app.current_company_id()` (or allow `companyId IS NULL` for User when setting is null).
  - **INSERT:** `WITH CHECK ("companyId" = app.current_company_id())`
  - **UPDATE:** `USING` and `WITH CHECK` same condition.
  - **DELETE:** `USING ("companyId" = app.current_company_id())`
- **Company table:** RLS is not enabled so login/connect can resolve company by `realmId`.

## Connection: direct vs session pooler

- **Direct** (`db.xxx.supabase.co:5432`): Same TCP connection for the whole transaction, so `set_config('app.company_id', ...)` is visible to RLS. Use this when you can; then run `rls_tenancy.sql` and `npm run test:rls`.
- **Session pooler** (e.g. `pooler.supabase.com:5432`): Connections are reused across requests; session variables don’t persist, so RLS cannot enforce. If you must use the pooler (e.g. direct connection fails with P1001), run **`server/sql/rls_disable_for_pooler.sql`** in Supabase SQL Editor once. Tenant isolation is then **application-only** (withCompany + `where: { companyId }`). Skip `npm run test:rls`.

## Adding a new tenant table safely

1. **Schema:** Add `companyId Int` (required) and `company Company @relation(...)` to the model; add `@@index([companyId])`.
2. **Migration:** Add the column (and backfill from existing relation if needed), then run migration.
3. **RLS:** In `server/sql/rls_tenancy.sql`, enable RLS on the table and add SELECT/INSERT/UPDATE/DELETE policies using `"companyId" = app.current_company_id()`. Re-run `npm run db:rls`.
4. **Code:** All creates/updates must set `companyId`. Use `withCompany(req.companyId, async (tx) => { ... })` in tenant-scoped routes and use `tx` for DB access.

## Commands

- **Apply RLS (Supabase):**  
  `npm run db:rls`  
  (reads `server/sql/rls_tenancy.sql` and `DATABASE_URL` from `.env`.)

- **Run RLS leak test:**  
  `npm run test:rls`  
  Creates two companies, one item each, and asserts that in Company A context only A’s rows are visible and that inserting with B’s companyId in A context is blocked.

## Order of operations

1. Run migrations so all tenant tables have `companyId` (e.g. `npx prisma migrate deploy` or apply the tenant-isolation migration in Supabase).
2. Run `npm run db:rls` to apply RLS policies.
3. Start the app; `companyContext` sets `req.companyId`; tenant routes use `withCompany(req.companyId, ...)` and explicit `where: { companyId }` for reads/writes.

## Practical setup (Supabase / Postgres)

From the `server/` directory (after `npm install`):

1. **Migrate:** `npx prisma migrate deploy` (or paste `server/prisma/migrations/.../migration.sql` into Supabase SQL Editor if the DB is not reachable locally).
2. **Prisma client:** `npx prisma generate`.
3. **RLS policies:** `npm run db:rls`, or run `server/sql/rls_tenancy.sql` in the Supabase SQL Editor.
4. **Mode:** For direct DB (`db.*.supabase.co`), RLS works; use `npm run test:rls`. For the **session pooler**, run `server/sql/rls_disable_for_pooler.sql` once and use application-only isolation; see **Connection: direct vs session pooler** above.
5. **Verify:** `npm run tenancy:verify` (runs `test:rls` when `TENANCY_ENFORCEMENT_MODE=rls`).

Optional: `npm run seed`, then `npm run dev` and check `GET http://localhost:5000/health` and `GET /api/items`.

If migration reports “column already exists”, the migration may already be applied—continue with `prisma generate` and RLS steps.
