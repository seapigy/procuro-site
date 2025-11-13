# ✅ PROCURO - REVIEWER TESTING CHECKLIST

**Version:** 1.1.0  
**Date:** November 13, 2025  
**Reviewer:** ___________________________  
**Review Date:** ___________________________

---

## 📋 PRE-FLIGHT CHECKLIST

Before starting the review:

- [ ] QuickBooks Online Sandbox account ready
- [ ] Chrome or Edge browser (latest version)
- [ ] Popups enabled for procuroapp.com
- [ ] 20-25 minutes allocated for testing
- [ ] Developer Tools open (optional, for debugging)

---

## 🌐 PUBLIC PAGES VERIFICATION

Test all public URLs:

- [ ] https://procuroapp.com/ → Landing page loads
- [ ] https://procuroapp.com/privacy → Privacy policy displays
- [ ] https://procuroapp.com/terms → Terms of service displays
- [ ] https://procuroapp.com/support → Support page displays
- [ ] https://procuroapp.com/qbo_embed/iframe-loader.html → Loader displays
- [ ] All pages use HTTPS (lock icon in browser)
- [ ] No 404 errors
- [ ] Professional appearance

---

## 🔐 OAUTH FLOW TEST

Test the QuickBooks connection:

- [ ] Launched app from QuickBooks Apps menu
- [ ] OAuth authorization screen appears
- [ ] App name shows: "Procuro - Smart Purchasing Alerts"
- [ ] 4 scopes displayed: Accounting, OpenID, Profile, Email
- [ ] Clicked "Authorize" button
- [ ] Redirect completed successfully
- [ ] Dashboard loaded inside iframe
- [ ] Company name displays correctly
- [ ] No errors in console
- [ ] QuickBooks sidebar remains visible

**Time to Complete:** __________ seconds  
**Pass/Fail:** __________  
**Notes:**  
_________________________________________________________

---

## 📊 DASHBOARD TEST

Verify dashboard functionality:

- [ ] Overview tab selected by default
- [ ] 4 metric cards visible (Monthly, Annual, Items, Alerts)
- [ ] Metric cards show values (not "0" or "loading")
- [ ] Recent alerts table displays (if alerts exist)
- [ ] Notification bell visible in top-right
- [ ] Badge count shows on bell (if alerts exist)
- [ ] Settings icon (gear) visible
- [ ] Theme toggle visible (sun/moon icon)
- [ ] All navigation tabs clickable
- [ ] No JavaScript errors in console
- [ ] Dashboard responsive (resize test)

**Pass/Fail:** __________  
**Notes:**  
_________________________________________________________

---

## 📋 ITEMS PAGE TEST

Test Items management:

### Basic Functionality
- [ ] Clicked "Items" tab
- [ ] Items table displays
- [ ] At least 3 items visible (mock or imported)
- [ ] Column headers: Name, Vendor, SKU, Category, Price, Reorder Interval
- [ ] Search bar visible at top

### Inline Editing (v1.1.0)
- [ ] Clicked on item name cell
- [ ] Cell became editable
- [ ] Changed item name
- [ ] Clicked Save icon (✓)
- [ ] Row highlighted green (success feedback)
- [ ] Toast notification: "Item updated successfully"
- [ ] Clicked on vendor cell
- [ ] Changed vendor name
- [ ] Saved successfully
- [ ] Clicked Cancel icon (X)
- [ ] Changes reverted

### Input Validation
- [ ] Tried to save empty item name
- [ ] Alert showed: "Item name cannot be empty"
- [ ] Changes not saved

### Quick Search (v1.1.0)
- [ ] Typed search term in search bar
- [ ] Table filtered instantly (<50ms)
- [ ] Search case-insensitive
- [ ] Searched by: name, vendor, SKU, category
- [ ] Clicked X to clear search
- [ ] All items reappeared
- [ ] Refreshed page
- [ ] Search query persisted (localStorage)

### Empty State
- [ ] Searched for "xyz123nonexistent"
- [ ] Empty state displayed
- [ ] Message: "No items match '[search]'"
- [ ] Clear button available

**Pass/Fail:** __________  
**Notes:**  
_________________________________________________________

---

## 🔔 ALERTS PAGE TEST

Test price drop alerts:

- [ ] Clicked "Alerts" tab
- [ ] At least 1 alert displayed
- [ ] Each alert shows:
  - [ ] Item name
  - [ ] Retailer (Amazon, Walmart, etc.)
  - [ ] Old price → New price
  - [ ] Savings per order
  - [ ] Estimated monthly savings
  - [ ] Action buttons (View, Dismiss)

### Alert Actions
- [ ] Clicked "View" button
- [ ] New tab opened with retailer link
- [ ] URL is external (amazon.com, walmart.com, etc.)
- [ ] Clicked "Dismiss" button
- [ ] Alert removed from list
- [ ] Toast: "Alert dismissed"
- [ ] Notification bell badge count decreased

### Auto-Mark as Seen
- [ ] Notification bell badge showed count (e.g., "3")
- [ ] Viewed Alerts tab
- [ ] Badge count reset to 0
- [ ] Alerts still visible but marked as viewed

### Empty State (if no alerts)
- [ ] Empty state icon displayed
- [ ] Message: "No price drop alerts yet"
- [ ] No errors

**Pass/Fail:** __________  
**Notes:**  
_________________________________________________________

---

## 📊 REPORTS PAGE TEST

Test analytics and reporting:

### Layout
- [ ] Clicked "Reports" tab
- [ ] 3 metric cards at top (Monthly, Annual, Items)
- [ ] Top Vendors chart visible
- [ ] Top 5 Items list visible
- [ ] Export CSV button visible

### Top Vendors Chart (v1.1.0)
- [ ] Horizontal bar chart displays
- [ ] 5 vendors listed
- [ ] Numbered badges (1-5) present
- [ ] Vendor names visible
- [ ] Gradient bars (blue → green)
- [ ] Savings amounts displayed ($XX.XX/mo)
- [ ] Bar widths proportional to savings
- [ ] No console errors
- [ ] Chart responsive

### CSV Export
- [ ] Clicked "Export CSV" button
- [ ] CSV file downloaded immediately
- [ ] Filename format: `procuro-savings-report-YYYY-MM-DD.csv`
- [ ] File size: 1-50 KB
- [ ] Opened CSV file
- [ ] Headers present: Item Name, Retailer, Old Price, New Price, Savings Per Order, Est. Monthly Savings
- [ ] Data rows present (at least 1)
- [ ] Proper CSV formatting
- [ ] Values match displayed data
- [ ] No corruption

**Pass/Fail:** __________  
**Notes:**  
_________________________________________________________

---

## ⚙️ SETTINGS PAGE TEST

Test user preferences:

### Modal Open
- [ ] Clicked Settings icon (gear)
- [ ] Modal overlaid dashboard
- [ ] Backdrop blurred background
- [ ] All settings sections visible
- [ ] Modal animation smooth

### Auto-Check Toggle (v1.1.0)
- [ ] "Automatic Price Checking" section visible
- [ ] Toggle switch visible (default: ON/green)
- [ ] Clicked toggle to OFF (gray)
- [ ] Clicked "Save Settings"
- [ ] Toast: "Settings saved successfully"
- [ ] Closed modal
- [ ] Reopened modal
- [ ] Toggle still OFF
- [ ] Refreshed page
- [ ] Reopened modal
- [ ] Toggle still OFF (persisted)

### Database Backup (v1.1.0)
- [ ] "Database Backup" section visible
- [ ] Clicked "Download Backup" button
- [ ] Button text changed to "Downloading..."
- [ ] SQLite file downloaded (1-3 seconds)
- [ ] Filename: `procuro-backup-YYYY-MM-DD.sqlite`
- [ ] File size: 50-500 KB
- [ ] Toast: "Backup downloaded successfully"
- [ ] (Optional) Opened .sqlite file in DB browser
- [ ] (Optional) Tables present: Company, User, Item, Price, Alert, etc.
- [ ] (Optional) Data present in tables

### Settings Persistence
- [ ] Changed multiple settings
- [ ] Clicked "Save Settings"
- [ ] Closed modal
- [ ] Refreshed entire page (F5)
- [ ] Reopened Settings modal
- [ ] All changes persisted

### Reset to Defaults
- [ ] Clicked "Reset to Defaults"
- [ ] All settings reset
- [ ] Toast: "Settings reset to defaults"

**Pass/Fail:** __________  
**Notes:**  
_________________________________________________________

---

## ⚠️ FAILURE MODE TESTING

Test error handling:

### OAuth Declined
- [ ] Started OAuth flow
- [ ] Clicked "Cancel" or "Deny"
- [ ] Error message displayed
- [ ] Message: "Authorization was not completed..."
- [ ] No console errors
- [ ] Can retry connection

### Network Error
- [ ] Simulated offline mode (DevTools → Network → Offline)
- [ ] Tried to navigate or refresh
- [ ] Loading spinner displayed
- [ ] After timeout, error message showed
- [ ] Toast: "Connection issue..."
- [ ] App didn't crash
- [ ] Restored online mode

### Empty States
- [ ] Tested Items tab with no items → Empty state displays
- [ ] Tested Alerts tab with no alerts → Empty state displays
- [ ] Tested Reports with no data → Empty state or default values
- [ ] All empty states professional and clear

### Invalid Input
- [ ] Tried to save empty item name → Validation error
- [ ] Tried to save negative price → Validation error
- [ ] Changes not saved

### Invalid Invite
- [ ] Visited: https://procuroapp.com/invite/invalid-token-12345
- [ ] Error message displayed
- [ ] Message: "This invite link has expired or is invalid"
- [ ] No console errors

**Pass/Fail:** __________  
**Notes:**  
_________________________________________________________

---

## 🔐 SECURITY VERIFICATION

Verify security measures:

### Privacy & Terms
- [ ] Privacy policy mentions AES-256-GCM encryption
- [ ] Privacy policy states "no data selling/sharing"
- [ ] Terms include "as-is" disclaimer
- [ ] Terms include limitation of liability
- [ ] Support page has contact email

### Blocked Paths
- [ ] Tried to access: https://procuroapp.com/server/
- [ ] Result: HTTP 403 Forbidden
- [ ] Tried to access: https://procuroapp.com/.env
- [ ] Result: HTTP 403 Forbidden
- [ ] Tried to access: https://procuroapp.com/db/
- [ ] Result: HTTP 403 Forbidden

### HTTPS Enforcement
- [ ] All pages use HTTPS (lock icon)
- [ ] No mixed content warnings
- [ ] SSL certificate valid

**Pass/Fail:** __________  
**Notes:**  
_________________________________________________________

---

## 🎯 FINAL VERIFICATION

Overall assessment:

### Technical Requirements
- [ ] manifest.json is valid (check Intuit Developer Dashboard)
- [ ] OAuth scopes justified
- [ ] All API endpoints working
- [ ] No critical bugs found
- [ ] Responsive design confirmed (desktop, tablet)

### UX/UI Requirements
- [ ] Professional QuickBooks-style design
- [ ] Consistent branding (#0077C5 blue)
- [ ] Smooth animations and transitions
- [ ] Clear user feedback (toasts, alerts)
- [ ] Intuitive navigation
- [ ] No console errors

### Documentation
- [ ] README.md exists and is clear
- [ ] Support resources available
- [ ] Contact information provided

---

## ✅ APPROVAL DECISION

### Summary

**Total Tests:** __________ (completed)  
**Passed:** __________  
**Failed:** __________  
**Warnings:** __________

### Critical Issues Found

List any blocking issues:

1. _________________________________________________________
2. _________________________________________________________
3. _________________________________________________________

### Non-Critical Issues Found

List any minor issues:

1. _________________________________________________________
2. _________________________________________________________
3. _________________________________________________________

### Recommendation

- [ ] **APPROVE** - App meets all requirements
- [ ] **REQUEST CHANGES** - Address issues listed above
- [ ] **REJECT** - Critical failures or guideline violations

### Reviewer Comments

_________________________________________________________
_________________________________________________________
_________________________________________________________
_________________________________________________________
_________________________________________________________

### Reviewer Signature

**Name:** ___________________________  
**Date:** ___________________________  
**Intuit Review ID:** ___________________________

---

## 📞 CONTACT FOR CLARIFICATIONS

If you need any clarification during review:

**Developer Email:** procuroapp@gmail.com  
**Subject:** "QuickBooks App Review - [Your Question]"  
**Expected Response:** Within 24 hours (weekdays)

---

**Checklist Version:** 1.1.0  
**Last Updated:** November 13, 2025  
**Status:** Ready for Intuit Review

