# 🧪 DEV PROVIDER TESTING GUIDE

## 🎯 OVERVIEW

This guide explains how to test **real provider functionality** using the custom domain `dev.procuroapp.com`, which bypasses CORS restrictions that occur with `localhost`.

---

## 🌐 DNS SETUP

### What Was Done:
1. **GoDaddy DNS** configured to point `dev.procuroapp.com` → `127.0.0.1`
2. **Local hosts file** (Windows) updated:
   ```
   127.0.0.1  dev.procuroapp.com
   ```

### Why This Works:
- Browsers treat `dev.procuroapp.com` as a **real domain** (not localhost)
- Retailers like Walmart/Target may allow CORS requests from real domains
- Even if blocked, error handling is cleaner and debugging is easier

---

## 🚀 STARTING THE DEV ENVIRONMENT

### Option 1: Manual Start (Recommended)

#### 1. Start Backend Server
```bash
cd server
npm run dev
```

**Wait for:**
```
╔═══════════════════════════════════════════╗
║  🚀 Procuro Server v1.0.0                 ║
╚═══════════════════════════════════════════╝

📍 Server: http://localhost:5000
✅ Server ready and listening for requests
```

#### 2. Start Frontend Server (New Terminal)
```bash
cd client
npm run dev
```

**Wait for:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://dev.procuroapp.com:5173/
  ➜  Network: http://192.168.1.x:5173/
  ➜  press h + enter to show help
```

**Note:** Frontend now runs on `dev.procuroapp.com:5173` (not `localhost:5173`)

---

### Option 2: Batch File (Windows)

```bash
start-procuro.bat
```

This will:
1. Start backend on `localhost:5000`
2. Start frontend on `dev.procuroapp.com:5173`
3. Open browser automatically

---

## 🔗 ACCESSING THE APP

### ✅ Correct URLs:

| Page | URL |
|------|-----|
| **Dashboard** | `http://dev.procuroapp.com:5173/` |
| **Items** | `http://dev.procuroapp.com:5173/items` |
| **Reports** | `http://dev.procuroapp.com:5173/reports` |
| **Settings** | `http://dev.procuroapp.com:5173/settings` |
| **Provider Test** | `http://dev.procuroapp.com:5173/provider-test` |
| **QA Suite** | `http://dev.procuroapp.com:5173/qa` |

### ❌ Don't Use:
- `http://localhost:5173` → May have CORS issues
- `http://127.0.0.1:5173` → May have CORS issues

**Always use:** `http://dev.procuroapp.com:5173`

---

## 🧪 TESTING PROVIDERS

### Step 1: Open Provider Test Page

Navigate to:
```
http://dev.procuroapp.com:5173/provider-test
```

### Step 2: Create Test Item

Fill in the form:
```
Item Name: ASUDESIRE 3 Pack Men's Sweatpants
SKU: [leave empty]
Vendor: [leave empty]
Last Paid Price: 49.99
Category: [leave empty]
```

Click: **"Create Test Item"**

**Expected Result:**
- ✅ Alert: "Test item created with ID: X"
- ✅ Item appears in table
- ✅ Item is auto-selected (blue row)

---

### Step 3: Test Walmart Provider

**Keyword:** `ASUDESIRE 3 Pack Men's Sweatpants` (pre-filled)

Click: **"Test Walmart"**

**What Happens:**
1. Browser fetches directly from `https://www.walmart.com/search?q=...`
2. Provider extracts JSON from HTML
3. Results display in middle column
4. Raw HTML appears in right column
5. Debug info shows validation status

**Expected Results:**

#### Scenario A: Success (Rare from dev)
```
✅ Parsed Results
Walmart
$29.99 (or actual price)
Title: ASUDESIRE 3 Pack Men's Sweatpants...
URL: https://www.walmart.com/ip/...
Stock: ✅ In Stock

🐛 Debug Info
Provider: Walmart
URL: https://www.walmart.com/search?q=...
HTML Size: 238.41 KB
Timestamp: 11/14/2025, 5:30:22 PM
Valid HTML: ✅ YES
```

#### Scenario B: CORS Blocked (Expected)
```
⚠️ ERROR MESSAGE
Provider Error: Failed to fetch
OR
⚠️ Provider returned null price.

🐛 Debug Info
Provider: Walmart
URL: https://www.walmart.com/search?q=...
HTML Size: 0.00 KB
Timestamp: 11/14/2025, 5:30:22 PM
Valid HTML: ❌ NO
Error: Fetch failed
```

**This is NORMAL!** Even `dev.procuroapp.com` may be blocked by Walmart's CORS policy.

---

### Step 4: Save Result to Database

**If you got a result** (even with null price):

1. Ensure test item is selected (blue row)
2. Click: **"Save Result to Database"**

**Expected Result:**
- ✅ Success message: "Saved! Check DB Inspector for updates."
- ✅ Alert generated (if price is lower than $49.99)

---

### Step 5: Verify in DB Inspector

1. Open: `http://dev.procuroapp.com:5173/qa`
2. Click: **"DB Inspector"** tab
3. Click: **"Prices"** → Verify new row
4. Click: **"Alerts"** → Verify new alert (if price was lower)

**Expected DB Inspector:**
```
Prices (1 record):
ID | itemId | retailer | price | createdAt
1  | 1      | Walmart  | null  | 2025-11-14...

Alerts (1 record):
ID | itemId | message              | createdAt
1  | 1      | Price drop detected  | 2025-11-14...
```

---

## 🧪 TESTING ALL 6 PROVIDERS

### Provider URLs

| Provider | Test Button | Search URL |
|----------|-------------|------------|
| **Walmart** | Test Walmart | `https://www.walmart.com/search?q=...` |
| **Target** | Test Target | `https://www.target.com/s?searchTerm=...` |
| **Home Depot** | Test Home Depot | `https://www.homedepot.com/s/...` |
| **Lowes** | Test Lowes | `https://www.lowes.com/search?searchTerm=...` |
| **Staples** | Test Staples | `https://www.staples.com/search?query=...` |
| **Office Depot** | Test Office Depot | `https://www.officedepot.com/catalog/search.do?Ntt=...` |

### Testing Each Provider:

```
For each provider:
1. Enter keyword (e.g., "HP Printer Paper")
2. Click "Test [Provider]"
3. Verify Debug Info appears
4. Check:
   - HTML Size > 0 KB (success) or = 0 KB (CORS blocked)
   - Valid HTML: ✅ YES or ❌ NO
   - Price: number or null
5. If result has price, save to database
```

---

## 🔍 DEBUGGING CORS ISSUES

### Check Browser Console

Open DevTools (F12) → Console

#### Expected Messages:

✅ **Provider Logs:**
```
🔍 Walmart (Browser): Searching for "..."
📡 Fetching raw HTML from: https://www.walmart.com/...
✅ Walmart: Found "..." at $29.99
```

⚠️ **CORS Warnings (Expected):**
```
Access to fetch at 'https://www.walmart.com/...' 
blocked by CORS policy: No 'Access-Control-Allow-Origin'
```

**This is NORMAL!** The provider code handles it gracefully.

---

### Check Backend Logs

In the terminal where backend is running:

✅ **Expected:**
```
POST /api/store-price 200 45ms
POST /api/alerts/generate 200 12ms
```

❌ **CORS Issues:**
```
⚠️ CORS blocked origin: http://some-other-domain.com
```

**Fix:** Check `server/src/index.ts` `allowedOrigins` array.

---

## 📊 VIEWING DB CHANGES

### Method 1: DB Inspector (QA Page)

1. Open: `http://dev.procuroapp.com:5173/qa`
2. Click: **"DB Inspector"** tab
3. Select table: **Users, Companies, Items, Prices, Alerts, Savings**
4. View records in formatted table

**Features:**
- 📊 View all records
- 🗑️ Clear database
- 🔄 Re-seed mock data
- 💾 Download backup

---

### Method 2: Prisma Studio

```bash
cd server
npx prisma studio
```

Opens: `http://localhost:5555`

**View:**
- All tables
- Edit records
- Run queries

---

### Method 3: Direct Database Query

```bash
cd server
npx prisma db browse
```

Or use SQLite browser:
```bash
sqlite3 server/prisma/dev.db
.tables
SELECT * FROM Price;
SELECT * FROM Alert;
```

---

## ✅ VALIDATING ALERTS

### How Alerts Are Generated:

1. User tests provider (e.g., Walmart)
2. Provider returns price (e.g., $29.99)
3. User clicks "Save Result to Database"
4. Backend:
   - Saves price to `Price` table
   - Compares: `newPrice ($29.99) < lastPaidPrice ($49.99)`
   - Generates alert: "Price drop detected: Save $20.00 (40%)"
   - Updates `SavingsSummary`

### Verifying Alerts Work:

#### Step 1: Create Item with HIGH price
```
Name: Test Item
Last Paid Price: 99.99
```

#### Step 2: Test Provider
```
Keyword: HP Printer Paper
Provider: Walmart
Expected Result: $29.99 (or any price < $99.99)
```

#### Step 3: Save Result
```
Click: "Save Result to Database"
```

#### Step 4: Check Alerts
```
Go to: /qa → DB Inspector → Alerts
Expected: New alert with savings calculation
```

**Example Alert:**
```
{
  "id": 1,
  "itemId": 1,
  "message": "💰 Price drop detected for Test Item: Save $70.00 (70%)",
  "severity": "high",
  "seen": false,
  "createdAt": "2025-11-14T17:45:22Z"
}
```

---

## 🛠️ CONFIGURATION DETAILS

### Vite Config (`client/vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: 'dev.procuroapp.com', // Custom domain
    port: 5173,
    strictPort: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

**Key Points:**
- `host: 'dev.procuroapp.com'` → Binds to custom domain
- `proxy: '/api'` → Routes API calls to backend
- `cors: true` → Enables CORS for development

---

### Backend CORS (`server/src/index.ts`)

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://dev.procuroapp.com:5173',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
};
```

**Key Points:**
- Allows `dev.procuroapp.com:5173`
- Allows `localhost:5173` (fallback)
- Logs blocked origins for debugging

---

## 🧪 QUICKBOOKS EMBED TESTING

### URLs to Test:

```
http://dev.procuroapp.com:5173/dashboard
http://dev.procuroapp.com:5173/items
http://dev.procuroapp.com:5173/reports
```

### QuickBooks OAuth Flow:

1. Click: **"Connect QuickBooks"** in Dashboard
2. Redirects to: `/api/qb/connect`
3. Backend redirects to: `https://appcenter.intuit.com/connect/oauth2`
4. User logs in to QuickBooks
5. Callback: `/api/qb/callback`
6. Tokens saved (encrypted)
7. User redirected to Dashboard

**Expected:**
- ✅ OAuth flow completes
- ✅ Tokens saved to database
- ✅ Dashboard shows "Connected" status

---

## 📝 TROUBLESHOOTING

### Problem: "Can't reach page" at dev.procuroapp.com

**Solution:**

1. Check DNS:
   ```bash
   ping dev.procuroapp.com
   # Should return: 127.0.0.1
   ```

2. Check hosts file (Windows):
   ```
   C:\Windows\System32\drivers\etc\hosts
   
   Should contain:
   127.0.0.1  dev.procuroapp.com
   ```

3. Restart browser (clear DNS cache)

---

### Problem: Vite still binding to localhost

**Solution:**

1. Stop frontend server (Ctrl+C)
2. Clear Vite cache:
   ```bash
   cd client
   rm -rf node_modules/.vite
   ```
3. Restart:
   ```bash
   npm run dev
   ```

---

### Problem: Backend CORS errors

**Solution:**

Check backend logs for:
```
⚠️ CORS blocked origin: http://...
```

Ensure `allowedOrigins` includes the origin:
```typescript
// server/src/index.ts
const allowedOrigins = [
  'http://dev.procuroapp.com:5173', // ✅ Must be here
];
```

---

### Problem: Provider returns null price

**Possible Causes:**
1. **CORS blocked** (expected) → HTML Size = 0 KB
2. **Parsing failed** → HTML Size > 0 KB but price = null
3. **No results** → Retailer has no matching products

**Solution:**
- Check **Debug Info** panel
- Check **Raw HTML** panel (should not be Vite HTML)
- Check browser console for errors
- Try different keyword (e.g., "HP Printer Paper")

---

### Problem: DB Inspector shows no updates

**Solution:**

1. Verify backend is running:
   ```bash
   curl http://localhost:5000/health
   ```

2. Check backend logs for errors:
   ```
   POST /api/store-price 500 ...
   ```

3. Verify test item is selected (blue row in table)

4. Check browser console for fetch errors

---

## 📖 SUMMARY

### ✅ What Works with dev.procuroapp.com:

1. ✅ **Full app functionality** (dashboard, items, reports, settings)
2. ✅ **Provider testing** with better CORS handling
3. ✅ **Database operations** (create, read, update)
4. ✅ **Alerts generation** when saving prices
5. ✅ **QuickBooks embed** (iframe works)
6. ✅ **API calls** through Vite proxy
7. ✅ **Debug tools** (DB Inspector, QA Suite)

### ⚠️ Still Limited:

1. ⚠️ **CORS may still block** retailer requests (depends on retailer policy)
2. ⚠️ **Production HTTPS** required for some retailers
3. ⚠️ **Rate limiting** by retailers (don't spam tests)

### 🚀 Next Steps:

1. ✅ Use `dev.procuroapp.com:5173` for all testing
2. ✅ Test all 6 providers with real keywords
3. ✅ Verify alerts generation
4. ✅ Check DB Inspector after each save
5. ✅ Document any CORS issues by provider

---

## 🎯 QUICK REFERENCE

### Start Servers:
```bash
# Terminal 1 (Backend)
cd server && npm run dev

# Terminal 2 (Frontend)
cd client && npm run dev
```

### Access App:
```
http://dev.procuroapp.com:5173/provider-test
```

### Test Workflow:
```
1. Create test item ($49.99)
2. Test provider (Walmart)
3. Save result to DB
4. Check DB Inspector
5. Verify alert generated
```

### Debug:
```
Browser Console → Provider logs
Backend Terminal → API logs
/qa → DB Inspector → View data
```

---

**Status:** ✅ READY FOR TESTING

**Date:** November 14, 2025

**Environment:** Development (`dev.procuroapp.com`)




