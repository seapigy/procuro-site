# 🔧 LOCAL DEVELOPMENT GUIDE

**Procuro - Local Development & Testing**  
**Version:** 1.0.0  
**Last Updated:** November 12, 2025

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Running the Backend](#running-the-backend)
4. [Running the Frontend](#running-the-frontend)
5. [Database Management](#database-management)
6. [Cron Jobs & Workers](#cron-jobs--workers)
7. [Security Features](#security-features)
8. [Testing](#testing)
9. [Mock Data](#mock-data)
10. [Troubleshooting](#troubleshooting)

---

## 🚀 PREREQUISITES

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x+ | Runtime environment |
| npm | 9.x+ | Package manager |
| Git | Latest | Version control |
| SQLite | 3.x | Local database |

### Recommended Tools

- **Prisma Studio** - Database GUI (included)
- **VS Code** - IDE with TypeScript support
- **Postman** - API testing (optional)

---

## ⚙️ ENVIRONMENT SETUP

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/seapigy/procuro-site.git
cd ProcuroApp
```

### 2️⃣ Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 3️⃣ Environment Variables

Create `.env` file in `/server` directory:

```env
# Database
DATABASE_URL="file:../db/procuro.db"

# QuickBooks OAuth (Sandbox)
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here
QUICKBOOKS_REDIRECT_URI=http://localhost:5000/api/qb/callback
QUICKBOOKS_ENVIRONMENT=sandbox

# Security
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173
```

**⚠️ IMPORTANT:** Never commit `.env` to version control!

---

## 🖥️ RUNNING THE BACKEND

### Start Development Server

```bash
cd server
npm run dev
```

**Output:**
```
╔═══════════════════════════════════════════╗
║  🚀 Procuro Server v1.0.0                 ║
╚═══════════════════════════════════════════╝

📍 Server: http://localhost:5000
📊 Environment: development
💾 Database: SQLite (local)

⏰ Scheduled Tasks:
✅ Daily price check scheduled: 0 3 * * * (03:00)
✅ Token refresh scheduled: 0 2 * * * (02:00)

✅ Server ready and listening for requests
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run seed` | Seed database with test data |
| `npm run mockdata` | Load mock QuickBooks data |
| `npm test` | Run Jest test suite |

---

## 🎨 RUNNING THE FRONTEND

### Start Development Server

```bash
cd client
npm run dev
```

**Access:**
- Frontend: `http://localhost:5173`
- Dashboard: `http://localhost:5173/dashboard`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## 💾 DATABASE MANAGEMENT

### Prisma Commands

```bash
cd server

# Generate Prisma Client
npm run prisma:generate

# Create a new migration
npm run prisma:migrate

# Open Prisma Studio (GUI)
npm run prisma:studio
```

### Database Schema

**Location:** `server/prisma/schema.prisma`

**Tables:**
- `Company` - QuickBooks companies
- `User` - User accounts
- `Item` - Tracked items
- `Price` - Historical prices
- `Alert` - Price drop alerts
- `SavingsSummary` - Calculated savings
- `Invite` - Team invitations

### Prisma Studio

Access at `http://localhost:5555` after running:

```bash
npm run prisma:studio
```

**Features:**
- View all tables
- Edit records
- Run queries
- Export data

---

## ⏰ CRON JOBS & WORKERS

### Overview

Procuro uses `node-cron` for scheduled tasks. All workers are configured in `config/app.json`.

### 1️⃣ Daily Price Check Worker

**File:** `server/src/workers/dailyPriceCheck.ts`  
**Schedule:** Every day at 3:00 AM (configurable)  
**Cron:** `0 3 * * *`

**What it does:**
1. Fetches all tracked items
2. Checks current prices from providers
3. Compares to `lastPaidPrice`
4. Creates alerts if savings > threshold
5. Updates `SavingsSummary` table

**Manual Trigger:**
```typescript
import { runDailyPriceCheck } from './workers/dailyPriceCheck';
await runDailyPriceCheck();
```

**Log Output:**
```
🔍 Starting daily price check at 2025-11-12T03:00:00.000Z
📦 Found 6 items to check
✅ Alert created for BIC Pens: 12.49 → 11.49 (8.0% drop)
✅ Alert created for Copy Paper: 45.99 → 42.49 (7.6% drop)

✅ Daily price check completed in 2.3s
   📊 Items checked: 6
   🔔 Alerts created: 2
   ❌ Errors: 0
```

### 2️⃣ Token Refresh Worker

**File:** `server/src/workers/tokenRefresh.ts`  
**Schedule:** Every day at 2:00 AM (configurable)  
**Cron:** `0 2 * * *`

**What it does:**
1. Finds all users with QuickBooks connections
2. Uses `refresh_token` to get new `access_token`
3. Encrypts and saves new tokens
4. Updates `quickbooksConnectedAt` timestamp

**Manual Trigger:**
```typescript
import { runTokenRefresh } from './workers/tokenRefresh';
await runTokenRefresh();
```

**Log Output:**
```
🔄 Starting token refresh at 2025-11-12T02:00:00.000Z
👥 Found 3 users with QuickBooks connections
✅ Token refreshed for user: user@example.com
✅ Token refreshed for user: admin@example.com

✅ Token refresh completed in 1.8s
   ✅ Tokens refreshed: 2
   ❌ Errors: 0
```

### Configuration

**File:** `config/app.json`

```json
{
  "scheduling": {
    "priceCheckTime": "03:00",
    "priceCheckCron": "0 3 * * *",
    "tokenRefreshTime": "02:00",
    "tokenRefreshCron": "0 2 * * *"
  },
  "pricing": {
    "priceDropThreshold": 0.05,
    "minimumSavingsAmount": 0.50
  },
  "features": {
    "enableDailyPriceCheck": true,
    "enableTokenRefresh": true
  }
}
```

**Disable Cron Jobs:**
```json
{
  "features": {
    "enableDailyPriceCheck": false,
    "enableTokenRefresh": false
  }
}
```

---

## 🔒 SECURITY FEATURES

### Token Encryption

**File:** `server/src/utils/crypto.ts`  
**Algorithm:** AES-256-GCM with PBKDF2 key derivation

**How it works:**
1. Generates random salt (64 bytes)
2. Derives key using PBKDF2 (100,000 iterations)
3. Encrypts with AES-256-GCM
4. Returns base64: `salt:iv:tag:encrypted`

**Usage:**
```typescript
import { encrypt, decrypt, encryptTokens } from './utils/crypto';

// Single string
const encrypted = encrypt('my-secret-token');
const decrypted = decrypt(encrypted);

// QuickBooks tokens
const { accessToken, refreshToken } = encryptTokens(
  'access_token_here',
  'refresh_token_here'
);
```

**Security Notes:**
- ⚠️ Must set `ENCRYPTION_KEY` in `.env`
- ✅ Tokens stored encrypted in database
- ✅ Auto-decrypted on read
- ✅ Uses authenticated encryption (GCM)

### Error Handling

**File:** `server/src/middleware/errorHandler.ts`

**Features:**
- Centralized error handling
- Structured JSON responses
- Development vs production modes
- Request logging with timestamps

**Response Format:**
```json
{
  "status": "error",
  "message": "Item not found",
  "route": "GET /api/items/999",
  "stack": "Error stack (dev only)"
}
```

---

## 🧪 TESTING

### Run Test Suite

```bash
cd server
npm test
```

**Test Coverage:**
- ✅ Health endpoint
- ✅ Error handling middleware
- ✅ Crypto utilities (encrypt/decrypt)
- ✅ App configuration loading
- ✅ JSON response formats

**Expected Output:**
```
 PASS  __tests__/api.test.ts
  API Test Suite
    Health Endpoint
      ✓ should return 200 OK (45ms)
      ✓ should return correct health status format (12ms)
      ✓ should return current timestamp (8ms)
    Error Handling
      ✓ should return 404 for non-existent routes (15ms)
      ✓ should return correct error format (10ms)
    Test Endpoint
      ✓ should return test message (8ms)
    JSON Response Format
      ✓ should return valid JSON (6ms)
      ✓ should have correct content-type header (7ms)
  Crypto Utilities
    ✓ should encrypt and decrypt text correctly (142ms)
    ✓ should detect encrypted strings (68ms)
    ✓ should handle null values (5ms)
  Configuration
    ✓ should load app config correctly (3ms)
    ✓ should have valid scheduling config (2ms)
    ✓ should have valid pricing config (2ms)

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
Snapshots:   0 total
Time:        3.456 s

✅ All API tests passed
```

### Test Configuration

**File:** `server/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  testTimeout: 10000
};
```

---

## 🌱 MOCK DATA

### Load Mock Data

```bash
cd server
npm run mockdata
```

**What it creates:**
- 1 test company
- 1 test user (`mockuser@procuroapp.com`)
- 6 realistic items with vendors
- 18 price records (3 retailers per item)
- Price alerts for items with 5%+ savings
- Savings summary

**Output:**
```
🌱 Loading mock data for local testing...

✅ Company created: Mock Test Company LLC
✅ User created: mockuser@procuroapp.com
🧹 Cleared existing mock items

📦 Creating mock items...
   🔔 Alert created for BIC Pens (8.0% savings)
   🔔 Alert created for Copy Paper (7.6% savings)
   ✅ Staples Copy Paper, 8.5" x 11", Case
   ✅ BIC Round Stic Ballpoint Pens, Medium Point, Black, Box of 60
   ✅ Post-it Notes, 3" x 3", Canary Yellow, 12 Pads
   ✅ HP 64 Black/Tri-Color Ink Cartridges, 2/Pack
   ✅ Fellowes Powershred P-35C Cross-Cut Shredder
   ✅ Lysol Disinfecting Wipes, Lemon, 80 Wipes

💰 Savings summary created: $12.48/month

✅ Mock data loaded successfully!

📊 Summary:
   - Items: 6
   - Prices: 18
   - Alerts: 2
   - Estimated Monthly Savings: $12.48

🔐 Test Login:
   Email: mockuser@procuroapp.com

👉 Open http://localhost:5173/dashboard to view mock data
```

**File:** `server/scripts/loadMockData.ts`

---

## 🔍 API ENDPOINTS

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "db": true,
  "version": "1.0.0",
  "time": "2025-11-12T10:30:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

### Items

```http
GET /api/items
```

### Alerts

```http
GET /api/alerts
GET /api/alerts/unreadCount
POST /api/alerts/markAllSeen
```

### Savings Summary

```http
GET /api/savings-summary
```

### Company & Invites

```http
POST /api/company/invite
GET /api/invite/:token
POST /api/invite/:token/accept
```

### QuickBooks

```http
GET /api/qb/connect
GET /api/qb/callback
GET /api/qb/items
```

---

## 🐛 TROUBLESHOOTING

### Issue: Server won't start

**Error:** `EADDRINUSE: address already in use :::5000`

**Solution:**
```bash
# Find process on port 5000
npx kill-port 5000

# Or change PORT in .env
PORT=5001
```

### Issue: Database locked

**Error:** `database is locked`

**Solution:**
```bash
# Close Prisma Studio
# Stop all server instances
# Delete lock file
rm db/*.db-journal
```

### Issue: Prisma Client not generated

**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
cd server
npm run prisma:generate
```

### Issue: Encryption key warning

**Warning:** `ENCRYPTION_KEY not set in .env`

**Solution:**
```bash
# Generate a secure key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
ENCRYPTION_KEY=your_generated_key_here
```

### Issue: Cron jobs not running

**Check:**
```typescript
// Verify in config/app.json
{
  "features": {
    "enableDailyPriceCheck": true,
    "enableTokenRefresh": true
  }
}
```

### Issue: Mock data not visible

**Solution:**
```bash
# Reload mock data
npm run mockdata

# Open Prisma Studio to verify
npm run prisma:studio
```

---

## 📝 DEVELOPMENT WORKFLOW

### 1️⃣ Daily Development

```bash
# Start backend (terminal 1)
cd server
npm run dev

# Start frontend (terminal 2)
cd client
npm run dev

# Open Prisma Studio (terminal 3 - optional)
cd server
npm run prisma:studio
```

### 2️⃣ Making Changes

**Backend Changes:**
1. Edit TypeScript files in `server/src/`
2. Server auto-reloads with `tsx watch`
3. Check console for errors

**Frontend Changes:**
1. Edit React components in `client/src/`
2. Vite hot-reloads automatically
3. Check browser console

**Database Changes:**
1. Edit `server/prisma/schema.prisma`
2. Run `npm run prisma:migrate`
3. Regenerate client: `npm run prisma:generate`

### 3️⃣ Testing Changes

```bash
# Run backend tests
cd server
npm test

# Test API manually
curl http://localhost:5000/health

# Load mock data
npm run mockdata
```

### 4️⃣ Debugging

**Backend:**
- Check server console for errors
- Use `console.log()` or VS Code debugger
- Check Prisma Studio for database state

**Frontend:**
- Use browser DevTools
- Check Network tab for API calls
- Use React DevTools extension

---

## 📚 ADDITIONAL RESOURCES

### Documentation

- [Prisma Docs](https://www.prisma.io/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Procuro Docs

- `THEME.md` - Design system reference
- `UI-POLISH.md` - UI implementation guide
- `DATABASE-SCHEMA-COMPLETE.md` - Database documentation
- `INVITE-FLOW.md` - Invite system guide

---

## ✅ CHECKLIST: READY FOR DEVELOPMENT

- [ ] Node.js 18+ installed
- [ ] Repository cloned
- [ ] Dependencies installed (backend + frontend)
- [ ] `.env` file created with all variables
- [ ] Database migrated (`npm run prisma:migrate`)
- [ ] Mock data loaded (`npm run mockdata`)
- [ ] Backend server running (`npm run dev`)
- [ ] Frontend server running (`npm run dev`)
- [ ] Health check returns 200 OK
- [ ] Prisma Studio accessible
- [ ] Dashboard loads at http://localhost:5173

---

**Questions? Issues?**  
Contact: support@procuroapp.com

**Last Updated:** November 12, 2025  
**Document Version:** 1.1.0 (with Optional Add-ons)

---

## 🎁 OPTIONAL LOCAL ADD-ONS (v1.1)

### New Features Added

1. **Inline Editing for Items** - Edit item details directly in table
2. **Quick Search/Filter** - Real-time client-side filtering
3. **Top Vendors Chart** - Analytics showing best retailers
4. **Auto-Check Toggle** - Control automatic price checks
5. **Database Backup** - Download local SQLite file

---

### 1️⃣ Inline Editing

**Location:** Items page (`/dashboard/items`)

**Usage:**
- Click any editable field (name, vendor, SKU, category, price)
- Field converts to input
- Edit value
- Click ✓ (save) or ✕ (cancel)
- Row highlights green on successful save

**API:** `PATCH /api/items/:id`

**Features:**
- Input validation
- Real-time UI updates
- Success feedback
- Error handling

---

### 2️⃣ Quick Search

**Location:** Items page (search bar above table)

**Usage:**
- Type in search field
- Results filter instantly
- Searches: name, vendor, SKU, category
- Click ✕ to clear
- Last search persists (localStorage)

**No Backend Required:** Client-side filtering

---

### 3️⃣ Top Vendors Chart

**Location:** Reports page

**Display:**
- Horizontal bar chart
- Top 5 vendors by savings
- Gradient bars (blue → green)
- Savings amount per vendor
- Auto-updates with new data

**Data Source:** Aggregates alerts by retailer

---

### 4️⃣ Auto-Check Toggle

**Location:** Settings modal

**Purpose:** Enable/disable automatic daily price checks

**Usage:**
1. Open Settings (⚙️ icon)
2. Find "Automatic Price Checking"
3. Toggle switch ON/OFF
4. Click "Save Settings"

**Technical:**
- Saves to localStorage
- Cron worker checks config
- If disabled, price checks skipped

**Config:**
```json
{
  "autoCheckEnabled": true/false
}
```

---

### 5️⃣ Database Backup

**Location:** Settings modal → "Database Backup"

**Usage:**
1. Open Settings
2. Scroll to "Database Backup"
3. Click "Download Backup"
4. File downloads: `procuro-backup-YYYY-MM-DD.sqlite`

**API:** `GET /api/backup`

**File Contents:**
- All tables (Company, User, Item, Price, Alert, etc.)
- Full database snapshot
- Can be restored by replacing `db/procuro.db`

**Restore Process:**
```bash
# Stop server first
# Backup current DB
mv db/procuro.db db/procuro.db.old

# Copy downloaded backup
cp ~/Downloads/procuro-backup-2025-11-12.sqlite db/procuro.db

# Restart server
npm run dev
```

---


