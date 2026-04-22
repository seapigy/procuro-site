# ProcuroApp

A QuickBooks-integrated price-monitoring SaaS: import items, match retailers, check prices, and surface savings. Stack: **Node/Express/TypeScript** backend, **React/Vite** client, **Prisma** (PostgreSQL in production, SQLite optional locally).

## Quick start

1. **Prerequisites:** Node.js 18+, npm.

2. **Install:**

   ```bash
   npm run install:all
   ```

3. **Environment:** Copy [.env.example](.env.example) to **`server/.env`** and fill in values (database, QuickBooks, optional Stripe/Bright Data). For the client in production, see [client/.env.example](client/.env.example) and [client/DEPLOYMENT.md](client/DEPLOYMENT.md).

4. **Database** (from `server/`):

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

   Switching SQLite ↔ Postgres / Supabase: [docs/DATABASE-SWITCH.md](docs/DATABASE-SWITCH.md).

5. **Run** (two terminals from repo root):

   ```bash
   npm run dev:server
   npm run dev:client
   ```

   - API: `http://localhost:5000` — `GET /health`
   - UI: `http://localhost:5173`

## Documentation

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Repo map, commands, env — optimized for Cursor / AI |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local dev, testing, troubleshooting |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Price discovery, workers, test-route behavior |
| [server/README.md](server/README.md) | Backend, QuickBooks, Bright Data notes |
| [docs/DATABASE-SWITCH.md](docs/DATABASE-SWITCH.md) | Database configuration |
| [server/docs/tenancy.md](server/docs/tenancy.md) | Multi-tenant RLS and `withCompany` |
| [client/DEPLOYMENT.md](client/DEPLOYMENT.md) | Frontend env and hosting |

**QuickBooks App Store submission materials:** [docs/APP-SUBMISSION/](docs/APP-SUBMISSION/) and [docs/APP-REVIEWER-FLOW/](docs/APP-REVIEWER-FLOW/).

## Scripts (root)

| Script | Description |
|--------|-------------|
| `npm run dev:server` | Backend dev server |
| `npm run dev:client` | Frontend dev server |
| `npm run build` | Build server and client |
| `npm run start` | Start production server |
| `npm run install:all` | Install all workspaces |

**Windows (optional):** from repo root, [`start-backend.ps1`](start-backend.ps1) runs the API with `TEST_MODE` and a minimal `server/.env` if missing; [`stop-backend.ps1`](stop-backend.ps1) stops whatever is using port 5000. [`test-founder-demo.ps1`](test-founder-demo.ps1) smoke-tests local HTTP endpoints. Prisma helpers: `force-generate-prisma.ps1`, `complete-price-history-setup.ps1`, `run-pending-migrations.ps1`.

## Layout

```
ProcuroApp/
├── server/     # Express API, Prisma, providers, jobs
├── client/     # React app
├── providers/  # Legacy/shared retailer helpers (see server/src/providers for app code)
└── jobs/       # Scheduled tasks
```

## License

ISC
