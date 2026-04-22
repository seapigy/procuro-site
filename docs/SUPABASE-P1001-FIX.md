# Fix: P1001 Can't reach database server (Supabase)

If you get **P1001** when running `npx prisma migrate deploy` or starting the app, try these in order.

---

## 1. Check Supabase project is running

- Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
- If you see **“Project paused”**, click **Restore project** and wait a minute.
- Free-tier projects pause after inactivity; they must be restored before any connection works.

---

## 2. Use the correct connection string

- In Supabase: **Project Settings** (gear) → **Database**.
- Under **Connection string**, choose **URI**.
- Use **“Session mode”** (direct, port **5432**) for migrations and for the app if you’re not using the pooler.
- Copy the URI. It looks like:
  `postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`
  or for **direct**:  
  `postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres`
- In `server/.env` set:
  ```env
  DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.bngttllppxpazivfgslv.supabase.co:5432/postgres?schema=public&sslmode=require"
  ```
- Replace `YOUR_PASSWORD` with your **Database password** (from the same Database settings page). If the password has `@`, `#`, `%`, `/`, encode them (e.g. `@` → `%40`).

---

## 3. Try port 6543 (connection pooler)

Some networks block port 5432 but allow 6543.

- In **Database** → **Connection string** → **URI**, switch to **“Transaction”** (pooler) and copy the URI (port **6543**).
- In `server/.env`:
  ```env
  DATABASE_URL="postgresql://postgres.[project-ref]:YOUR_PASSWORD@aws-0-[region].pooler.supabase.com:6543/postgres?schema=public&pgbouncer=true&sslmode=require"
  ```
- **Important:** Migrations cannot be run with the pooler. Use **Option B** below to create tables, then use this URL only for the app.

---

## 4. Check firewall / antivirus

- Temporarily allow outbound **TCP 5432** (and 6543 if using pooler) to `*.supabase.co` and `*.pooler.supabase.com`.
- Test from PowerShell:
  ```powershell
  Test-NetConnection -ComputerName db.bngttllppxpazivfgslv.supabase.co -Port 5432
  ```
  If `TcpTestSucceeded` is **False**, something is blocking the connection.

---

## Option B: Create tables in Supabase (no port 5432 from your PC)

If you can’t get port 5432 or 6543 to work from your machine, create the schema inside Supabase so the app can use the DB.

### Step 1: Run the migration SQL in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor**.
3. Open this file in your repo:  
   `server/prisma/migrations/20260206150037_init/migration.sql`  
   Copy its **entire** contents.
4. Paste into the SQL Editor and click **Run**.
5. You should see “Success. No rows returned.” and the tables (Company, User, Item, etc.) in **Table Editor**.

### Step 2: Mark the migration as applied (so Prisma doesn’t try to re-run it)

1. In **SQL Editor**, run this **once** (creates Prisma’s migration table and marks the init migration as applied):

```sql
-- Create Prisma migrations table if not exists (Prisma 4+ schema)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- Mark init migration as applied (checksum = SHA256 of migration.sql)
INSERT INTO "_prisma_migrations" (
  "id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count"
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '3df70847f82dad04bacda99bfb8643f79eed75bbd57a923af1f5488ca1966f08',
  now(),
  '20260206150037_init',
  NULL,
  NULL,
  now(),
  1
);
```

(If you get “duplicate key” because the row already exists, that’s fine — the migration is already marked applied.)

### Step 3: Use the app

- Keep `DATABASE_URL` in `server/.env` pointing at Supabase (Session mode with `sslmode=require`, or Transaction mode with `pgbouncer=true` if you’re on 6543).
- Run the server (e.g. `npm run dev` from `server/`). It should connect and use the tables you created.

Later, when you have a network where port 5432 works, you can run `npx prisma migrate deploy` again; Prisma will see the migration as already applied and do nothing.
