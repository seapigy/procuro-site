# ⚠️ DEPRECATED - Backend Providers

## Status: DEPRECATED as of [Date]

These backend retailer providers have been **deprecated** and should **NO LONGER be used** for price checking.

## Reason for Deprecation

Retailer websites actively block datacenter IPs and server-based scraping attempts. This results in:
- Frequent HTTP 403/429 errors
- IP bans and CAPTCHA challenges
- Unreliable price data
- Poor user experience

## New Architecture: Browser-Based Providers

All price checking is now performed **client-side** in the user's browser. This provides:

### ✅ Benefits
1. **Residential IP addresses** - No blocking from retailers
2. **Better success rates** - Requests appear as normal user traffic
3. **CORS compliance** - Browser handles cross-origin requests
4. **Distributed load** - Each user's browser does their own checking
5. **Real-time results** - Faster, more reliable data

### 📁 New Location

Browser providers are located in:
```
client/src/providers_browser/
```

Files:
- `walmart.browser.ts`
- `target.browser.ts`
- `homedepot.browser.ts`
- `lowes.browser.ts`
- `staples.browser.ts`
- `officedepot.browser.ts`
- `index.ts` (aggregator)
- `utils.ts` (shared utilities)
- `types.ts` (TypeScript interfaces)

### 🔄 Data Flow

**Old (Deprecated):**
```
Frontend → Backend → Retailer → Backend → Frontend
```

**New (Current):**
```
Frontend → Retailer (directly from browser)
Frontend → Backend (POST /api/store-price) → Database
```

### 🔌 Backend API

The backend now provides a **storage endpoint** only:

- `POST /api/store-price` - Store single price result
- `POST /api/store-price/bulk` - Store multiple price results

The backend **does NOT** fetch retailer pages anymore.

## Migration Guide

If you have code calling the old backend providers:

### ❌ Old Way (Don't use):
```typescript
// Backend provider (DEPRECATED)
import { aggregateProviders } from '../providers/aggregateProvider';
const results = await aggregateProviders({ keyword: 'paper' });
```

### ✅ New Way (Use this):
```typescript
// Frontend provider (Current)
import { checkAllRetailers } from '../providers_browser';
const results = await checkAllRetailers('paper');

// Store results in backend
await fetch('/api/store-price/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ itemId: 123, results })
});
```

## Files in This Directory

These files are **kept for reference only** and should not be imported or used:

- `aggregateProvider.ts` - ❌ DEPRECATED
- `walmart.ts` - ❌ DEPRECATED
- `target.ts` - ❌ DEPRECATED  
- `homedepot.ts` - ❌ DEPRECATED
- `lowes.ts` - ❌ DEPRECATED
- `staples.ts` - ❌ DEPRECATED
- `officedepot.ts` - ❌ DEPRECATED
- `amazon.ts` - ❌ DEPRECATED

## Questions?

See updated documentation:
- `docs/PROVIDER-VERIFICATION-REPORT.md`
- `docs/LOCAL-DEV.md`
- `client/src/providers_browser/README.md`




