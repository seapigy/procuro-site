# 🧪 PROCURO - QUICKBOOKS REVIEWER TEST FLOW

**App Name:** Procuro - Smart Purchasing Alerts  
**Version:** 1.1.0  
**Test Environment:** QuickBooks Online Sandbox  
**Estimated Testing Time:** 20-25 minutes  
**Date:** November 13, 2025

---

## 📋 SECTION 1 — APP OVERVIEW

### What is Procuro?

Procuro helps businesses save money on the items they already buy by automatically monitoring prices across major retailers and alerting users when better prices are available.

### Key Features

✅ **QuickBooks OAuth Integration** - Secure connection to QuickBooks Online  
✅ **Embedded iframe Dashboard** - Works directly inside QuickBooks  
✅ **Automatic Item Import** - Reads Purchase transactions  
✅ **Price Monitoring** - Daily automated price checks across retailers  
✅ **Savings Alerts** - Instant notifications for better prices  
✅ **Analytics & Reports** - Visual dashboards and CSV exports  
✅ **Settings Panel** - User preferences and backup functionality

### Value Proposition

> "Save money on what you already buy — embedded directly in QuickBooks"

### Technical Stack

- **Backend:** Node.js, Express, Prisma ORM
- **Frontend:** React, TypeScript, Tailwind CSS
- **Database:** SQLite (local) / PostgreSQL (production)
- **Security:** AES-256-GCM token encryption
- **Deployment:** GitHub Pages (frontend), Node server (backend)

---

## 📝 SECTION 2 — REVIEWER PREPARATION

Before beginning the test, please complete these preparatory steps:

### Prerequisites Checklist

- [ ] **QuickBooks Sandbox Account:** Ensure you have access to a QuickBooks Online Sandbox environment
- [ ] **Web Browser:** Use Google Chrome or Microsoft Edge (latest version)
- [ ] **Internet Connection:** Stable connection required
- [ ] **Popup Blocker:** Disable or allow popups for procuroapp.com
- [ ] **Time:** Allocate 20-25 minutes for complete testing

### Step 1: Verify Public URLs

Visit these URLs to confirm they load without errors:

| URL | Expected | Status |
|-----|----------|--------|
| https://procuroapp.com/ | Landing page with hero section | [ ] ✓ |
| https://procuroapp.com/privacy | Privacy policy displays | [ ] ✓ |
| https://procuroapp.com/terms | Terms of service displays | [ ] ✓ |
| https://procuroapp.com/support | Support page with FAQ | [ ] ✓ |
| https://procuroapp.com/qbo_embed/iframe-loader.html | Loading screen appears | [ ] ✓ |

**Expected Result:** All pages load with HTTPS, no 404 errors, professional appearance.

### Step 2: Open Developer Tools (Optional)

For detailed testing:

1. Open Chrome/Edge
2. Press `F12` or right-click → "Inspect"
3. Navigate to **Console** tab
4. Navigate to **Network** tab
5. Check "Disable cache" (optional)

**Note:** This step is optional but helpful for debugging.

### Step 3: Prepare Test Environment

- [ ] Clear browser cache (Ctrl+Shift+Delete)
- [ ] Use Incognito/Private window (recommended)
- [ ] Have notepad ready for observations

---

## 🔐 SECTION 3 — OAUTH FLOW TEST

This section tests the secure connection between Procuro and QuickBooks Online.

### Step 1: Launch App from QuickBooks

**Instructions:**

1. Log into your **QuickBooks Online Sandbox** account
2. Navigate to **Apps** in the left sidebar
3. Search for "Procuro" in the app store
4. Click **Get App Now**
5. Click **Connect to QuickBooks**

**Expected Behavior:**
- QuickBooks redirects to OAuth authorization screen
- URL changes to `https://appcenter.intuit.com/...`
- Authorization screen displays Procuro app details

**Screenshot Placeholder:** `screenshot-oauth-start.png`

---

### Step 2: Review OAuth Consent Screen

**What You Should See:**

```
Procuro would like to:
☑ Access your QuickBooks company data (Accounting scope)
☑ Verify your identity (OpenID)
☑ Access your profile information (Profile)
☑ Access your email address (Email)

[Cancel]  [Authorize]
```

**Verify:**
- [ ] App name shows: "Procuro - Smart Purchasing Alerts"
- [ ] All 4 scopes are listed
- [ ] Scopes explanation is clear
- [ ] "Authorize" button is visible

**Screenshot Placeholder:** `screenshot-oauth-consent.png`

---

### Step 3: Authorize Connection

**Instructions:**

1. Click **Authorize** button
2. Wait for redirect (2-3 seconds)

**Expected Behavior:**
- QuickBooks processes authorization
- Redirects to: `https://procuroapp.com/oauth/callback?code=XXX&realmId=XXX&state=XXX`
- Procuro iframe loads inside QuickBooks

**Behind the Scenes (For Your Understanding):**

```
1. Procuro receives authorization code
2. Exchanges code for access_token + refresh_token
3. Encrypts tokens using AES-256-GCM
4. Stores encrypted tokens in database
5. Creates/matches Company record using realmId
6. Creates User record linked to Company
7. Fetches Purchase transactions from QuickBooks
8. Imports items into Procuro database
9. Redirects to dashboard
```

**Expected Result:**
- ✅ No errors displayed
- ✅ Dashboard loads within 3-5 seconds
- ✅ iframe embedded in QuickBooks UI
- ✅ QuickBooks left sidebar remains visible

**Screenshot Placeholder:** `screenshot-oauth-complete.png`

---

### Step 4: Verify Dashboard Load

**After OAuth completes, you should see:**

- **Top Navigation Bar:**
  - Procuro logo
  - Tabs: Overview | Items | Alerts | Savings | Reports
  - Notification bell (with badge if alerts exist)
  - Settings icon (gear)
  - Theme toggle (sun/moon icon)

- **Main Content Area:**
  - Welcome message with company name
  - 4 metric cards (Monthly Savings, Annual Savings, Items Tracked, Active Alerts)
  - Recent alerts table (if alerts exist)

**Verify:**
- [ ] Company name matches your QuickBooks Sandbox company
- [ ] No JavaScript errors in console
- [ ] All navigation tabs are clickable
- [ ] Dashboard is responsive (resize window to test)

**Screenshot Placeholder:** `screenshot-dashboard-initial.png`

**⚠️ If Dashboard Doesn't Load:**
- Check browser console for errors
- Verify network requests completed (200 status)
- Try refreshing the iframe
- See DEBUGGING.md for troubleshooting steps

---

## 📦 SECTION 4 — DASHBOARD TEST

This section tests the main dashboard functionality.

### Test 4.1: Overview Tab

**Instructions:**

1. Ensure you're on the **Overview** tab (should be selected by default)
2. Observe the dashboard layout

**Expected Elements:**

**Metric Cards (4 total):**
```
┌─────────────────────┐  ┌─────────────────────┐
│ Monthly Savings     │  │ Annual Savings      │
│ $XX.XX              │  │ $XXX.XX             │
└─────────────────────┘  └─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐
│ Items Tracked       │  │ Active Alerts       │
│ 6                   │  │ 3                   │
└─────────────────────┘  └─────────────────────┘
```

**Recent Alerts Table:**
- Column headers: Item | Retailer | Old Price | New Price | Savings | Action
- Up to 5 most recent alerts displayed
- Each row has "View" and "Delete" buttons

**Verify:**
- [ ] All 4 metric cards display values (not "0" or "loading...")
- [ ] Recent alerts table shows at least 1 alert
- [ ] Clicking "View" opens retailer link in new tab
- [ ] Clicking "Delete" removes alert from list
- [ ] No console errors
- [ ] Cards have proper spacing and alignment

**Screenshot Placeholder:** `screenshot-dashboard-overview.png`

---

### Test 4.2: Data Sync Verification

**Verify Data Import:**

1. Check if items have been imported from QuickBooks
2. Navigate to **Items** tab (next test section)
3. Confirm items appear in the table

**Expected Behavior:**
- Items imported from QuickBooks Purchase transactions within 30-60 seconds
- If no Purchase transactions exist in Sandbox, app shows empty state
- Empty state message: "No items yet. Add Purchase transactions in QuickBooks to start tracking."

**Mock Data Option:**
If your Sandbox has no Purchase transactions, Procuro may have pre-loaded mock data for testing. This is acceptable and expected.

---

### Test 4.3: Notification Bell

**Instructions:**

1. Look at the top-right corner
2. Find the bell icon (🔔)
3. Observe the badge count (red circle with number)

**Expected Behavior:**
- [ ] Bell icon visible
- [ ] Badge shows number of unread alerts (e.g., "3")
- [ ] Clicking bell switches to "Alerts" tab
- [ ] Badge count decreases after viewing alerts

**Screenshot Placeholder:** `screenshot-notification-bell.png`

---

## 📋 SECTION 5 — ITEMS PAGE TEST

This section tests the Items management functionality, including the inline editing and search features (v1.1.0 optional add-ons).

### Test 5.1: Navigate to Items Tab

**Instructions:**

1. Click **Items** tab in top navigation
2. Wait for items table to load (< 1 second)

**Expected Layout:**

```
┌──────────────────────────────────────────────────┐
│  Items                                  [Search] │
│  ────────────────────────────────────────────    │
│                                                   │
│  Name          Vendor    SKU       Category  ... │
│  ─────────────────────────────────────────────   │
│  Copy Paper    Staples   STR513   Office         │
│  BIC Pens      Amazon    BIC60    Office         │
│  Printer Ink   HP        HP64     Tech           │
│  ...                                              │
└──────────────────────────────────────────────────┘
```

**Verify:**
- [ ] Table displays at least 3 items (mock or imported)
- [ ] Columns: Name, Vendor, SKU, Category, Last Paid Price, Reorder Interval
- [ ] Search bar visible at top
- [ ] Table is sortable by clicking column headers (optional)

**Screenshot Placeholder:** `screenshot-items-table.png`

---

### Test 5.2: Inline Editing (v1.1.0 Feature)

**Instructions:**

1. **Edit Item Name:**
   - Click on any item's **Name** cell
   - Cell becomes editable with input field
   - Change the name (e.g., "Copy Paper" → "Premium Copy Paper")
   - Click the **Save** icon (✓ checkmark) or press Enter

2. **Edit Vendor:**
   - Click on the **Vendor** cell for the same item
   - Change vendor name
   - Click Save or press Enter

3. **Cancel Edit:**
   - Click on another cell to edit
   - Click the **Cancel** icon (X) or press Escape
   - Verify changes are reverted

**Expected Behavior:**
- [ ] Cell highlights when clicked (editable state)
- [ ] Save/Cancel buttons appear inline
- [ ] After save:
  - Row highlights green briefly (success feedback)
  - Toast notification: "Item updated successfully"
  - Changes persist (refresh page to verify)
- [ ] After cancel:
  - Original values restored
  - No database update

**Validation Test:**
1. Try to save an empty item name
2. Expected: Alert shows "Item name cannot be empty"
3. Changes should not save

**Screenshot Placeholder:** `screenshot-inline-edit.png`

---

### Test 5.3: Quick Search Feature (v1.1.0 Feature)

**Instructions:**

1. Locate the **Search** bar above the items table
2. Type a search term (e.g., "paper")
3. Observe the table filter in real-time

**Test Cases:**

| Search Term | Expected Result |
|-------------|----------------|
| "paper" | Shows only items with "paper" in name, vendor, SKU, or category |
| "amazon" | Shows only items from Amazon vendor |
| "BIC" | Shows items with "BIC" in name or SKU |
| (empty) | Shows all items |

**Verify:**
- [ ] Filtering happens **instantly** (< 50ms, no lag)
- [ ] Multiple fields searched (name, vendor, SKU, category)
- [ ] Case-insensitive search
- [ ] Clear button (X icon) appears when typing
- [ ] Clicking X clears search and shows all items
- [ ] Search query persists after page refresh (localStorage)

**Empty State Test:**
1. Search for "xyz123nonexistent"
2. Expected: Empty state displays
3. Message: "No items match 'xyz123nonexistent'"
4. "Clear search" button available

**Screenshot Placeholder:** `screenshot-search-filter.png`

---

### Test 5.4: Item Details (Optional)

If price details modal exists:

1. Click "View Prices" or price amount
2. Modal should open showing price history
3. Close modal with X or by clicking outside

**Expected:** Price history table with dates, retailers, prices

---

## 🔔 SECTION 6 — ALERTS TEST

This section tests the price drop alerts functionality.

### Test 6.1: Navigate to Alerts Tab

**Instructions:**

1. Click **Alerts** tab in top navigation
2. Wait for alerts to load

**Expected Layout:**

```
┌──────────────────────────────────────────────────┐
│  Price Drop Alerts                               │
│  ────────────────────────────────────────────    │
│                                                   │
│  Item Name: Copy Paper                           │
│  Retailer: Amazon                                │
│  Old Price: $45.99 → New Price: $42.49          │
│  Savings: $3.50 per order                        │
│  Est. Monthly: $105.00                           │
│  [View Deal] [Dismiss]                           │
│  ─────────────────────────────────────────────   │
│  (More alerts...)                                │
└──────────────────────────────────────────────────┘
```

**Verify:**
- [ ] At least 1 alert displays (mock data pre-loaded)
- [ ] Each alert shows:
  - Item name
  - Retailer (Amazon, Walmart, Staples, etc.)
  - Old price vs New price
  - Savings per order
  - Estimated monthly savings
  - Action buttons
- [ ] Professional card-style layout
- [ ] Responsive design

**Screenshot Placeholder:** `screenshot-alerts-list.png`

---

### Test 6.2: Alert Actions

**Test "View" Button:**

1. Click **View** button on any alert
2. Expected: New tab opens with retailer product page
3. URL should be external (e.g., amazon.com, walmart.com)
4. Product should match the alert item

**Test "Dismiss" Button:**

1. Click **Dismiss** (or "Delete") button on any alert
2. Expected:
   - Alert removed from list immediately
   - Toast: "Alert dismissed"
   - Notification bell badge count decreases by 1
   - API call: `DELETE /api/alerts/:id` (check Network tab)

**Verify:**
- [ ] View button opens correct retailer link
- [ ] Dismiss button removes alert
- [ ] No console errors
- [ ] Badge count updates

**Screenshot Placeholder:** `screenshot-alert-actions.png`

---

### Test 6.3: Mark All as Seen

**Instructions:**

1. If "Mark All as Seen" button exists, click it
2. Or, simply view the Alerts tab (auto-marks as seen)

**Expected Behavior:**
- [ ] Notification bell badge resets to 0
- [ ] Alerts remain visible but marked as "viewed"
- [ ] API call: `POST /api/alerts/markAllSeen`

---

### Test 6.4: Empty State

If no alerts exist:

**Expected Display:**
```
┌──────────────────────────────────────────────────┐
│                                                   │
│              📦                                   │
│      No price drop alerts yet                    │
│                                                   │
│  We'll notify you when we find better prices.    │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Verify:**
- [ ] Empty state icon and message display
- [ ] No errors
- [ ] Professional appearance

---

## 📊 SECTION 7 — REPORTS TEST

This section tests the analytics and reporting features.

### Test 7.1: Navigate to Reports Tab

**Instructions:**

1. Click **Reports** tab in top navigation
2. Wait for page to load (< 1 second)

**Expected Layout:**

```
┌──────────────────────────────────────────────────┐
│  Savings Reports & Analytics                     │
│  ────────────────────────────────────────────    │
│                                                   │
│  [Monthly: $XXX] [Annual: $XXX] [Items: X]      │
│                                                   │
│  Top Vendors by Savings              [Export CSV]│
│  ─────────────────────────────────────────────   │
│  1. Amazon     ████████████████  $105.00/mo     │
│  2. Walmart    ███████████       $82.50/mo      │
│  3. Staples    ████████          $67.30/mo      │
│  4. Target     █████             $45.00/mo      │
│  5. Best Buy   ███               $28.00/mo      │
│                                                   │
│  Top 5 Items by Savings                          │
│  ...                                              │
└──────────────────────────────────────────────────┘
```

**Verify:**
- [ ] 3 metric cards at top (Monthly, Annual, Items)
- [ ] Top Vendors chart displays
- [ ] Top 5 Items list displays
- [ ] Export CSV button visible

**Screenshot Placeholder:** `screenshot-reports-overview.png`

---

### Test 7.2: Top Vendors Chart (v1.1.0 Feature)

**Instructions:**

1. Observe the "Top Vendors by Savings" section
2. Verify visual elements

**Expected Elements:**
- [ ] Horizontal bar chart with 5 vendors
- [ ] Numbered badges (1, 2, 3, 4, 5) on left
- [ ] Vendor names clearly visible
- [ ] Gradient-colored bars (blue → green)
- [ ] Savings amounts displayed (e.g., "$105.00/mo")
- [ ] Bar widths proportional to savings amounts

**Verify:**
- [ ] Chart renders without errors
- [ ] Bars animate smoothly (optional)
- [ ] Responsive on smaller screens
- [ ] Data matches alerts (if you can verify)

**Screenshot Placeholder:** `screenshot-top-vendors-chart.png`

---

### Test 7.3: CSV Export Feature

**Instructions:**

1. Click **Export CSV** button
2. Wait for download to begin

**Expected Behavior:**
- [ ] CSV file downloads immediately
- [ ] Filename format: `procuro-savings-report-2025-11-13.csv`
- [ ] File size: 1-50 KB (depending on data)

**CSV Content Verification:**

Open the downloaded CSV file:

**Expected Headers:**
```csv
"Item Name","Retailer","Old Price","New Price","Savings Per Order","Est. Monthly Savings"
```

**Expected Data Rows:**
```csv
"Copy Paper","Amazon","$45.99","$42.49","$3.50","$105.00"
"BIC Pens","Walmart","$12.49","$11.49","$1.00","$30.00"
...
```

**Verify:**
- [ ] Headers present
- [ ] Data rows present (at least 1)
- [ ] Proper CSV formatting (commas, quotes)
- [ ] Values match displayed data
- [ ] No corruption or encoding issues

**Screenshot Placeholder:** `screenshot-csv-export.png`

---

### Test 7.4: Savings Metrics

**Verify Calculations:**

If you can cross-check:
- Monthly Savings = Sum of all alert estimated monthly savings
- Annual Savings = Monthly × 12
- Items Tracked = Count of items in database

**Expected:** All calculations accurate

---

## ⚙️ SECTION 8 — SETTINGS TEST

This section tests user preferences and backup functionality.

### Test 8.1: Open Settings Modal

**Instructions:**

1. Click **Settings** icon (gear) in top-right corner
2. Modal should overlay the dashboard

**Expected Modal Layout:**

```
┌──────────────────────────────────────────────────┐
│  Settings                                    [X] │
│  ────────────────────────────────────────────    │
│                                                   │
│  Automatic Price Checking                        │
│  ○ Enable daily price checks                     │
│  [Toggle: ON]                                    │
│                                                   │
│  Notification Frequency                          │
│  [ ] Daily    [✓] Weekly    [ ] Manual          │
│                                                   │
│  Min Price Drop %                                │
│  [=====●=====] 5%                               │
│                                                   │
│  Database Backup                                 │
│  [Download Backup]                               │
│                                                   │
│  Theme                                           │
│  ( ) Light  ( ) Dark  (●) System                │
│                                                   │
│  [Reset to Defaults]  [Cancel]  [Save Settings] │
└──────────────────────────────────────────────────┘
```

**Verify:**
- [ ] Modal opens smoothly (fade-in animation)
- [ ] Backdrop blurs background
- [ ] All settings sections visible
- [ ] Current values displayed correctly

**Screenshot Placeholder:** `screenshot-settings-modal.png`

---

### Test 8.2: Auto-Check Toggle (v1.1.0 Feature)

**Instructions:**

1. Locate "Automatic Price Checking" section
2. Observe toggle switch (should be ON/green by default)
3. Click toggle to turn OFF (gray)
4. Click **Save Settings**
5. Close modal
6. Reopen modal
7. Verify toggle is still OFF

**Expected Behavior:**
- [ ] Toggle switches smoothly (green ↔ gray)
- [ ] Save button clickable
- [ ] Toast: "Settings saved successfully"
- [ ] Preference persists after modal close/reopen
- [ ] Preference persists after page refresh
- [ ] Stored in browser localStorage

**Behind the Scenes:**
- When OFF: Daily price check cron job will skip execution
- When ON: Daily price check runs at 3:00 AM

**Verify:**
- [ ] Toggle works both directions (ON ↔ OFF)
- [ ] Settings persist

**Screenshot Placeholder:** `screenshot-auto-check-toggle.png`

---

### Test 8.3: Database Backup (v1.1.0 Feature)

**Instructions:**

1. Locate "Database Backup" section
2. Click **Download Backup** button
3. Wait for download (1-3 seconds)

**Expected Behavior:**
- [ ] Button text changes to "Downloading..."
- [ ] SQLite file downloads
- [ ] Filename format: `procuro-backup-2025-11-13.sqlite`
- [ ] File size: 50-500 KB (depends on data)
- [ ] Toast: "Backup downloaded successfully"

**File Verification (Optional):**

Open the `.sqlite` file with a SQLite browser (e.g., DB Browser for SQLite):

**Expected Tables:**
- Company
- User
- Item
- Price
- Alert
- SavingsSummary
- CompanyUser (multi-user)
- Invite (invite system)

**Verify:**
- [ ] Download completes
- [ ] File is valid SQLite database
- [ ] Contains actual data (not empty)

**Screenshot Placeholder:** `screenshot-backup-download.png`

---

### Test 8.4: Settings Persistence

**Instructions:**

1. Change multiple settings:
   - Toggle auto-check OFF
   - Select "Weekly" notification frequency
   - Move min price drop slider to 10%
   - Select "Dark" theme
2. Click **Save Settings**
3. Close modal
4. **Refresh the entire page** (F5)
5. Reopen Settings modal

**Expected Behavior:**
- [ ] All changes persisted
- [ ] Auto-check still OFF
- [ ] Notification frequency still "Weekly"
- [ ] Min price drop still 10%
- [ ] Theme still "Dark"

**Storage Location:** Browser localStorage (key: `procuro-settings`)

---

### Test 8.5: Reset to Defaults

**Instructions:**

1. Click **Reset to Defaults** button
2. Confirm if prompted

**Expected Behavior:**
- [ ] All settings reset to defaults:
  - Auto-check: ON
  - Notification frequency: Daily
  - Min price drop: 5%
  - Theme: System
- [ ] Toast: "Settings reset to defaults"

---

## 🤖 SECTION 9 — CRON WORKER TEST

This section explains the automated background jobs.

### Overview

Procuro runs two automated cron jobs:

1. **Token Refresh Worker** - Runs daily at 2:00 AM
2. **Daily Price Check Worker** - Runs daily at 3:00 AM

### Token Refresh Worker

**Purpose:** Refreshes QuickBooks OAuth access tokens to prevent expiration

**Schedule:** `0 2 * * *` (2:00 AM daily)

**Process:**
1. Fetches all users with QuickBooks connections
2. Uses refresh_token to get new access_token
3. Encrypts new tokens with AES-256-GCM
4. Updates database
5. Logs results

**File:** `server/src/workers/tokenRefresh.ts`

**Configuration:** `config/app.json` → `features.enableTokenRefresh`

### Daily Price Check Worker

**Purpose:** Checks current prices for all tracked items and creates alerts for price drops

**Schedule:** `0 3 * * *` (3:00 AM daily)

**Process:**
1. Fetches all items from database
2. Queries retailer APIs (Walmart, Amazon, Target)
3. Compares current prices to lastPaidPrice
4. Creates alerts if price drop ≥ threshold (5%)
5. Updates SavingsSummary table
6. Logs results

**File:** `server/src/workers/dailyPriceCheck.ts`

**Configuration:** 
- `config/app.json` → `features.enableDailyPriceCheck`
- `config/app.json` → `pricing.priceDropThreshold` (0.05 = 5%)

### Reviewer Action Required

> ⚠️ **NO MANUAL TESTING NEEDED**

These workers run automatically in the background. You do NOT need to:
- ❌ Manually trigger cron jobs
- ❌ Wait for 2 AM or 3 AM
- ❌ Test token refresh manually
- ❌ Test price checking manually

### What to Verify

**Simply confirm:**
- [ ] Alerts appear in the Alerts tab (mock data pre-loaded)
- [ ] Savings calculations are present
- [ ] No errors in console

**Optional Verification:**

If you have backend access, you can check:
```bash
# View cron logs (if logging enabled)
tail -f server/logs/cron.log

# Or check console output on server startup:
✅ Token refresh scheduled: 0 2 * * *
✅ Daily price check scheduled: 0 3 * * *
```

### Configuration File

Located at: `config/app.json`

```json
{
  "version": "1.1.0",
  "scheduling": {
    "priceCheckCron": "0 3 * * *",
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

---

## ⚠️ SECTION 10 — FAILURE MODE TESTING

This section tests how Procuro handles errors and edge cases.

### Test 10.1: OAuth Declined

**Instructions:**

1. Start OAuth flow again (disconnect first if needed)
2. When authorization screen appears, click **Cancel** or **Deny**

**Expected Behavior:**
- [ ] User redirected back to QuickBooks or Procuro landing page
- [ ] Error message displays: "Authorization was not completed. Please try reconnecting to QuickBooks."
- [ ] No console errors or crashes
- [ ] User can retry connection

**Screenshot Placeholder:** `screenshot-oauth-declined.png`

---

### Test 10.2: Network Error Simulation

**Instructions:**

1. Open Developer Tools → Network tab
2. Set throttling to "Offline"
3. Try to navigate to Items tab or refresh page

**Expected Behavior:**
- [ ] Loading spinner displays
- [ ] After timeout, error message shows
- [ ] Toast: "Connection issue. Please check your internet and try again."
- [ ] App doesn't crash
- [ ] Retry button available (if implemented)

**Restore Network:** Set throttling back to "Online"

---

### Test 10.3: Empty States

**Test No Items:**

If no items have been imported:

**Expected Display:**
```
┌──────────────────────────────────────────────────┐
│                                                   │
│              📦                                   │
│         No items yet                             │
│                                                   │
│  Connect QuickBooks and add Purchase             │
│  transactions to start tracking items.           │
│                                                   │
│  [Connect QuickBooks]                            │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Verify:**
- [ ] Empty state icon (package/box)
- [ ] Clear message
- [ ] Call-to-action button (if applicable)
- [ ] No errors

**Screenshot Placeholder:** `screenshot-empty-items.png`

---

**Test No Alerts:**

Navigate to Alerts tab when no alerts exist:

**Expected Display:**
```
┌──────────────────────────────────────────────────┐
│                                                   │
│              🔔                                   │
│      No price drop alerts yet                    │
│                                                   │
│  We'll notify you when we find better prices.    │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Verify:**
- [ ] Empty state displays
- [ ] No errors
- [ ] Professional appearance

---

**Test No Savings Data:**

If no savings data exists (Reports tab):

**Expected:** Empty state or "No data yet" message

---

### Test 10.4: Invalid Invite Token

**Instructions:**

1. Visit: `https://procuroapp.com/invite/invalid-token-12345`
2. Observe the invite page

**Expected Behavior:**
- [ ] Page loads (no 404)
- [ ] Error message displays: "This invite link has expired or is invalid."
- [ ] "Contact your administrator" message
- [ ] No console errors

**Screenshot Placeholder:** `screenshot-invalid-invite.png`

---

### Test 10.5: Session Expiration

**Instructions:**

1. Complete OAuth and load dashboard
2. Wait 24 hours (or manually delete session cookies)
3. Try to perform an action (e.g., edit item)

**Expected Behavior:**
- [ ] Session expired message displays
- [ ] "Please reconnect to QuickBooks" prompt
- [ ] No data loss
- [ ] Graceful handling

---

### Test 10.6: Invalid Input Validation

**Test Empty Item Name:**

1. Go to Items tab
2. Edit an item name
3. Delete all text (leave empty)
4. Try to save

**Expected:**
- [ ] Alert: "Item name cannot be empty"
- [ ] Changes not saved
- [ ] Original value restored

**Test Invalid Price:**

1. Edit item price
2. Enter negative number (e.g., -10)
3. Try to save

**Expected:**
- [ ] Validation error: "Price must be positive"
- [ ] Changes not saved

---

## 🔐 SECTION 11 — SECURITY OVERVIEW

This section provides security information for reviewers.

### Data Encryption

**QuickBooks OAuth Tokens:**
- **Algorithm:** AES-256-GCM (Advanced Encryption Standard)
- **Key Derivation:** PBKDF2 with 100,000 iterations
- **Salt:** 64-byte random salt per encryption
- **IV:** 12-byte random initialization vector
- **Authentication:** GCM provides authenticated encryption

**Implementation:** `server/src/utils/crypto.ts`

**Process:**
```
1. Generate random salt (64 bytes)
2. Derive key from master key + salt (PBKDF2, 100k iterations)
3. Generate random IV (12 bytes)
4. Encrypt token with AES-256-GCM
5. Combine: salt + IV + authTag + ciphertext
6. Encode as Base64
7. Store in database
```

**Result:** No plaintext tokens stored anywhere.

---

### Transport Security

**HTTPS/TLS:**
- All connections use HTTPS with TLS 1.2+
- No HTTP fallback
- SSL certificates from trusted CAs
- HSTS enabled

**API Communication:**
- QuickBooks API: HTTPS only
- Retailer APIs: HTTPS only
- All external requests encrypted

---

### Data Storage

**Database:** SQLite (local dev) / PostgreSQL (production)

**Stored Data:**
- User account (name, email, encrypted tokens)
- Company profile
- Items (from Purchase transactions)
- Prices (fetched from retailers)
- Alerts (price drop notifications)
- Savings summaries

**NOT Stored:**
- Customer information
- Invoice data
- Sales transactions
- Bank account details
- Credit card information
- Tax data
- Payroll information

---

### Third-Party Data Sharing

**Procuro does NOT:**
- ❌ Sell user data
- ❌ Share data with third parties
- ❌ Use advertising trackers
- ❌ Use analytics services (Google Analytics, etc.)
- ❌ Send data to email providers (currently)

**Procuro DOES:**
- ✅ Send generic product names to retailer APIs (for price lookups)
- ✅ Example: "Copy Paper 500 Sheets" sent to Walmart API
- ✅ NO company names, purchase history, or identifying info sent

---

### Compliance

**Standards:**
- ✅ Intuit Data Protection Requirements
- ✅ QuickBooks App Store Guidelines
- ✅ OAuth 2.0 Security Best Practices
- ✅ GDPR compliant (EU users)
- ✅ CCPA compliant (California users)

**User Rights:**
- ✅ Right to access data
- ✅ Right to delete account
- ✅ Right to export data (CSV)
- ✅ Right to disconnect QuickBooks

---

### Security Middleware

**Blocked Paths:**

The following paths are blocked from public access (HTTP 403):

```
/server/*
/jobs/*
/providers/*
/db/*
/.env
/node_modules/*
/prisma/*
/.git/*
/src/*
All .ts and .tsx files
Any path containing ".env"
```

**Implementation:** `server/src/index.ts` (lines 45-76)

---

### Security Testing

**Automated Tests:**
- ✅ 14/14 backend tests passing
- ✅ OAuth flow tested
- ✅ Token encryption/decryption tested
- ✅ Input validation tested
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS prevention (React JSX escaping)

**Manual Security Review:**
- ✅ No secrets in source code
- ✅ Environment variables only in .env
- ✅ CORS configured correctly
- ✅ CSRF protection via SameSite cookies

---

### Incident Response

**If security issue is found:**

1. **Contact immediately:** procuroapp@gmail.com with subject "SECURITY"
2. **Response time:** Within 24 hours
3. **Confidential handling:** We will work with you privately
4. **Disclosure:** Coordinated disclosure after fix is deployed

---

## ✅ SECTION 12 — REVIEWER CHEAT SHEET (TL;DR)

This is a quick reference for reviewers. If all these items pass, Procuro is ready for approval.

### Quick Verification Checklist

**To approve Procuro, verify all items below:**

#### OAuth & Connection
- [ ] OAuth authorization screen appears
- [ ] All 4 scopes displayed (Accounting, OpenID, Profile, Email)
- [ ] Authorization completes without errors
- [ ] Dashboard loads inside QuickBooks iframe
- [ ] Company name matches QuickBooks Sandbox

#### Dashboard & Navigation
- [ ] Overview tab displays metrics and alerts
- [ ] All navigation tabs clickable (Items, Alerts, Savings, Reports)
- [ ] Notification bell shows alert count
- [ ] Settings icon clickable
- [ ] No JavaScript console errors

#### Items Page
- [ ] Items table displays data
- [ ] Inline editing works (click, edit, save)
- [ ] Search bar filters items instantly
- [ ] Empty states display appropriately

#### Alerts Page
- [ ] Alerts list displays price drops
- [ ] "View" button opens retailer link
- [ ] "Dismiss" button removes alert
- [ ] Notification badge decreases on dismissal

#### Reports Page
- [ ] Top Vendors chart renders correctly
- [ ] Savings metrics display (Monthly, Annual, Items)
- [ ] CSV export downloads successfully
- [ ] CSV file contains valid data

#### Settings Page
- [ ] Settings modal opens smoothly
- [ ] Auto-check toggle works (ON ↔ OFF)
- [ ] Database backup downloads .sqlite file
- [ ] Settings persist after page refresh

#### Public Pages
- [ ] Landing page loads: https://procuroapp.com/
- [ ] Privacy policy loads: https://procuroapp.com/privacy
- [ ] Terms of service loads: https://procuroapp.com/terms
- [ ] Support page loads: https://procuroapp.com/support

#### Technical Requirements
- [ ] All pages use HTTPS
- [ ] No 404 errors
- [ ] No console errors
- [ ] Responsive design (test on tablet/mobile)
- [ ] manifest.json is valid
- [ ] OAuth scopes are justified

#### Security & Compliance
- [ ] Privacy policy mentions AES-256 encryption
- [ ] Privacy policy states "no data selling/sharing"
- [ ] Terms of service include disclaimers
- [ ] Support page has contact email
- [ ] Sensitive paths blocked (try /server, /.env → 403 Forbidden)

#### Optional Add-Ons (v1.1.0)
- [ ] Inline editing functional
- [ ] Quick search functional
- [ ] Top Vendors chart displays
- [ ] Auto-check toggle works
- [ ] Database backup works

---

### Quick Test Flow (10-Minute Version)

**If you only have 10 minutes:**

1. ✅ Connect via OAuth (3 min)
2. ✅ Load dashboard, verify metrics (1 min)
3. ✅ Check Items tab, edit one item (2 min)
4. ✅ Check Alerts tab, dismiss one alert (1 min)
5. ✅ Check Reports tab, export CSV (1 min)
6. ✅ Open Settings, toggle auto-check, download backup (2 min)

**Done!** If all 6 steps pass, app is functional.

---

### Approval Decision

**Approve if:**
- ✅ OAuth works end-to-end
- ✅ Dashboard loads without errors
- ✅ Core features functional (Items, Alerts, Reports, Settings)
- ✅ Public pages accessible
- ✅ Security measures in place
- ✅ No critical bugs

**Request changes if:**
- ❌ OAuth fails
- ❌ Dashboard doesn't load
- ❌ Console errors present
- ❌ Public pages return 404
- ❌ Data not saving
- ❌ Security concerns

**Reject if:**
- ❌ App crashes frequently
- ❌ Data security compromised
- ❌ Violates QuickBooks guidelines
- ❌ Doesn't match submitted description

---

## 🎯 FINAL NOTES FOR REVIEWER

### Testing Environment

- **QuickBooks Sandbox:** Use any Sandbox company
- **Mock Data:** Pre-loaded for testing (6 items, 3 alerts)
- **Time Required:** 20-25 minutes for full test, 10 minutes for quick test
- **Browser:** Chrome or Edge recommended

### Support During Review

If you encounter any issues:

**Email:** procuroapp@gmail.com  
**Subject:** "QuickBooks App Review - [Issue Description]"  
**Response Time:** Within 24 hours (weekdays)

We're here to help make your review smooth!

### Expected Approval Timeline

- **Initial Review:** 5-10 business days
- **Feedback Response:** Within 24-48 hours
- **Final Approval:** 2-5 business days

### Post-Approval

Once approved:
- App will be available in QuickBooks App Store (Private Beta mode initially)
- We'll monitor for first user installs
- Ready to address any post-launch issues

---

## 📞 CONTACT INFORMATION

**Developer:** Procuro Inc.  
**Email:** procuroapp@gmail.com  
**Website:** https://procuroapp.com  
**Support:** https://procuroapp.com/support  
**Documentation:** https://github.com/seapigy/procuro-site/tree/main/docs

---

**Thank you for reviewing Procuro!** 🙏

We appreciate your time and thoroughness in testing our app. Our goal is to help QuickBooks users save money effortlessly, and we're excited to bring this value to the QuickBooks community.

---

**Test Flow Version:** 1.1.0  
**Last Updated:** November 13, 2025  
**Document Status:** Ready for Intuit Review  
**Classification:** Public - Reviewer Documentation

