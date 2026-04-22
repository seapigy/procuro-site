# ProcuroApp Server

Backend server for ProcuroApp with QuickBooks integration. For repo-wide commands and env layout, see **[../AGENTS.md](../AGENTS.md)** and **[../docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)**.

## Database (SQLite vs Supabase Postgres)

The app uses **Prisma**; the backend is wired for **Supabase Postgres** by default. No code or routes change when switching DB—only the datasource and env.

- **Supabase Postgres:** Set `DATABASE_URL` in `server/.env` to your Postgres URL. Then run `npx prisma migrate deploy` and `npx prisma generate`.
- **Local SQLite:** In `prisma/schema.prisma` set `provider = "sqlite"` and `DATABASE_URL="file:./prisma/dev.db"`, then run `npx prisma migrate dev` (or `migrate deploy`) and `npx prisma generate`.

Full details, env vars, and verification: **[docs/DATABASE-SWITCH.md](../docs/DATABASE-SWITCH.md)**.

### Supabase deploy verification (PR / release checklist)

When you ship schema or tenancy-related changes:

1. Run **`npx prisma migrate deploy`** from `server/` against the target DB using the same **`DATABASE_URL`** style (direct `db.*.supabase.co` vs pooler) you use in production.
2. Confirm **`_prisma_migrations`** includes new entries (or apply generated SQL in the Supabase SQL Editor if that is your process—see **docs/SUPABASE-P1001-FIX.md**).
3. Smoke-test **RLS / tenant isolation** (two companies, or `server/scripts/test-rls-leak.ts` if configured).
4. After QuickBooks import changes, **re-run import** on a staging company and spot-check **`Item.lastPaidPrice`** (per-unit) and **`companyId`** on rows.

## QuickBooks Integration

### Setup

1. **Get QuickBooks API Credentials:**
   - Go to [Intuit Developer Portal](https://developer.intuit.com/)
   - Create an app and get your Client ID and Client Secret
   - Add redirect URI: `http://localhost:5000/api/qb/callback`

2. **Configure Environment Variables:**
   ```bash
   QUICKBOOKS_CLIENT_ID=your_client_id
   QUICKBOOKS_CLIENT_SECRET=your_client_secret
   QUICKBOOKS_REDIRECT_URI=http://localhost:5000/api/qb/callback
   QUICKBOOKS_ENVIRONMENT=sandbox
   ```

3. **Run Database Migrations (Supabase Postgres):**
   ```bash
   cd server
   npx prisma migrate deploy
   npx prisma generate
   ```
   (For local SQLite or first-time init, see [docs/DATABASE-SWITCH.md](../docs/DATABASE-SWITCH.md).)

4. **Seed Test User:**
   ```bash
   npm run seed
   ```

### QuickBooks OAuth Flow

The integration implements OAuth 2.0 flow with three endpoints:

#### 1. **GET /api/qb/connect**
Initiates OAuth flow. Redirects user to QuickBooks login.

```bash
# Open in browser:
http://localhost:5000/api/qb/connect
```

#### 2. **GET /api/qb/callback**
Handles OAuth callback after user authorizes the app.
- Exchanges authorization code for access tokens
- Stores tokens in database (User model)
- Automatically fetches last 100 purchase/bill items
- Stores items in database (Item model)

#### 3. **GET /api/qb/items**
Lists imported items for the current company-context user.

```bash
curl http://localhost:5000/api/qb/items
```

Response:
```json
{
  "success": true,
  "user": {
    "email": "test@procuroapp.com",
    "name": "Test User",
    "quickbooksConnected": true,
    "connectedAt": "2025-10-31T12:00:00.000Z"
  },
  "itemCount": 42,
  "items": [
    {
      "id": "cm123...",
      "name": "Office Supplies",
      "category": "Supplies",
      "lastPaidPrice": 45.99,
      "date": "2025-10-15T00:00:00.000Z",
      "createdAt": "2025-10-31T12:00:00.000Z",
      "updatedAt": "2025-10-31T12:00:00.000Z",
      "userId": "cm456..."
    }
  ]
}
```

### Database Schema

The QuickBooks integration uses the following models:

**User Model:**
- `quickbooksAccessToken` - OAuth access token
- `quickbooksRefreshToken` - OAuth refresh token
- `quickbooksRealmId` - QuickBooks company ID
- `quickbooksConnectedAt` - Connection timestamp

**Item Model:**
- `name` - Item/expense name
- `category` - Item category or account
- `lastPaidPrice` - Amount paid
- `date` - Transaction date
- `userId` - Associated user

### User Context

QuickBooks routes now resolve the acting user from company context (`req.companyContextUser` / `req.companyId`).
In `TEST_MODE`, the configured test email is used only as an explicit fallback.

### Data Fetched

The integration fetches the last 100 Purchase transactions from QuickBooks, including:
- Item-based expenses (products/services purchased)
- Account-based expenses (general expenses)

Current behavior is **purchase-derived import**:
- Item rows are inferred from purchase line items.
- Vendor information comes from `Purchase.VendorRef` when present.
- There is no separate direct QuickBooks `Item` catalog sync endpoint yet.
- There is no separate direct QuickBooks `Vendor` list sync endpoint yet.

Each line item is stored separately with:
- Item name or description
- Category/class/account
- Amount paid
- Transaction date

### Security Middleware

The server includes production-ready security middleware:

#### Rate Limiting

API rate limiting is applied to all `/api` routes using `express-rate-limit`:
- **Window:** 15 minutes
- **Max requests:** 100 requests per IP per window
- **Scope:** Only `/api` routes (health endpoint and static files are not rate limited)

When rate limit is exceeded, the server returns:
```json
{
  "message": "Too many requests from this IP, please try again later."
}
```

Rate limit information is included in response headers:
- `RateLimit-Limit`: Maximum number of requests allowed
- `RateLimit-Remaining`: Number of requests remaining in current window
- `RateLimit-Reset`: Time when the rate limit resets

#### Security Headers

All responses include standard security headers:
- **X-Content-Type-Options:** `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options:** `SAMEORIGIN` - Prevents clickjacking attacks
- **Referrer-Policy:** `strict-origin-when-cross-origin` - Controls referrer information
- **Content-Security-Policy:** Minimal CSP allowing same-origin resources and external API connections

These headers are applied to all routes automatically.

### Production Considerations

For production deployment:

1. **User Authentication:** Replace test user with actual authenticated users
2. **State Parameter:** Use secure random state in OAuth flow
3. **Token Refresh:** Implement token refresh logic (QuickBooks tokens expire)
4. **Error Handling:** Add comprehensive error handling and logging
5. **Rate Limiting:** ✅ Implemented - 100 requests per 15 minutes per IP
6. **Security Headers:** ✅ Implemented - Standard security headers on all responses
7. **Webhook Support:** Consider QuickBooks webhooks for real-time updates

### Troubleshooting

**"Test user not found":**
```bash
npm run seed
```

**"Invalid client credentials":**
- Verify `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET` in `.env`
- Check redirect URI matches exactly in Intuit Developer Portal

**"No data returned":**
- Make sure you have Purchase transactions in your QuickBooks sandbox
- Check QuickBooks Sandbox has test data

**Database errors:**
```bash
npm run prisma:migrate
npm run prisma:generate
```

## Bright Data Integration (Amazon Price Data)

For Amazon product price data via Bright Data Datasets API:

1. **Set environment variables** in `server/.env`:
   ```bash
   BRIGHTDATA_API_KEY=your_api_key
   BRIGHTDATA_DATASET_ID=your_dataset_id
   # Or use legacy: BRIGHTDATA_AMAZON_DATASET_ID
   # Optional: BRIGHTDATA_API_HOST=https://api.brightdata.com
   # Optional: BRIGHTDATA_ENABLED=true  # Explicitly enable (otherwise inferred from vars)
   ```

## Scheduler Topology (SaaS)

For production, avoid local-machine dependency by running backend on always-on hosting.

Use `SCHEDULER_ROLE` to control cron ownership:

- `api` - API-only process (no cron schedulers)
- `worker` - scheduler-authoritative process (runs cron)
- `all` - API + cron in one process
- `off` - no scheduler (diagnostic mode)

Recommended multi-replica setup:

- API deployment replicas: `SCHEDULER_ROLE=api`
- Single worker deployment replica: `SCHEDULER_ROLE=worker`

Operational endpoints:

- `GET /api/monitoring/daily/status`
- `POST /api/monitoring/daily/run`

In production these require `x-monitoring-token` matching `MONITORING_ADMIN_TOKEN`.

2. **Startup behavior:** If `BRIGHTDATA_ENABLED=true` but `BRIGHTDATA_API_KEY` or `BRIGHTDATA_DATASET_ID` is missing, the server will fail to start with a clear error.

3. **Test endpoint:** `POST /api/debug/brightdata` with body `{ "url": "https://www.amazon.com/dp/...", "itemId": 123 }` to validate integration. Returns `{ snapshotId, rowCount, sampleRowKeys, normalizedPrice }`. Remove before production.




