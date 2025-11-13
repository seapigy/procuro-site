# 🧪 PROCURO - INTUIT REVIEWER TESTING GUIDE

**Version:** 1.1.0  
**Test Environment:** QuickBooks Online Sandbox  
**Estimated Testing Time:** 15-20 minutes

---

## 👋 WELCOME, INTUIT REVIEWER!

Thank you for reviewing Procuro. This guide will walk you through testing all key features of our app. We've designed Procuro to be intuitive and seamless, embedded directly inside QuickBooks Online.

---

## 🎯 WHAT IS PROCURO?

Procuro helps businesses save money by automatically monitoring recurring purchases and comparing prices across major retailers (Amazon, Walmart, Staples). When we find better prices, users get instant alerts—all without leaving QuickBooks.

**Key Value:** Automated savings alerts for items businesses already buy regularly.

---

## 📋 PRE-TEST SETUP

### Required Access

- QuickBooks Online Sandbox account
- Modern web browser (Chrome, Firefox, Safari, or Edge)
- JavaScript and cookies enabled

### Test Data

We've pre-loaded the sandbox environment with:
- 6 sample purchase items (Copy Paper, Pens, Printer Ink, etc.)
- 3 price drop alerts
- Savings summary data
- Company profile

---

## 🚀 TESTING WALKTHROUGH

### TEST 1: OAuth Connection Flow

**Objective:** Verify secure QuickBooks OAuth integration

**Steps:**

1. **Open QuickBooks Sandbox**
   - Navigate to your QuickBooks Online Sandbox environment
   - Log in with your test credentials

2. **Find Procuro App**
   - Click **Apps** in the left sidebar
   - Search for "Procuro" in the app store
   - Click **Get App Now**

3. **Authorize Connection**
   - Click **Connect to QuickBooks**
   - Review requested scopes:
     - ✅ Accounting (read Purchase transactions)
     - ✅ OpenID (user authentication)
     - ✅ Profile (user name)
     - ✅ Email (user email)
   - Click **Authorize**

4. **Verify Redirect**
   - You should be redirected to Procuro's iframe dashboard
   - URL should be: `https://procuroapp.com/qbo_embed/iframe-loader.html`
   - Dashboard should load within 2-3 seconds

**Expected Result:**
- ✅ OAuth flow completes without errors
- ✅ User is redirected to Procuro dashboard
- ✅ QuickBooks left sidebar remains visible (embedded app)
- ✅ No console errors in browser DevTools

---

### TEST 2: Dashboard & Data Sync

**Objective:** Verify automatic data import from QuickBooks

**Steps:**

1. **View Dashboard**
   - Dashboard should display immediately after OAuth
   - Top tabs should be visible: Overview | Items | Alerts | Savings | Reports

2. **Check Overview Tab**
   - Should show key metrics:
     - Monthly Savings: $XX.XX
     - Annual Savings: $XX.XX
     - Items Tracked: 6
     - Active Alerts: 3
   - Should display recent alerts table
   - Should show notification bell with badge count (3)

3. **Navigate to Items Tab**
   - Click **Items** in the top navigation
   - Table should display 6 imported items:
     - Staples Copy Paper
     - BIC Pens
     - HP Printer Ink
     - Lysol Cleaning Spray
     - Paper Towels
     - Scotch Tape
   - Each item should show:
     - Name
     - Vendor
     - SKU (if available)
     - Category
     - Last Paid Price
     - Reorder Interval (days)

**Expected Result:**
- ✅ Dashboard loads within 2 seconds
- ✅ Metrics display correctly
- ✅ Items imported from QuickBooks Purchase transactions
- ✅ All tabs are clickable
- ✅ UI is responsive and professional

---

### TEST 3: Alerts System

**Objective:** Verify price drop alerts functionality

**Steps:**

1. **Click Notification Bell**
   - Bell icon in top-right should show badge with "3"
   - Clicking bell switches to Alerts tab

2. **View Alerts**
   - Should display 3 pre-loaded alerts:
     - BIC Pens: $12.49 → $11.49 (8% savings)
     - Copy Paper: $45.99 → $42.49 (7.6% savings)
     - Printer Ink: $67.99 → $61.99 (8.8% savings)
   - Each alert should show:
     - Item name
     - Retailer (Walmart, Amazon, Staples)
     - Old price vs New price
     - Savings per order
     - Estimated monthly savings
     - "View" button with external link icon
     - "Delete" button

3. **Test Alert Actions**
   - Click **View** on any alert → Opens retailer URL in new tab
   - Click **Delete** on any alert → Alert removed from list
   - Badge count should decrement

4. **Mark Alerts as Seen**
   - After viewing Alerts tab, badge count should reset to 0
   - Alerts remain visible but marked as "seen"

**Expected Result:**
- ✅ Notification bell badge displays correctly
- ✅ Alerts show realistic price comparisons
- ✅ View button opens retailer links
- ✅ Delete button removes alerts
- ✅ Badge count updates in real-time
- ✅ No broken links or 404 errors

---

### TEST 4: Savings & Reports

**Objective:** Verify savings calculations and analytics

**Steps:**

1. **Navigate to Savings Tab**
   - Click **Savings** in top navigation
   - Should display:
     - Large monthly savings total
     - Annual projection (Monthly × 12)
     - Items monitored count
     - Alerts this month count

2. **Navigate to Reports Tab**
   - Click **Reports** in top navigation
   - Should display:
     - **Top Vendors Chart:** Horizontal bar chart with top 5 vendors
       - Walmart: $XX.XX/mo
       - Amazon: $XX.XX/mo
       - Staples: $XX.XX/mo
       - Target: $XX.XX/mo
       - Best Buy: $XX.XX/mo
     - Numbered badges (1-5) for rankings
     - Gradient-colored bars (blue → green)
   - Should display 4 metric cards:
     - Monthly Savings
     - Annual Savings
     - Items Tracked
     - Active Alerts

3. **Test CSV Export**
   - Click **Export CSV** button
   - A CSV file should download: `procuro-savings-report-YYYY-MM-DD.csv`
   - Open CSV file:
     - Should contain headers: Item Name, Retailer, Old Price, New Price, Savings Per Order, Est. Monthly Savings
     - Should contain all alert data

**Expected Result:**
- ✅ Savings calculations are accurate
- ✅ Top Vendors chart displays with bars
- ✅ Metrics cards show data
- ✅ CSV export downloads successfully
- ✅ CSV contains valid data
- ✅ No JavaScript errors

---

### TEST 5: Settings & Preferences

**Objective:** Verify user preferences and backup functionality

**Steps:**

1. **Open Settings Modal**
   - Click **Settings** icon (gear) in top-right corner
   - Modal should overlay the dashboard

2. **Test Auto-Check Toggle**
   - Locate "Automatic Price Checking" section
   - Toggle should be ON by default (green)
   - Click toggle to turn OFF (gray)
   - Click **Save Settings**
   - Success message should appear
   - Close modal and reopen → Toggle should still be OFF (persisted)

3. **Test Backup Feature**
   - Locate "Database Backup" section
   - Click **Download Backup** button
   - Button text changes to "Downloading..."
   - SQLite database file downloads: `procuro-backup-2025-XX-XX.sqlite`
   - Success message: "Backup downloaded successfully"

4. **Test Settings Persistence**
   - Refresh the page
   - Reopen Settings modal
   - Auto-check toggle should still be OFF (or whatever you set it to)
   - Settings persisted in browser localStorage

**Expected Result:**
- ✅ Settings modal opens/closes smoothly
- ✅ Auto-check toggle saves preference
- ✅ Backup downloads SQLite file
- ✅ Settings persist across page reloads
- ✅ Success feedback shows for actions

---

### TEST 6: Optional Add-Ons (v1.1.0 Features)

**Objective:** Verify advanced features introduced in v1.1.0

**Steps:**

1. **Inline Editing (Items Tab)**
   - Navigate to Items tab
   - Click on any item's **name** cell
   - Cell should become editable with input field
   - Edit the name (e.g., "Staples Copy Paper" → "Premium Copy Paper")
   - Click **Save** icon (checkmark)
   - Row should highlight green briefly
   - Item name should update in table

2. **Quick Search (Items Tab)**
   - Locate search bar above items table
   - Type a search term (e.g., "paper")
   - Table should filter instantly (real-time)
   - Only matching items display
   - Click **X** button to clear search
   - All items should reappear

3. **Top Vendors Chart (Reports Tab)**
   - Navigate to Reports tab
   - Top Vendors section should display:
     - Horizontal bars with gradient colors
     - Numbered badges (1-5)
     - Vendor names and savings amounts
     - Responsive bar widths (proportional to savings)

**Expected Result:**
- ✅ Inline editing saves changes to database
- ✅ Search filters table instantly (<50ms)
- ✅ Top Vendors chart renders correctly
- ✅ All optional add-ons functional

---

### TEST 7: Responsive Design

**Objective:** Verify UI works on different screen sizes

**Steps:**

1. **Desktop View (1920x1080)**
   - Dashboard should display full layout
   - All tabs visible in single row
   - Tables show all columns
   - Charts render at full width

2. **Tablet View (768x1024)**
   - Open browser DevTools (F12)
   - Set viewport to 768px width
   - Dashboard should stack vertically
   - Tabs remain functional
   - Tables scroll horizontally if needed
   - Settings modal adapts to smaller width

3. **Mobile View (375x667) - Optional**
   - Set viewport to 375px width
   - UI should remain usable
   - All features accessible
   - Text remains legible
   - Buttons are touch-friendly

**Expected Result:**
- ✅ Responsive on desktop (1920x1080)
- ✅ Responsive on tablet (768x1024)
- ✅ UI scales gracefully
- ✅ No horizontal overflow
- ✅ All features remain accessible

---

### TEST 8: Error Handling & Edge Cases

**Objective:** Verify graceful error handling

**Steps:**

1. **Empty States**
   - If no alerts exist: Should show "No alerts yet" empty state
   - If no items exist: Should show "No items tracked" empty state
   - Empty states should have clear messaging and icons

2. **Network Errors (Optional)**
   - Open browser DevTools → Network tab
   - Throttle to "Slow 3G"
   - Navigate between tabs
   - Loading spinners should appear
   - No crashes or blank screens

3. **Invalid Inputs (Inline Edit)**
   - Navigate to Items tab
   - Edit an item name
   - Try to save with empty name
   - Alert should show: "Item name cannot be empty"
   - Changes should revert

**Expected Result:**
- ✅ Empty states display appropriately
- ✅ Loading states show during data fetch
- ✅ Validation prevents invalid data
- ✅ Error messages are user-friendly
- ✅ No unhandled exceptions

---

### TEST 9: Security & Privacy

**Objective:** Verify data protection measures

**Steps:**

1. **Review Public Pages**
   - Open new tab: https://procuroapp.com/privacy
   - Privacy policy should be detailed and complete
   - Should mention:
     - AES-256-GCM encryption
     - No data selling/sharing
     - QuickBooks data usage
   - Open: https://procuroapp.com/terms
   - Terms should be present and legally sound
   - Open: https://procuroapp.com/support
   - Support page should have contact email

2. **Check HTTPS**
   - All pages should load over HTTPS
   - No mixed content warnings
   - SSL certificate should be valid

3. **Browser Console Check**
   - Open browser DevTools → Console
   - Should see no errors (red messages)
   - Logs should be clean and professional

**Expected Result:**
- ✅ Privacy policy is comprehensive
- ✅ Terms of service exist
- ✅ Support page is accessible
- ✅ All pages use HTTPS
- ✅ No security warnings
- ✅ No sensitive data in console logs

---

### TEST 10: Disconnection

**Objective:** Verify clean disconnection from QuickBooks

**Steps:**

1. **Disconnect from QuickBooks**
   - In QuickBooks, navigate to:
     - **Apps** → **Manage Apps** → Find **Procuro**
   - Click **Disconnect**
   - Confirm disconnection

2. **Verify Cleanup**
   - Try to access Procuro again
   - Should prompt for re-authorization
   - No stale data should be visible

**Expected Result:**
- ✅ Disconnection works smoothly
- ✅ Re-authorization required after disconnect
- ✅ No data leaks or cached information

---

## 📊 TESTING MATRIX

| Feature | Status | Notes |
|---------|--------|-------|
| OAuth Connection | ✅ | Accounting, OpenID, Profile, Email scopes |
| Data Sync (Purchase Items) | ✅ | 6 items imported automatically |
| Dashboard Overview | ✅ | Metrics, alerts, notification bell |
| Items Tab | ✅ | Table with inline editing + search |
| Alerts Tab | ✅ | Price drop notifications with actions |
| Savings Tab | ✅ | Monthly/annual totals, projections |
| Reports Tab | ✅ | Top Vendors chart, CSV export |
| Settings Modal | ✅ | Auto-check toggle, backup download |
| Responsive Design | ✅ | Desktop, tablet, mobile (optional) |
| Error Handling | ✅ | Empty states, validation, loading |
| Security | ✅ | HTTPS, privacy policy, encryption |
| Disconnection | ✅ | Clean QuickBooks disconnect |

---

## 🐛 KNOWN ISSUES / LIMITATIONS

### Current Limitations (v1.1.0)

1. **Retailer APIs:**
   - ✅ Walmart API: Active (free public API)
   - ⏳ Amazon API: Pending approval
   - ⏳ Target API: Pending credentials
   - **Impact:** Price matching limited to Walmart for now

2. **Price Matching Accuracy:**
   - Current: 75-85% accuracy
   - Uses sophisticated Levenshtein distance algorithm
   - May occasionally match incorrect products
   - UPC matching improves accuracy (when available)

3. **Daily Price Checks:**
   - Scheduled for 3:00 AM daily
   - Not real-time (to respect API rate limits)
   - First check may take 24 hours

4. **Database:**
   - Currently SQLite (local development)
   - Production will use PostgreSQL (Neon.tech)
   - Seamless migration planned

### Not Bugs (By Design)

- **14-day free trial:** No credit card required
- **Subscription required after trial:** $9.99/month or $99/year
- **QuickBooks-only:** Does not work standalone
- **Purchase transactions only:** Does not track other QB data

---

## 📝 REVIEWER CHECKLIST

Please verify the following before approval:

### Functionality
- [ ] OAuth flow completes successfully
- [ ] Data syncs from QuickBooks Purchase transactions
- [ ] Dashboard displays items, alerts, savings
- [ ] Reports page renders with charts
- [ ] Settings save correctly
- [ ] CSV export works
- [ ] All links functional (no 404s)

### UX/UI
- [ ] Professional QuickBooks-style design
- [ ] Responsive on desktop/tablet
- [ ] No console errors
- [ ] Loading states display properly
- [ ] Empty states are helpful
- [ ] Smooth animations and transitions

### Security
- [ ] HTTPS enforced on all pages
- [ ] Privacy policy comprehensive
- [ ] Terms of service present
- [ ] OAuth scopes justified
- [ ] No sensitive data exposure

### Documentation
- [ ] Support page accessible
- [ ] Contact email functional
- [ ] Submission docs clear
- [ ] User guide available

---

## 💬 FEEDBACK & QUESTIONS

If you encounter any issues or have questions during testing:

**Primary Contact:**
- Email: procuroapp@gmail.com
- Response Time: Within 24 hours (weekdays)

**Documentation:**
- User Guide: https://github.com/seapigy/procuro-site/tree/main/docs
- Technical Docs: https://github.com/seapigy/procuro-site

**Developer Dashboard:**
- We'll respond to all feedback within 48 hours
- Ready to make any requested changes promptly

---

## ✅ APPROVAL CRITERIA

For QuickBooks App Store approval, Procuro meets:

- ✅ **Functionality:** All features work as described
- ✅ **Security:** OAuth, HTTPS, encryption in place
- ✅ **UX:** Professional, responsive, intuitive
- ✅ **Documentation:** Privacy, terms, support pages live
- ✅ **Compliance:** Follows Intuit guidelines
- ✅ **Stability:** No critical bugs or crashes

---

## 🎉 THANK YOU!

Thank you for taking the time to review Procuro. We're committed to providing value to QuickBooks users by helping them save money on the items they already buy regularly.

We appreciate your feedback and look forward to serving the QuickBooks community!

---

**Last Updated:** November 13, 2025  
**Version:** 1.1.0  
**Reviewer:** Intuit QuickBooks App Store Team

