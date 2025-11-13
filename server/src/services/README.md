# Item Matching Service

## Overview

The `matchItem.ts` service intelligently matches items from QuickBooks to products available at retail stores (Walmart, Target, Amazon).

## Features

### 1. Name Normalization
- Converts to lowercase
- Removes punctuation
- Filters out stopwords: "the", "pack", "box", "case", "count", "ct", "of", "a", "an"
- Preserves numbers for packaging size detection

### 2. Multi-Provider Search
Searches across multiple retailers in parallel:
- ✅ Walmart (using free product API)
- ✅ Target (using Redsky API)
- ⏳ Amazon (once PA-API is unlocked)

### 3. Intelligent Scoring

Results are scored based on:

#### Title Similarity (60% weight)
- Uses Levenshtein distance algorithm
- Higher scores for exact or substring matches

#### Price Reasonableness (20% weight)
- Rejects items 4x higher or 0.25x lower than reference price
- Prefers prices closer to the reference price

#### Packaging Size Stability (20% weight)
- Extracts numbers from product descriptions (e.g., "500 sheets")
- Prefers similar packaging sizes to avoid mismatches

### 4. Persistent Matching

Matched products are stored in the database:
```typescript
Item {
  matchedRetailer: "Walmart"
  matchedUrl: "https://..."
  matchedPrice: 24.99
}
```

## Usage

### Standalone
```bash
ts-node server/src/services/matchItem.ts
```

### In Code
```typescript
import { matchItemToRetailers } from './services/matchItem';

const match = await matchItemToRetailers(
  'HP Printer Paper 500 Sheets',
  29.99  // reference price
);

if (match) {
  console.log(`Best match: ${match.retailer} - $${match.price}`);
}
```

### API Integration

The matching service is automatically called when:

1. **Items are seeded** (`npm run seed`)
2. **Items imported from QuickBooks** (OAuth callback)
3. **Items created via API** (`POST /api/items`)

## Example Output

```
🔍 Matching item: "HP Printer Paper 500 Sheets"
   Normalized: "hp printer paper 500 sheets"
   
🔍 Searching Walmart for: "HP Printer Paper 500 Sheets"
✅ Found: $24.99 | Stock: Available

🔍 Searching Target for: "HP Printer Paper 500 Sheets"
✅ Found: $26.49 | Stock: Available

✅ Best match: Walmart
   Price: $24.99
   Score: 87.3%
   URL: https://walmart.com/...
```

## Scoring Algorithm

```typescript
Total Score = (Title Similarity × 0.6) 
            + (Price Score × 0.2) 
            + (Size Match × 0.2)
```

### Example Scoring:
- Title: "HP Printer Paper 500 Sheets" → 0.95 similarity → 0.57 points
- Price: $24.99 vs $29.99 → 0.83 score → 0.17 points
- Size: 500 sheets matched → 1.0 → 0.20 points
- **Total: 0.94 (94%)**

## Future Enhancements

- [ ] Add Amazon PA-API integration
- [ ] Machine learning for better title matching
- [ ] Brand detection and preference
- [ ] Unit conversion (e.g., oz to lb)
- [ ] Cache results to reduce API calls
- [ ] Support for variant products (colors, sizes)



