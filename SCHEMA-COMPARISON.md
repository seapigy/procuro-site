# Prisma Schema Comparison Report

## Current vs Required Schema Analysis

### 1. User Table
**Current:** ✅ EXISTS (as `User` model)
- ✅ `id` (Int, @id, @default(autoincrement()))
- ✅ `email` (String, @unique)
- ✅ `createdAt` (DateTime, @default(now()))
- ⚠️ Missing: `quickbooks_id` (String?)
- ⚠️ Missing: `onboarding_completed` (Boolean @default(false))
- ℹ️ Extra fields (keeping): name, updatedAt, quickbooksAccessToken, quickbooksRefreshToken, quickbooksRealmId, quickbooksConnectedAt

**Action:** Add `quickbooksId` and `onboardingCompleted` fields

---

### 2. Item Table
**Current:** ✅ EXISTS (as `Item` model)
- ✅ `id` (Int, @id, @default(autoincrement()))
- ✅ `userId` (Int) - matches user_id
- ✅ `name` (String)
- ✅ `lastPaidPrice` (Float) - matches last_purchase_price
- ⚠️ Missing: `sku` (String?)
- ⚠️ Missing: `vendorName` (String?) - for vendor_name
- ⚠️ Missing: `lastCheckedPrice` (Float?) - for last_checked_price
- ℹ️ Extra fields (keeping): category, quantityPerOrder, reorderIntervalDays, upc, matchedRetailer, matchedUrl, matchedPrice, createdAt, updatedAt

**Action:** Add `sku`, `vendorName`, and `lastCheckedPrice` fields

---

### 3. Price Table
**Current:** ✅ EXISTS (as `Price` model)
- ✅ `id` (Int, @id, @default(autoincrement()))
- ✅ `itemId` (Int) - matches item_id
- ✅ `retailer` (String)
- ✅ `price` (Float)
- ✅ `date` (DateTime, @default(now())) - matches checked_at
- ⚠️ Missing: `url` (String?)

**Action:** Add `url` field

---

### 4. Alert Table
**Current:** ✅ EXISTS (as `Alert` model)
- ✅ `id` (Int, @id, @default(autoincrement()))
- ✅ `itemId` (Int) - matches item_id
- ✅ `userId` (Int) - matches user_id
- ⚠️ Missing: `priceDropAmount` (Float) - for price_drop_amount
- ⚠️ Missing: `dateTriggered` (DateTime, @default(now())) - for date_triggered
- ⚠️ Missing: `viewed` (Boolean, @default(false))
- ℹ️ Extra fields (keeping): retailer, newPrice, oldPrice, url, savingsPerOrder, estimatedMonthlySavings, seen, alertDate

**Note:** Current schema has `alertDate` (similar to dateTriggered) and `seen` (similar to viewed)

**Action:** Add `priceDropAmount`, `dateTriggered`, and `viewed` fields for compatibility

---

### 5. SavingsSummary Table
**Current:** ❌ MISSING ENTIRELY

**Required fields:**
- id (Int, @id, @default(autoincrement()))
- userId (Int)
- monthlyTotal (Float, @default(0))
- yearToDateTotal (Float, @default(0))
- lastCalculated (DateTime, @default(now()))
- Relation: userId → users.id

**Action:** Create entire SavingsSummary model

---

## Summary of Changes Needed

### Fields to Add:
1. **User model:**
   - `quickbooksId String?`
   - `onboardingCompleted Boolean @default(false)`

2. **Item model:**
   - `sku String?`
   - `vendorName String?`
   - `lastCheckedPrice Float?`

3. **Price model:**
   - `url String?`

4. **Alert model:**
   - `priceDropAmount Float`
   - `dateTriggered DateTime @default(now())`
   - `viewed Boolean @default(false)`

5. **NEW MODEL: SavingsSummary**
   - Complete new table

---

## Migration Strategy

1. Update schema.prisma with all missing fields
2. Create migration: `npx prisma migrate dev --name "complete_local_schema"`
3. Update seed script with sample data
4. Run seed: `npx prisma db seed`
5. Verify with Prisma Studio

---

**Status:** Schema audit complete, ready to update

