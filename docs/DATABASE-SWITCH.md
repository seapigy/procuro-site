# Database switch: SQLite vs Supabase Postgres

Procuro’s backend uses **Prisma** with a single `DATABASE_URL`. The database in use is determined by:

1. The **provider** in `server/prisma/schema.prisma` (e.g. `postgresql` or `sqlite`).
2. The **value of `DATABASE_URL`** in `server/.env`.

No application logic, routes, or behavior change when you switch—only the storage backend.

---

## Using Supabase Postgres (default)

1. **Schema:** In `server/prisma/schema.prisma`, the datasource must use:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Env:** In `server/.env`, set (replace `<YOUR_PASSWORD>` with your Supabase database password). **Include `sslmode=require`** so external connections work:
   ```env
   DATABASE_URL="postgresql://postgres:<YOUR_PASSWORD>@db.bngttllppxpazivfgslv.supabase.co:5432/postgres?schema=public&sslmode=require"
   ```
   Best: copy the **Connection string (URI)** from Supabase Dashboard → **Project Settings → Database** (Session mode), paste into `.env` as `DATABASE_URL="..."`, replace `[YOUR-PASSWORD]` with your DB password, and add `&sslmode=require` before the closing quote if it’s not there.

3. **Apply migrations (first time or after new migrations):**
   ```bash
   cd server
   npx prisma migrate deploy
   ```
   Or run the script: `server/scripts/deploy-and-verify-db.ps1` (PowerShell).  
   If you see *Can't reach database server*, run these commands from your own machine (not in a sandbox) and ensure your Supabase project is not paused (Dashboard → Project Settings → General).

4. **Generate Prisma client (after changing schema or cloning):**
   ```bash
   cd server
   npx prisma generate
   ```

5. **Verify:** Start the server and hit a route that uses the DB (e.g. `GET /health`, `GET /api/test/status`). In Supabase Dashboard → Table Editor, confirm tables exist: `Company`, `User`, `Item`, `Price`, `Alert`, `SavingsSummary`, `Invite`, `PriceHistory`.

---

## Using SQLite locally (optional)

To run against a **local SQLite file** instead of Postgres (e.g. for offline dev):

1. **Schema:** In `server/prisma/schema.prisma`, set:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. **Env:** In `server/.env`:
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   ```
   (Or an absolute path like `file:C:/path/to/server/prisma/dev.db`.)

3. **Migrations:** From a clean SQLite DB, create and apply migrations:
   ```bash
   cd server
   npx prisma migrate dev --name init
   ```
   If you already have SQLite migrations in `prisma/migrations/`, run:
   ```bash
   npx prisma migrate deploy
   ```

4. **Generate client:**
   ```bash
   npx prisma generate
   ```

---

## Env and commands summary

| Goal                         | Env / schema | Commands |
|-----------------------------|--------------|----------|
| Use Supabase Postgres       | `provider = "postgresql"`, `DATABASE_URL` = Postgres URL | `npx prisma migrate deploy` then `npx prisma generate` |
| Use local SQLite            | `provider = "sqlite"`, `DATABASE_URL` = `file:./prisma/dev.db` | `npx prisma migrate dev` or `migrate deploy`, then `npx prisma generate` |
| Check migration status      | Any          | `npx prisma migrate status` (Postgres) |
| Inspect DB (no schema change)| Any          | `npx prisma db pull` (introspect); compare with schema for drift |

**Important:** Never commit `server/.env` or any file containing real passwords. The app reads only `server/.env`; keep it local and out of version control.
