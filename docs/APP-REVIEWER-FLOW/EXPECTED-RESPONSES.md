# 📡 PROCURO - EXPECTED API RESPONSES

**Version:** 1.1.0  
**Date:** November 13, 2025  
**Purpose:** Reference for Intuit reviewers to validate API responses

---

## 📋 OVERVIEW

This document provides expected JSON responses for all Procuro API endpoints. Reviewers can use browser Developer Tools (Network tab) to verify these responses during testing.

---

## 🔍 HOW TO VIEW API RESPONSES

### Using Chrome/Edge Developer Tools:

1. Press **F12** to open Developer Tools
2. Click **Network** tab
3. Check "Preserve log" (to keep requests after page navigation)
4. Perform action in Procuro (e.g., load dashboard, edit item)
5. Find API request in Network tab (filter by "Fetch/XHR")
6. Click request → Click "Response" tab
7. View JSON response

---

## 🏥 HEALTH CHECK ENDPOINT

### Request

```http
GET /health HTTP/1.1
Host: localhost:5000
```

### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "status": "ok",
  "db": true,
  "version": "1.1.0",
  "time": "2025-11-13T15:30:45.123Z",
  "uptime": 3600,
  "environment": "development"
}
```

**Field Descriptions:**
- `status`: "ok" or "error"
- `db`: Database connection status (true/false)
- `version`: App version from config/app.json
- `time`: Current ISO timestamp
- `uptime`: Server uptime in seconds
- `environment`: "development" or "production"

---

## 📦 ITEMS ENDPOINTS

### GET /api/items

**Purpose:** Fetch all tracked items for the authenticated user

#### Request

```http
GET /api/items HTTP/1.1
Host: localhost:5000
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "success": true,
  "items": [
    {
      "id": 1,
      "userId": 1,
      "companyId": 1,
      "name": "Staples Copy Paper, 8.5\" x 11\", Case",
      "vendorName": "Staples",
      "sku": "STR513096",
      "category": "Office Supplies",
      "lastPaidPrice": 45.99,
      "upc": "061875246738",
      "reorderIntervalDays": 30,
      "estimatedMonthlyOrders": 1,
      "matchedRetailer": "Amazon",
      "matchedUrl": "https://www.amazon.com/dp/B0000123",
      "matchedPrice": 42.49,
      "createdAt": "2025-11-10T12:00:00.000Z",
      "updatedAt": "2025-11-13T14:30:00.000Z"
    },
    {
      "id": 2,
      "userId": 1,
      "companyId": 1,
      "name": "BIC Round Stic Ballpoint Pens, 60-Pack",
      "vendorName": "Amazon",
      "sku": "BIC-GSM609-BLK",
      "category": "Office Supplies",
      "lastPaidPrice": 12.49,
      "upc": "070330336094",
      "reorderIntervalDays": 45,
      "estimatedMonthlyOrders": 0.67,
      "matchedRetailer": "Walmart",
      "matchedUrl": "https://www.walmart.com/ip/123456",
      "matchedPrice": 11.49,
      "createdAt": "2025-11-10T12:00:00.000Z",
      "updatedAt": "2025-11-13T14:30:00.000Z"
    }
  ],
  "count": 2
}
```

**Field Descriptions:**
- `id`: Unique item identifier
- `userId`: User who owns the item
- `companyId`: Company associated with item
- `name`: Item name (from QuickBooks or user-edited)
- `vendorName`: Vendor/supplier name
- `sku`: Stock Keeping Unit
- `category`: Item category
- `lastPaidPrice`: Last price paid in QuickBooks
- `upc`: Universal Product Code (optional)
- `reorderIntervalDays`: How often item is reordered
- `estimatedMonthlyOrders`: Calculated: 30 / reorderIntervalDays
- `matchedRetailer`: Best match found by price check
- `matchedUrl`: Product URL at matched retailer
- `matchedPrice`: Current price at matched retailer
- `createdAt`: Record creation timestamp
- `updatedAt`: Last update timestamp

---

### PATCH /api/items/:id

**Purpose:** Update an item (inline editing feature)

#### Request

```http
PATCH /api/items/1 HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "name": "Premium Copy Paper, 8.5\" x 11\", Case",
  "vendorName": "Staples Business Advantage",
  "notes": "Updated during review"
}
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "success": true,
  "message": "Item updated successfully",
  "item": {
    "id": 1,
    "userId": 1,
    "companyId": 1,
    "name": "Premium Copy Paper, 8.5\" x 11\", Case",
    "vendorName": "Staples Business Advantage",
    "sku": "STR513096",
    "category": "Office Supplies",
    "lastPaidPrice": 45.99,
    "upc": "061875246738",
    "reorderIntervalDays": 30,
    "estimatedMonthlyOrders": 1,
    "notes": "Updated during review",
    "updatedAt": "2025-11-13T15:45:00.000Z"
  }
}
```

**Validation Errors:**

If validation fails (e.g., empty name):

**Status:** `400 Bad Request`

```json
{
  "success": false,
  "error": "Item name cannot be empty"
}
```

---

## 🔔 ALERTS ENDPOINTS

### GET /api/alerts

**Purpose:** Fetch all price drop alerts for the authenticated user

#### Request

```http
GET /api/alerts HTTP/1.1
Host: localhost:5000
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "success": true,
  "alerts": [
    {
      "id": 1,
      "userId": 1,
      "itemId": 1,
      "retailer": "Amazon",
      "oldPrice": 45.99,
      "newPrice": 42.49,
      "savingsPerOrder": 3.50,
      "estimatedMonthlySavings": 105.00,
      "url": "https://www.amazon.com/dp/B0000123",
      "viewed": false,
      "seen": false,
      "alertDate": "2025-11-13T03:00:00.000Z",
      "createdAt": "2025-11-13T03:00:00.000Z",
      "item": {
        "id": 1,
        "name": "Staples Copy Paper, 8.5\" x 11\", Case",
        "vendorName": "Staples",
        "category": "Office Supplies"
      }
    },
    {
      "id": 2,
      "userId": 1,
      "itemId": 2,
      "retailer": "Walmart",
      "oldPrice": 12.49,
      "newPrice": 11.49,
      "savingsPerOrder": 1.00,
      "estimatedMonthlySavings": 30.00,
      "url": "https://www.walmart.com/ip/123456",
      "viewed": false,
      "seen": false,
      "alertDate": "2025-11-12T03:00:00.000Z",
      "createdAt": "2025-11-12T03:00:00.000Z",
      "item": {
        "id": 2,
        "name": "BIC Round Stic Ballpoint Pens, 60-Pack",
        "vendorName": "Amazon",
        "category": "Office Supplies"
      }
    }
  ],
  "count": 2
}
```

**Field Descriptions:**
- `id`: Alert identifier
- `userId`: User who owns the alert
- `itemId`: Related item ID
- `retailer`: Where better price was found
- `oldPrice`: Previous price (lastPaidPrice)
- `newPrice`: Current better price
- `savingsPerOrder`: Difference (oldPrice - newPrice)
- `estimatedMonthlySavings`: savingsPerOrder × (30 / reorderIntervalDays)
- `url`: Direct link to product
- `viewed`: User clicked "View" button
- `seen`: User viewed Alerts tab
- `alertDate`: When alert was created
- `item`: Related item details (populated)

---

### GET /api/alerts/unreadCount

**Purpose:** Get count of unread alerts (for notification badge)

#### Request

```http
GET /api/alerts/unreadCount HTTP/1.1
Host: localhost:5000
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "count": 3
}
```

---

### POST /api/alerts/markAllSeen

**Purpose:** Mark all alerts as seen (after viewing Alerts tab)

#### Request

```http
POST /api/alerts/markAllSeen HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{}
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "success": true,
  "message": "All alerts marked as seen",
  "updated": 3
}
```

---

### DELETE /api/alerts/:id

**Purpose:** Dismiss/delete an alert

#### Request

```http
DELETE /api/alerts/1 HTTP/1.1
Host: localhost:5000
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "success": true,
  "message": "Alert dismissed"
}
```

---

## 💰 SAVINGS ENDPOINTS

### GET /api/savings-summary

**Purpose:** Get aggregated savings data for dashboard

#### Request

```http
GET /api/savings-summary HTTP/1.1
Host: localhost:5000
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "success": true,
  "totalMonthlySavings": 247.50,
  "totalItemsMonitored": 6,
  "alertsThisMonth": 3,
  "estimatedAnnualSavings": 2970.00,
  "topSavingsItem": {
    "name": "Staples Copy Paper, 8.5\" x 11\", Case",
    "savingsPerOrder": 3.50,
    "estimatedMonthlySavings": 105.00,
    "retailer": "Amazon",
    "url": "https://www.amazon.com/dp/B0000123"
  },
  "ytdTotal": 1235.00,
  "monthlyTotal": 247.50,
  "lastCalculated": "2025-11-13T03:00:00.000Z"
}
```

**Calculations:**
- `totalMonthlySavings`: Sum of all active alerts' estimatedMonthlySavings
- `estimatedAnnualSavings`: totalMonthlySavings × 12
- `alertsThisMonth`: Count of alerts created in last 30 days
- `topSavingsItem`: Alert with highest estimatedMonthlySavings

---

## 📥 BACKUP ENDPOINT

### GET /api/backup

**Purpose:** Download SQLite database backup

#### Request

```http
GET /api/backup HTTP/1.1
Host: localhost:5000
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/x-sqlite3` or `application/octet-stream`  
**Content-Disposition:** `attachment; filename="procuro-backup-2025-11-13.sqlite"`  
**Content-Length:** Varies (50KB - 500KB)

**Response Body:** Binary SQLite database file

**Headers:**
```
HTTP/1.1 200 OK
Content-Type: application/x-sqlite3
Content-Disposition: attachment; filename="procuro-backup-2025-11-13.sqlite"
Content-Length: 253952
```

---

## 👥 INVITE ENDPOINTS

### POST /api/invites

**Purpose:** Create a new company invite

#### Request

```http
POST /api/invites HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "MEMBER"
}
```

#### Expected Response

**Status:** `201 Created`  
**Content-Type:** `application/json`

```json
{
  "success": true,
  "message": "Invite sent successfully",
  "invite": {
    "id": 1,
    "companyId": 1,
    "invitedBy": 1,
    "email": "newuser@example.com",
    "role": "MEMBER",
    "token": "abc123def456ghi789jkl012mno345pqr",
    "status": "PENDING",
    "expiresAt": "2025-11-20T15:00:00.000Z",
    "createdAt": "2025-11-13T15:00:00.000Z"
  }
}
```

---

### POST /api/invites/:token/accept

**Purpose:** Accept an invite and create user account

#### Request

```http
POST /api/invites/abc123...pqr/accept HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "name": "New User",
  "email": "newuser@example.com"
}
```

#### Expected Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "success": true,
  "message": "Invite accepted successfully",
  "user": {
    "id": 2,
    "email": "newuser@example.com",
    "name": "New User",
    "companyId": 1
  }
}
```

---

## 🔒 QUICKBOOKS OAUTH ENDPOINTS

### GET /api/qb/connect

**Purpose:** Initiate QuickBooks OAuth flow

#### Request

```http
GET /api/qb/connect HTTP/1.1
Host: localhost:5000
```

#### Expected Response

**Status:** `302 Found`  
**Location:** `https://appcenter.intuit.com/connect/oauth2?client_id=...&redirect_uri=...&scope=...`

Redirects to Intuit OAuth authorization page.

---

### GET /api/qb/callback

**Purpose:** Handle OAuth callback after authorization

#### Request

```http
GET /api/qb/callback?code=ABC123&realmId=123456789&state=xyz HTTP/1.1
Host: localhost:5000
```

#### Expected Response

**Status:** `302 Found`  
**Location:** `/dashboard` or `/qbo_embed/iframe-loader.html`

Redirects to dashboard after:
1. Exchanging code for tokens
2. Encrypting tokens
3. Storing in database
4. Creating/updating Company and User records
5. Importing Purchase transactions

---

## 📄 CSV EXPORT FORMAT

### Filename

```
procuro-savings-report-2025-11-13.csv
```

### Content

```csv
"Item Name","Retailer","Old Price","New Price","Savings Per Order","Est. Monthly Savings"
"Staples Copy Paper, 8.5"" x 11"", Case","Amazon","$45.99","$42.49","$3.50","$105.00"
"BIC Round Stic Ballpoint Pens, 60-Pack","Walmart","$12.49","$11.49","$1.00","$30.00"
"HP 64 Ink Cartridge, Black","Staples","$67.99","$61.99","$6.00","$180.00"
```

**Format:**
- Headers in first row
- All fields quoted with double quotes
- Price values include dollar sign
- Commas as field separators

---

## 📦 MANIFEST.JSON

### File Location

`/qbo_embed/manifest.json`

### Content

```json
{
  "name": "Procuro - Smart Purchasing Alerts",
  "description": "Procuro helps businesses save money on the items they already buy. Automatically monitor your company's recurring purchases in QuickBooks, compare prices across major retailers, and receive instant savings alerts directly inside QuickBooks Online.",
  "auth": {
    "type": "OAuth2",
    "redirect_uris": [
      "https://procuroapp.com/oauth/callback",
      "http://localhost:5000/api/qb/callback"
    ],
    "scopes": [
      "com.intuit.quickbooks.accounting",
      "openid",
      "profile",
      "email"
    ]
  },
  "launch_url": "https://procuroapp.com/qbo_embed/iframe-loader.html",
  "dashboard_url": "https://procuroapp.com/dashboard",
  "support_url": "https://procuroapp.com/support",
  "privacy_url": "https://procuroapp.com/privacy",
  "terms_url": "https://procuroapp.com/terms",
  "category": "Accounting, Business Efficiency, Savings Tools",
  "version": "1.1.0",
  "pricing": {
    "model": "Subscription",
    "free_trial_days": 14,
    "currency": "USD",
    "monthly_price": 9.99,
    "annual_price": 99.00
  }
}
```

---

## 🎨 APP STORE METADATA

### File Location

`/qbo_embed/appstore-metadata.json`

### Content

```json
{
  "app_name": "Procuro",
  "short_tagline": "Save money on what you already buy.",
  "long_description": "Procuro automatically scans your recurring business purchases and finds better prices from trusted vendors like Amazon, Walmart, and Staples. Embedded directly inside QuickBooks, it helps your company save money without changing your workflow.",
  "key_features": [
    "Embedded directly inside QuickBooks Online",
    "Real-time savings alerts for recurring purchases",
    "Compare vendors across Amazon, Walmart, Staples, and more",
    "Secure AES-256 encrypted QuickBooks token handling",
    "Easy setup – no manual uploads or CSVs"
  ],
  "target_audience": "Small to medium businesses using QuickBooks Online",
  "pricing": "$9.99/month or $99/year with 14-day free trial",
  "contact_email": "procuroapp@gmail.com",
  "developer": {
    "company_name": "Procuro Inc.",
    "website": "https://procuroapp.com",
    "support_email": "procuroapp@gmail.com"
  }
}
```

---

## ❌ ERROR RESPONSES

### 400 Bad Request

**Invalid input or validation error**

```json
{
  "success": false,
  "error": "Item name cannot be empty",
  "field": "name"
}
```

---

### 401 Unauthorized

**Not authenticated or session expired**

```json
{
  "success": false,
  "error": "Unauthorized. Please reconnect to QuickBooks."
}
```

---

### 403 Forbidden

**Accessing blocked path**

```json
{
  "error": "Access denied"
}
```

---

### 404 Not Found

**Resource not found**

```json
{
  "success": false,
  "error": "Item not found",
  "id": 999
}
```

---

### 500 Internal Server Error

**Server-side error**

```json
{
  "status": "error",
  "message": "An unexpected error occurred",
  "route": "GET /api/items",
  "time": "2025-11-13T15:30:00.000Z"
}
```

**Note:** Stack trace only included in development mode.

---

## 🧪 TESTING RESPONSES

### Using curl (Command Line)

```bash
# Health check
curl http://localhost:5000/health

# Get items (requires auth)
curl http://localhost:5000/api/items \
  -H "Cookie: session=..."

# Update item
curl -X PATCH http://localhost:5000/api/items/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"name": "Updated Item Name"}'

# Get alerts
curl http://localhost:5000/api/alerts \
  -H "Cookie: session=..."

# Dismiss alert
curl -X DELETE http://localhost:5000/api/alerts/1 \
  -H "Cookie: session=..."

# Get savings summary
curl http://localhost:5000/api/savings-summary \
  -H "Cookie: session=..."

# Download backup
curl http://localhost:5000/api/backup \
  -H "Cookie: session=..." \
  -o backup.sqlite
```

---

## 📞 CONTACT

If API responses don't match these examples:

**Email:** procuroapp@gmail.com  
**Subject:** "API Response Mismatch - [Endpoint Name]"  
**Include:** Request details, expected vs actual response

---

**Expected Responses Version:** 1.1.0  
**Last Updated:** November 13, 2025  
**Status:** Ready for Reviewer Reference

