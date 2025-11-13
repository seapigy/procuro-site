# 📸 PROCURO - REVIEWER SCREENSHOTS GUIDE

**Version:** 1.1.0  
**Date:** November 13, 2025  
**Purpose:** Visual reference for Intuit reviewers

---

## 📋 OVERVIEW

This document provides placeholders and descriptions for all screenshots that reviewers will see during testing. Actual screenshots will be provided in the submission package.

---

## 🔐 OAUTH FLOW SCREENSHOTS

### Screenshot 1: OAuth Start
**Filename:** `screenshot-oauth-start.png`  
**Location:** QuickBooks Apps menu → Procuro → Connect

**Expected Content:**
- QuickBooks Online interface
- Apps menu visible
- Procuro app card
- "Get App Now" button
- Professional app icon

**Size:** 1920x1080px  
**Format:** PNG

---

### Screenshot 2: OAuth Consent Screen
**Filename:** `screenshot-oauth-consent.png`  
**Location:** Intuit authorization page

**Expected Content:**
```
┌──────────────────────────────────────────────────┐
│  Intuit Authorization                            │
│  ────────────────────────────────────────────    │
│                                                   │
│  [Procuro Logo]                                  │
│                                                   │
│  Procuro - Smart Purchasing Alerts would like to:│
│                                                   │
│  ☑ Access your QuickBooks company data           │
│     (Accounting scope)                           │
│                                                   │
│  ☑ Verify your identity                          │
│     (OpenID)                                     │
│                                                   │
│  ☑ Access your profile information               │
│     (Profile)                                    │
│                                                   │
│  ☑ Access your email address                     │
│     (Email)                                      │
│                                                   │
│  [Cancel]                    [Authorize]         │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Key Elements:**
- App name clearly visible
- All 4 scopes listed with explanations
- Authorize button prominent
- Cancel button available

---

### Screenshot 3: OAuth Complete / Dashboard Load
**Filename:** `screenshot-oauth-complete.png`  
**Location:** After authorization, dashboard loaded inside QuickBooks

**Expected Content:**
- QuickBooks left sidebar visible (Apps, etc.)
- Procuro dashboard in center iframe
- Company name displayed
- Dashboard fully loaded
- No error messages

---

## 📊 DASHBOARD SCREENSHOTS

### Screenshot 4: Dashboard Overview Tab
**Filename:** `screenshot-dashboard-overview.png`  
**Location:** Dashboard → Overview tab (default view)

**Expected Content:**
```
┌──────────────────────────────────────────────────────────┐
│  Procuro    Overview | Items | Alerts | Savings | Reports │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  Welcome back, [Company Name]                             │
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────┐   │
│  │ Monthly Savings │  │ Annual Savings  │  │ Items   │   │
│  │                 │  │                 │  │         │   │
│  │   $247.50       │  │   $2,970.00     │  │    6    │   │
│  └─────────────────┘  └─────────────────┘  └─────────┘   │
│                                                            │
│  ┌────────────────────────────────────────┐               │
│  │ Active Alerts                          │               │
│  │                                        │               │
│  │    3                                   │               │
│  └────────────────────────────────────────┘               │
│                                                            │
│  Recent Alerts                                             │
│  ──────────────────────────────────────────────────────   │
│  Item          Retailer  Old→New     Savings    Action    │
│  Copy Paper    Amazon    $45→$42     $3.50     [View] [X] │
│  BIC Pens      Walmart   $12→$11     $1.00     [View] [X] │
│  Printer Ink   Staples   $68→$62     $6.00     [View] [X] │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Key Elements:**
- 4 metric cards with values
- Recent alerts table (if alerts exist)
- Professional layout
- QuickBooks blue theme (#0077C5)
- Notification bell with badge
- Settings icon

---

### Screenshot 5: Notification Bell with Badge
**Filename:** `screenshot-notification-bell.png`  
**Location:** Top-right corner of dashboard

**Expected Content:**
- Bell icon (🔔)
- Red badge with number (e.g., "3")
- Settings icon nearby
- Theme toggle nearby

**Zoom:** Close-up of top-right corner

---

## 📋 ITEMS PAGE SCREENSHOTS

### Screenshot 6: Items Table
**Filename:** `screenshot-items-table.png`  
**Location:** Dashboard → Items tab

**Expected Content:**
```
┌──────────────────────────────────────────────────────────┐
│  Items                                        [Search bar]│
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  Name           Vendor   SKU      Category   Price  Days  │
│  ────────────────────────────────────────────────────     │
│  Copy Paper     Staples  STR513   Office     $45.99  30   │
│  BIC Pens       Amazon   BIC60    Office     $12.49  45   │
│  Printer Ink    HP       HP64     Tech       $67.99  60   │
│  Lysol Spray    Walmart  LYS32    Cleaning   $8.99   30   │
│  Paper Towels   Amazon   PT12     Supplies   $19.99  14   │
│  Scotch Tape    Staples  SCT24    Office     $4.99   90   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Key Elements:**
- 6+ items visible
- Search bar at top
- Table columns: Name, Vendor, SKU, Category, Last Paid Price, Reorder Interval Days
- Professional table styling

---

### Screenshot 7: Inline Editing Active
**Filename:** `screenshot-inline-edit.png`  
**Location:** Items tab → Clicked on cell to edit

**Expected Content:**
- One cell highlighted/editable
- Input field active with cursor
- Save icon (✓ checkmark) visible
- Cancel icon (X) visible
- Other cells normal (not editable)

**Annotation:** Arrow pointing to editable cell with label "Click to edit"

---

### Screenshot 8: Inline Edit Success
**Filename:** `screenshot-inline-edit-success.png`  
**Location:** After saving edited cell

**Expected Content:**
- Row highlighted green (success state)
- Toast notification at top: "Item updated successfully"
- Changes visible in table
- Save/Cancel icons disappeared

---

### Screenshot 9: Search Filter Active
**Filename:** `screenshot-search-filter.png`  
**Location:** Items tab → Typed in search bar

**Expected Content:**
- Search bar with text (e.g., "paper")
- Table showing only filtered results (2-3 items)
- Clear button (X) in search bar
- Other items hidden (not visible in table)

---

### Screenshot 10: Empty Items State
**Filename:** `screenshot-empty-items.png`  
**Location:** Items tab when no items exist

**Expected Content:**
```
┌──────────────────────────────────────────────────────────┐
│  Items                                                     │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│                       📦                                   │
│                                                            │
│                  No items yet                              │
│                                                            │
│  Connect QuickBooks and add Purchase transactions          │
│  to start tracking items.                                  │
│                                                            │
│             [Connect QuickBooks]                           │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Empty state icon (package)
- Clear message
- Call-to-action button (if applicable)

---

## 🔔 ALERTS PAGE SCREENSHOTS

### Screenshot 11: Alerts List
**Filename:** `screenshot-alerts-list.png`  
**Location:** Dashboard → Alerts tab

**Expected Content:**
```
┌──────────────────────────────────────────────────────────┐
│  Price Drop Alerts                                         │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Copy Paper                            [View] [×]   │   │
│  │ Retailer: Amazon                                   │   │
│  │ Old Price: $45.99 → New Price: $42.49             │   │
│  │ Savings: $3.50 per order                           │   │
│  │ Est. Monthly: $105.00                              │   │
│  │ Alert Date: Nov 13, 2025                           │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ BIC Pens                              [View] [×]   │   │
│  │ Retailer: Walmart                                  │   │
│  │ Old Price: $12.49 → New Price: $11.49             │   │
│  │ Savings: $1.00 per order                           │   │
│  │ Est. Monthly: $30.00                               │   │
│  │ Alert Date: Nov 12, 2025                           │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Multiple alerts in card format
- Each card shows all relevant data
- View and Dismiss buttons
- Professional styling

---

### Screenshot 12: Alert Dismissed
**Filename:** `screenshot-alert-dismissed.png`  
**Location:** After clicking Dismiss button

**Expected Content:**
- Alert removed from list
- Toast notification: "Alert dismissed"
- Remaining alerts visible
- Smooth removal animation

---

## 📊 REPORTS PAGE SCREENSHOTS

### Screenshot 13: Reports Overview
**Filename:** `screenshot-reports-overview.png`  
**Location:** Dashboard → Reports tab

**Expected Content:**
```
┌──────────────────────────────────────────────────────────┐
│  Savings Reports & Analytics              [Export CSV]    │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Monthly     │  │ Annual      │  │ Items       │       │
│  │ $247.50     │  │ $2,970.00   │  │ 6           │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                            │
│  Top Vendors by Savings                                    │
│  ──────────────────────────────────────────────────────   │
│  1  Amazon    ████████████████████████  $105.00/mo        │
│  2  Walmart   ████████████████          $82.50/mo         │
│  3  Staples   ████████████              $67.30/mo         │
│  4  Target    ████████                  $45.00/mo         │
│  5  Best Buy  █████                     $28.00/mo         │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Key Elements:**
- 3 metric cards
- Horizontal bar chart with 5 vendors
- Numbered badges (1-5)
- Gradient bars (blue → green)
- Export CSV button

---

### Screenshot 14: Top Vendors Chart Close-Up
**Filename:** `screenshot-top-vendors-chart.png`  
**Location:** Reports tab → Top Vendors section (zoomed)

**Expected Content:**
- Clear view of horizontal bars
- Numbered badges visible
- Vendor names readable
- Savings amounts visible
- Gradient colors on bars
- Professional styling

---

### Screenshot 15: CSV Export Downloaded
**Filename:** `screenshot-csv-export.png`  
**Location:** After clicking Export CSV button

**Expected Content:**
- Browser download notification (Chrome/Edge)
- Filename: `procuro-savings-report-2025-11-13.csv`
- File size visible
- Downloads folder showing file

**Optional:** Screenshot of CSV opened in Excel/Sheets showing data

---

## ⚙️ SETTINGS PAGE SCREENSHOTS

### Screenshot 16: Settings Modal
**Filename:** `screenshot-settings-modal.png`  
**Location:** Dashboard → Clicked Settings icon

**Expected Content:**
```
┌──────────────────────────────────────────────────────────┐
│  Settings                                            [X]   │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  Automatic Price Checking                                 │
│  Enable daily automated price checks                       │
│  [Toggle: ON (green)]                                     │
│                                                            │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  Notification Frequency                                    │
│  ( ) Daily    (●) Weekly    ( ) Manual                    │
│                                                            │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  Min Price Drop %                                          │
│  [=====●=====] 5%                                         │
│                                                            │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  Database Backup                                           │
│  Download a backup of your local database                  │
│  [Download Backup]                                         │
│                                                            │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  Theme                                                     │
│  ( ) Light    ( ) Dark    (●) System                      │
│                                                            │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│  [Reset to Defaults]  [Cancel]        [Save Settings]     │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Modal overlay with backdrop blur
- All settings sections visible
- Auto-check toggle
- Backup button
- Save/Cancel buttons

---

### Screenshot 17: Auto-Check Toggle
**Filename:** `screenshot-auto-check-toggle.png`  
**Location:** Settings modal → Auto-check section (zoomed)

**Expected Content:**
- Close-up of toggle switch
- Two states shown (ON: green, OFF: gray)
- Label: "Automatic Price Checking"
- Description text visible

---

### Screenshot 18: Backup Download
**Filename:** `screenshot-backup-download.png`  
**Location:** After clicking Download Backup button

**Expected Content:**
- Button text: "Downloading..."
- Browser download notification
- Filename: `procuro-backup-2025-11-13.sqlite`
- File size visible (50-500 KB)
- Toast: "Backup downloaded successfully"

---

## ⚠️ ERROR & EDGE CASE SCREENSHOTS

### Screenshot 19: OAuth Declined
**Filename:** `screenshot-oauth-declined.png`  
**Location:** After clicking Cancel on OAuth screen

**Expected Content:**
- Error message displayed
- Text: "Authorization was not completed. Please try connecting again."
- Retry button or link to QuickBooks
- No console errors

---

### Screenshot 20: Network Error
**Filename:** `screenshot-network-error.png`  
**Location:** Dashboard when offline

**Expected Content:**
- Loading spinner (or error icon)
- Toast message: "Connection issue. Please check your internet and try again."
- Retry button
- App not crashed

---

### Screenshot 21: Invalid Invite
**Filename:** `screenshot-invalid-invite.png`  
**Location:** https://procuroapp.com/invite/invalid-token-12345

**Expected Content:**
```
┌──────────────────────────────────────────────────────────┐
│  Procuro                                                   │
│  ──────────────────────────────────────────────────────   │
│                                                            │
│                       ⚠️                                   │
│                                                            │
│          This invite link has expired or is invalid        │
│                                                            │
│  Please contact your administrator for a new invite.       │
│                                                            │
│                [Back to Home]                              │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Error icon
- Clear error message
- Call-to-action button

---

## 📝 SCREENSHOT GUIDELINES

### For Actual Submission:

**Resolution:** 1920x1080px (Full HD) minimum  
**Format:** PNG (preferred) or JPG  
**Color:** RGB color space  
**Size:** Under 2MB per image  
**Annotations:** Optional arrows/labels to highlight features

### Best Practices:

1. **No Browser Chrome:** Crop to show only app content (unless showing QuickBooks iframe)
2. **Realistic Data:** Use realistic mock data, not "Lorem ipsum" or "Test 123"
3. **Professional Appearance:** Clean, organized, professional-looking data
4. **Consistent Theme:** All screenshots should use same theme (light or dark)
5. **High Quality:** Sharp, clear images with no compression artifacts
6. **Privacy:** No real company data or personal information

### Screenshot Checklist:

- [ ] All 21 screenshots taken
- [ ] Resolution 1920x1080 or higher
- [ ] PNG format
- [ ] Under 2MB each
- [ ] No browser chrome (except OAuth screens)
- [ ] Realistic mock data
- [ ] Professional appearance
- [ ] No personal/sensitive data

---

## 📂 FILE ORGANIZATION

Place screenshots in:

```
/client/public/assets/appstore/screenshots/

screenshot-oauth-start.png
screenshot-oauth-consent.png
screenshot-oauth-complete.png
screenshot-dashboard-overview.png
screenshot-notification-bell.png
screenshot-items-table.png
screenshot-inline-edit.png
screenshot-inline-edit-success.png
screenshot-search-filter.png
screenshot-empty-items.png
screenshot-alerts-list.png
screenshot-alert-dismissed.png
screenshot-reports-overview.png
screenshot-top-vendors-chart.png
screenshot-csv-export.png
screenshot-settings-modal.png
screenshot-auto-check-toggle.png
screenshot-backup-download.png
screenshot-oauth-declined.png
screenshot-network-error.png
screenshot-invalid-invite.png
```

---

**Screenshots Guide Version:** 1.1.0  
**Last Updated:** November 13, 2025  
**Status:** Ready for Screenshot Capture

