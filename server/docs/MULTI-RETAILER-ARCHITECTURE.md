# Multi-Retailer Architecture

## Overview

Procuro is moving from retailer-specific Item columns toward a proper multi-retailer architecture where one item can have matches at multiple retailers simultaneously.

## Current State (Legacy)

- **Item** has retailer-specific columns: `amazonAsin`, `amazonProductUrl`, `amazonMatchedAt`, `walmartProductId`, `walmartProductUrl`, `walmartMatchedAt`
- These remain for backward compatibility during migration
- Price check logic reads from Item fields directly

## Target State

- **ItemRetailerMatch** stores retailer matches: one row per (item, retailer)
- Load retailer matches from `ItemRetailerMatch`
- Check each active retailer match
- Compare prices across all matched retailers

## ItemRetailerMatch Model

| Field | Purpose |
|-------|---------|
| itemId, companyId | Tenant + item reference |
| retailer | Amazon, Walmart, etc. |
| retailerProductId | ASIN, Walmart product ID, etc. |
| productUrl | Canonical product URL |
| matchedAt | When match was established |
| matchConfidence | 0.0–1.0 |
| matchTitle, matchBrand | Optional metadata |
| isActive | Whether to include in price checks |
| lastCheckedAt | Last price check timestamp |

## Field Mapping (Legacy → ItemRetailerMatch)

| Retailer | Item Field | ItemRetailerMatch Field |
|----------|------------|-------------------------|
| Amazon | amazonAsin | retailerProductId |
| Amazon | amazonProductUrl | productUrl |
| Amazon | amazonMatchedAt | matchedAt |
| Walmart | walmartProductId | retailerProductId |
| Walmart | walmartProductUrl | productUrl |
| Walmart | walmartMatchedAt | matchedAt |

## Service Layer

- **`getRetailerMatchesForItem(itemId, companyId)`**: Returns active matches. Prefers ItemRetailerMatch; falls back to legacy Item fields when no rows exist.
- **`markMatchChecked(matchId)`**: Updates lastCheckedAt after a price check.

## Migration Path

1. Run backfill: `npx tsx scripts/backfill-item-retailer-match.ts`
2. Price check continues to use legacy Item fields (unchanged)
3. Future: Switch price check to use `getRetailerMatchesForItem` as primary source
4. Future: When persisting new matches, write to ItemRetailerMatch (and optionally sync legacy Item fields for compatibility)
5. Future: Deprecate legacy Item columns
