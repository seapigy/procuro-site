# 🔧 PROCURO - REVIEWER DEBUGGING GUIDE

**Version:** 1.1.0  
**Date:** November 13, 2025  
**Purpose:** Troubleshooting guide for Intuit reviewers

---

## 📋 OVERVIEW

This guide helps reviewers troubleshoot common issues encountered during Procuro testing. Most issues can be resolved with simple steps.

---

## 🚨 QUICK FIXES

### Try These First (90% of issues resolved):

1. **Hard Refresh:** Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear Cache:** Browser Settings → Clear browsing data → Cached images and files
3. **Incognito Mode:** Open new incognito/private window and test again
4. **Different Browser:** Try Chrome if using Edge, or vice versa
5. **Check Console:** Open DevTools (F12) → Console tab → Look for errors

---

## 🔐 OAUTH ISSUES

### Issue 1: OAuth Authorization Screen Doesn't Appear

**Symptoms:**
- Clicked "Connect QuickBooks" but nothing happened
- Page just reloads or stays the same

**Possible Causes:**
1. Popup blocker is blocking OAuth window
2. JavaScript error preventing redirect
3. Browser extensions interfering

**Solutions:**

**Step 1: Allow Popups**
```
Chrome/Edge:
1. Click the popup blocker icon in address bar (🚫)
2. Select "Always allow popups from procuroapp.com"
3. Refresh page and try again
```

**Step 2: Check Console for Errors**
```
1. Press F12
2. Click Console tab
3. Look for red error messages
4. If you see OAuth-related errors, note them and contact support
```

**Step 3: Disable Browser Extensions**
```
1. Open browser in Incognito/Private mode (Ctrl+Shift+N)
2. Extensions are typically disabled in incognito
3. Try OAuth flow again
```

---

### Issue 2: OAuth Redirect Fails / Stuck on "Loading..."

**Symptoms:**
- Authorized on Intuit page
- Redirected back but stuck on loading screen
- Dashboard never loads

**Possible Causes:**
1. Network timeout
2. Backend server not responding
3. Database connection issue
4. Session cookie not set

**Solutions:**

**Step 1: Check Network Tab**
```
1. Open DevTools (F12) → Network tab
2. Look for failed requests (red status)
3. Click failed request to see details
4. Common issues:
   - 500 error → Backend server issue
   - 404 error → Wrong endpoint
   - Timeout → Network/server slow
```

**Step 2: Wait and Retry**
```
1. Initial OAuth can take 30-60 seconds (imports items from QuickBooks)
2. Wait up to 2 minutes
3. If still loading, refresh page
4. Try connecting again
```

**Step 3: Clear Cookies and Try Again**
```
1. DevTools → Application tab → Cookies
2. Find procuroapp.com
3. Delete all cookies
4. Close DevTools
5. Try OAuth flow from beginning
```

---

### Issue 3: "Unauthorized" or "Session Expired" Message

**Symptoms:**
- Logged in successfully before
- Now getting "Unauthorized" errors
- Can't access dashboard

**Cause:** OAuth tokens expired or session cookie deleted

**Solution:**

**Reconnect QuickBooks:**
```
1. In QuickBooks, go to: Apps → Manage Apps
2. Find "Procuro"
3. Click "Disconnect"
4. Confirm disconnection
5. Go back to Apps menu
6. Search for "Procuro"
7. Click "Get App Now"
8. Authorize again
```

---

## 📊 DASHBOARD ISSUES

### Issue 4: Dashboard Shows No Data / Empty Metrics

**Symptoms:**
- Dashboard loads but all metrics show "0"
- No items, alerts, or savings data

**Possible Causes:**
1. QuickBooks Sandbox has no Purchase transactions
2. Data import failed
3. User ID mismatch

**Solutions:**

**Step 1: Check If Mock Data Loaded**
```
1. Navigate to Items tab
2. If you see 6 mock items (Copy Paper, BIC Pens, etc.), mock data loaded correctly
3. If items tab is empty, see Step 2
```

**Step 2: Add Purchase Transactions in QuickBooks**
```
1. In QuickBooks Sandbox:
   - Go to: Expenses → Vendors
   - Click "New transaction"
   - Select "Bill" or "Purchase Order"
   - Add items with prices
   - Save transaction
2. Return to Procuro
3. Disconnect and reconnect QuickBooks (to trigger fresh import)
```

**Step 3: Verify Company/User Match**
```
1. Open DevTools → Console
2. Look for logged company information
3. Verify realmId matches your QuickBooks Sandbox
4. If mismatch, disconnect and reconnect
```

---

### Issue 5: Console Errors (Red Messages)

**Symptoms:**
- Dashboard loads but has errors in console
- Some features not working

**Common Errors and Solutions:**

**Error: "Failed to fetch"**
```
Cause: Backend server not running or not accessible
Solution:
1. Check if backend is running on localhost:5000
2. Try accessing: http://localhost:5000/health
3. If health check fails, backend is down
4. For reviewers: Contact support (backend should be live)
```

**Error: "CORS policy: No 'Access-Control-Allow-Origin'"**
```
Cause: CORS configuration issue
Solution:
1. This is a backend configuration issue
2. Contact support immediately
3. Backend needs to allow procuroapp.com origin
```

**Error: "Cannot read property 'X' of undefined"**
```
Cause: Frontend expecting data that doesn't exist
Solution:
1. Usually happens with empty data
2. Reload page (Ctrl+Shift+R)
3. If persists, note the exact error and contact support
```

---

## 📋 ITEMS PAGE ISSUES

### Issue 6: Inline Editing Not Working

**Symptoms:**
- Clicked on cell but nothing happens
- Can't edit item name or vendor

**Solutions:**

**Step 1: Verify You're Clicking the Right Cell**
```
1. Only these columns are editable:
   - Name
   - Vendor
   - SKU
   - Category
   - Last Paid Price
2. ID, Dates, and Reorder Interval are NOT editable
3. Try clicking on Name column specifically
```

**Step 2: Check for JavaScript Errors**
```
1. Open DevTools → Console
2. Click on cell
3. Look for errors
4. If errors appear, note them and contact support
```

**Step 3: Try Different Row**
```
1. Some rows might have data issues
2. Try editing a different item
3. If one row works, others should too
```

---

### Issue 7: Search Not Filtering

**Symptoms:**
- Typed in search bar but table doesn't filter
- All items still visible

**Solutions:**

**Step 1: Check Search Query**
```
1. Search is case-insensitive but requires exact partial match
2. Example: "paper" matches "Copy Paper" ✓
3. Example: "papr" does NOT match "Copy Paper" ✗
4. Try simpler search terms
```

**Step 2: Clear Search and Try Again**
```
1. Click X button in search bar to clear
2. Type new search term slowly
3. Verify filtering happens in real-time
```

**Step 3: Refresh Page**
```
1. Hard refresh: Ctrl+Shift+R
2. Navigate back to Items tab
3. Try search again
```

---

## 🔔 ALERTS PAGE ISSUES

### Issue 8: No Alerts Showing

**Symptoms:**
- Alerts tab is empty
- No alerts despite having items

**Cause:** Alerts are created by daily cron job (3 AM) or when prices are checked

**Solutions:**

**For Reviewers (Expected):**
```
If you're testing on a fresh Sandbox with no history:
1. Mock data should include 2-3 pre-loaded alerts
2. If no mock alerts, this is expected for brand new setup
3. Empty state should display with message: "No price drop alerts yet"
4. This is NOT a bug
```

**To Verify Alerts Will Work:**
```
1. Check Items tab has items ✓
2. Check Reports tab shows savings data ✓
3. If both above work, alerts system is functional
4. Alerts will appear after next daily price check (3 AM)
```

---

### Issue 9: "View" Button Opens Wrong Link

**Symptoms:**
- Clicked "View" on alert
- Opens wrong product or 404 page

**Cause:** Product URLs may change or products may be delisted

**Expected Behavior:**
```
1. This is NOT a bug
2. Retailer URLs can change frequently
3. Products may be discontinued
4. Procuro stores URLs from time of price check
5. If product moved, retailer will show "not found"
```

**Verification:**
```
1. Check that link DOES open (not a broken link)
2. Check that link goes to correct retailer (Amazon, Walmart, etc.)
3. If link opens and goes to retailer, system is working correctly
```

---

## 📊 REPORTS PAGE ISSUES

### Issue 10: Chart Not Rendering

**Symptoms:**
- Reports page loads but Top Vendors chart is blank
- Just see empty space where chart should be

**Solutions:**

**Step 1: Check for Alerts Data**
```
1. Charts need alerts data to render
2. Navigate to Alerts tab
3. If no alerts, chart will be empty (this is expected)
4. If alerts exist, see Step 2
```

**Step 2: Check Console for Errors**
```
1. Open DevTools → Console
2. Look for chart-related errors
3. Common: "Cannot read property 'map' of undefined"
4. If this error, refresh page
```

**Step 3: Resize Window**
```
1. Sometimes charts don't render until resize
2. Make browser window smaller then larger
3. Chart should re-render
```

---

### Issue 11: CSV Export Not Downloading

**Symptoms:**
- Clicked "Export CSV" but no download
- Button just stays clicked

**Solutions:**

**Step 1: Check Download Permissions**
```
Chrome/Edge:
1. Browser may be blocking downloads
2. Check address bar for download blocked icon
3. Click icon and allow downloads
```

**Step 2: Check Downloads Folder**
```
1. File may have downloaded without notification
2. Open Downloads folder
3. Look for: procuro-savings-report-YYYY-MM-DD.csv
4. Sort by Date Modified (most recent at top)
```

**Step 3: Try Different Browser**
```
1. Some browsers have strict download policies
2. Try in incognito mode
3. Or try different browser entirely
```

---

## ⚙️ SETTINGS PAGE ISSUES

### Issue 12: Settings Not Persisting

**Symptoms:**
- Changed settings and clicked Save
- Closed modal and reopened
- Settings reverted to old values

**Cause:** LocalStorage not working or blocked

**Solutions:**

**Step 1: Check LocalStorage**
```
1. Open DevTools → Application tab
2. Left sidebar → Storage → Local Storage
3. Click "https://procuroapp.com"
4. Look for key: "procuro-settings"
5. If not present, localStorage is blocked
```

**Step 2: Enable Cookies/LocalStorage**
```
Chrome/Edge Settings:
1. Settings → Privacy and security
2. Cookies and other site data
3. Ensure "Allow all cookies" is selected
4. OR add procuroapp.com to allowed list
```

**Step 3: Disable Private/Incognito Mode**
```
1. LocalStorage doesn't persist in private browsing
2. Use normal browser window for settings testing
```

---

### Issue 13: Backup Download Fails

**Symptoms:**
- Clicked "Download Backup"
- Error message or no download

**Solutions:**

**Step 1: Check Backend Connection**
```
1. Open DevTools → Network tab
2. Click "Download Backup"
3. Look for request to /api/backup
4. Check response:
   - 200 OK → File should download
   - 500 error → Backend issue, contact support
   - 404 error → Wrong endpoint, contact support
```

**Step 2: Check File Size**
```
1. Backup file should be 50-500 KB
2. If file is 0 KB or very large (>10 MB), something is wrong
3. Contact support with file size
```

**Step 3: Manually Access Backup**
```
1. Open new tab
2. Navigate to: http://localhost:5000/api/backup
3. File should download automatically
4. If this works, there's an issue with the button click handler
```

---

## 🌐 NETWORK ISSUES

### Issue 14: Slow Loading / Timeouts

**Symptoms:**
- Everything takes 10+ seconds to load
- Frequent timeout errors
- Loading spinners never finish

**Solutions:**

**Step 1: Check Internet Connection**
```
1. Open new tab
2. Visit: https://google.com
3. If Google loads slowly, it's your connection
4. Restart router or switch networks
```

**Step 2: Check Backend Status**
```
1. Visit: http://localhost:5000/health
2. Should respond in <1 second
3. If slow, backend server may be overloaded
4. For reviewers: Contact support
```

**Step 3: Disable Browser Extensions**
```
1. Extensions can slow down requests
2. Test in incognito mode (extensions disabled)
3. If faster in incognito, disable extensions one by one to find culprit
```

---

## 🔒 SECURITY ISSUES

### Issue 15: "Access Denied" (403) Errors

**Symptoms:**
- Trying to access certain URLs
- Getting "Access denied" message

**Expected Behavior:**
```
These paths are SUPPOSED to be blocked (this is a security feature):
- /server/*
- /db/*
- /.env
- /jobs/*
- /providers/*
- Any .ts or .tsx files

If you see 403 on these paths, the security is working correctly ✓
```

**Actual Issues:**
```
If you see 403 on these paths, it's a problem:
- /api/items
- /api/alerts
- /api/savings-summary
- /dashboard

Solution: Contact support immediately (authentication issue)
```

---

## 🧹 NUCLEAR OPTIONS (Last Resort)

### Complete Reset

If nothing else works, try a complete reset:

**Step 1: Clear Everything**
```
1. Browser Settings → Clear browsing data
2. Select:
   - Cookies and other site data
   - Cached images and files
   - Hosted app data
3. Time range: "All time"
4. Click "Clear data"
```

**Step 2: Disconnect from QuickBooks**
```
1. QuickBooks → Apps → Manage Apps
2. Find Procuro
3. Click "Disconnect"
4. Confirm
```

**Step 3: Start Fresh**
```
1. Close all browser windows
2. Open new browser window
3. Visit procuroapp.com
4. Start OAuth flow from beginning
```

---

## 📞 WHEN TO CONTACT SUPPORT

Contact support if:

### Critical Issues (Immediate Contact)
- ❌ OAuth completely fails (error messages)
- ❌ Dashboard never loads (after waiting 2+ minutes)
- ❌ All API requests return 500 errors
- ❌ Console shows multiple red errors
- ❌ Security vulnerabilities found
- ❌ Data corruption or loss

### Non-Critical Issues (Can Continue Testing)
- ⚠️ One specific feature doesn't work (others do)
- ⚠️ Minor UI glitches
- ⚠️ Slow performance on specific action
- ⚠️ Documentation unclear
- ⚠️ Questions about expected behavior

---

## 📧 HOW TO REPORT ISSUES

When contacting support, include:

**Email Format:**
```
To: procuroapp@gmail.com
Subject: QuickBooks Review Issue - [Short Description]

Issue Description:
[Describe what you were trying to do]

Expected Behavior:
[What you expected to happen]

Actual Behavior:
[What actually happened]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Environment:
- Browser: [Chrome/Edge] Version: [XX]
- OS: [Windows/Mac] Version: [XX]
- QuickBooks: Sandbox
- Date/Time: [When issue occurred]

Console Errors:
[Paste any red error messages from Console]

Screenshots:
[Attach if helpful]

Network Requests:
[If relevant, describe failed API calls]
```

**Expected Response Time:** Within 24 hours (weekdays)

---

## 🛠️ DEVELOPER TOOLS GUIDE

### Essential DevTools Usage

**Open DevTools:**
- Windows: `F12` or `Ctrl+Shift+I`
- Mac: `Cmd+Option+I`

**Key Tabs:**

**Console Tab:**
```
Use for:
- Viewing JavaScript errors (red messages)
- Checking logged information
- Debugging issues

What to look for:
- ❌ Red errors → Something is broken
- ⚠️ Yellow warnings → Minor issues (usually ignorable)
- ℹ️ Blue info → Normal logging
```

**Network Tab:**
```
Use for:
- Monitoring API requests
- Checking response status codes
- Viewing request/response data

How to use:
1. Open Network tab
2. Perform action in app (e.g., load dashboard)
3. See all requests in list
4. Click request to see details
5. Check status code (200 OK = good, 500 = error)
```

**Application Tab:**
```
Use for:
- Viewing LocalStorage
- Inspecting cookies
- Checking session data

How to check settings:
1. Application → Local Storage → procuroapp.com
2. Look for "procuro-settings" key
3. Value should be JSON with your settings
```

---

## ✅ DEBUGGING CHECKLIST

Before contacting support, verify:

- [ ] Hard refreshed page (Ctrl+Shift+R)
- [ ] Cleared browser cache
- [ ] Tried incognito mode
- [ ] Checked console for errors
- [ ] Checked network tab for failed requests
- [ ] Waited sufficient time (some operations take 30-60s)
- [ ] Tried different browser
- [ ] Verified internet connection is stable
- [ ] Read relevant section in this debugging guide
- [ ] Disconnected and reconnected QuickBooks (if auth issue)

If all above checked and issue persists, contact support with details.

---

## 🎓 COMMON MISUNDERSTANDINGS

### Not Bugs (Expected Behavior)

1. **"No alerts showing"**
   - If no price drops found, no alerts will appear
   - Empty state is expected
   - NOT a bug ✓

2. **"Cron jobs not running"**
   - Cron jobs run at 2 AM and 3 AM
   - You won't see them execute during review
   - Alerts are pre-loaded for testing
   - NOT a bug ✓

3. **"CSV is empty or has only 1 row"**
   - CSV contains data from Alerts tab
   - If no alerts, CSV will be empty
   - NOT a bug ✓

4. **"Backup file won't open in Excel"**
   - Backup is SQLite database, not Excel file
   - Open with DB Browser for SQLite or similar
   - NOT a bug ✓

5. **"'View' button goes to wrong product"**
   - Retailer URLs can change
   - Product may be discontinued
   - As long as link opens to retailer, it's working
   - NOT a bug ✓

---

**Debugging Guide Version:** 1.1.0  
**Last Updated:** November 13, 2025  
**Status:** Ready for Reviewer Use  

**Need More Help?** Email procuroapp@gmail.com with "URGENT" in subject for priority support.

