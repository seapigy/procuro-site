# Browser-Based Price Providers

## Overview

This directory contains **browser-based** retailer price providers that run directly in the user's browser. This eliminates IP blocking issues and provides more reliable price checking.

## Why Browser-Based?

Retailer websites block datacenter IPs and server-based scraping. By running price checks from the user's browser:

- ✅ Uses residential IP addresses
- ✅ Appears as normal user traffic
- ✅ Avoids CAPTCHA and blocks
- ✅ Higher success rates
- ✅ Better user experience

## Architecture

```
┌─────────────┐
│   Browser   │
│  (User PC)  │
└──────┬──────┘
       │
       │ 1. Check prices
       ├──────────────────────┐
       │                      │
       ▼                      ▼
┌──────────────┐      ┌──────────────┐
│   Walmart    │      │    Target    │
│  (Direct)    │      │   (Direct)   │
└──────────────┘      └──────────────┘
       │                      │
       │ 2. Return prices     │
       └──────────┬───────────┘
                  │
                  ▼
           ┌──────────────┐
           │   Frontend   │
           │  (Aggregate) │
           └──────┬───────┘
                  │
                  │ 3. Store results
                  ▼
           ┌──────────────┐
           │   Backend    │
           │   Database   │
           └──────────────┘
```

## Files

### Core Files

- **`types.ts`** - TypeScript interfaces and types
- **`utils.ts`** - Shared utility functions (parsing, fetching, etc.)
- **`index.ts`** - Aggregator that runs all providers in parallel

### Retailer Providers

Each provider exports a `getPriceByKeyword()` function:

- **`walmart.browser.ts`** - Walmart price checking
- **`target.browser.ts`** - Target price checking
- **`homedepot.browser.ts`** - Home Depot price checking
- **`lowes.browser.ts`** - Lowe's price checking
- **`staples.browser.ts`** - Staples price checking
- **`officedepot.browser.ts`** - Office Depot price checking

## Usage

### Check Prices for an Item

```typescript
import { checkAllRetailers } from './providers_browser';

// Run all retailers in parallel
const results = await checkAllRetailers('HP Printer Paper 500 Sheets');

// Results array contains data from all retailers
results.forEach(result => {
  console.log(`${result.retailer}: $${result.price}`);
  if (result.url) {
    console.log(`  URL: ${result.url}`);
  }
});
```

### Store Results in Backend

```typescript
// After getting results, store them in the database
await fetch('/api/store-price/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    itemId: 123,
    results: results
  })
});
```

### Check Individual Retailer

```typescript
import * as walmart from './providers_browser/walmart.browser';

const result = await walmart.getPriceByKeyword('printer paper');

if (result.price) {
  console.log(`Found at Walmart: $${result.price}`);
}
```

## Provider Implementation

Each provider follows this structure:

```typescript
export async function getPriceByKeyword(
  keyword: string,
  config?: ProviderConfig
): Promise<BrowserPriceResult> {
  try {
    // 1. Fetch HTML from retailer
    const url = `https://retailer.com/search?q=${keyword}`;
    const response = await fetchWithTimeout(url);
    const html = await response.text();

    // 2. Parse HTML
    const doc = parseHTML(html);

    // 3. Extract JSON data (from <script> tags or window variables)
    const data = extractScriptJSON(doc, 'script#__NEXT_DATA__');
    // OR
    const data = extractWindowJSON(html, /window\.__DATA__\s*=\s*({.*?});/);

    // 4. Find products and prices
    const products = data.searchResults.items;
    const bestProduct = findLowestPrice(products);

    // 5. Return standardized result
    return {
      retailer: 'Walmart',
      price: bestProduct.price,
      url: bestProduct.url,
      title: bestProduct.name,
      stock: bestProduct.inStock,
      image: bestProduct.imageUrl
    };
  } catch (error) {
    // 6. Return empty result on error
    return createEmptyResult('Walmart', error.message);
  }
}
```

## Result Format

All providers return a `BrowserPriceResult`:

```typescript
interface BrowserPriceResult {
  retailer: string;        // e.g., "Walmart"
  price: number | null;    // e.g., 29.99
  url: string | null;      // Product page URL
  title: string | null;    // Product title
  stock: boolean | null;   // In stock?
  image: string | null;    // Product image URL
  error?: string;          // Error message if failed
}
```

## Error Handling

If a provider fails (blocked, timeout, no results), it returns:

```typescript
{
  retailer: "Walmart",
  price: null,
  url: null,
  title: null,
  stock: null,
  image: null,
  error: "HTTP 403 - Forbidden"
}
```

The UI should display these as "No Data" with a neutral badge.

## Testing

### Manual Testing

1. Open browser DevTools (F12)
2. Go to Console tab
3. Run:

```javascript
import { checkAllRetailers } from './providers_browser';

// Test a search
checkAllRetailers('printer paper').then(results => {
  console.table(results);
});
```

### Integration Testing

See `client/src/__tests__/providers_browser.test.ts`

## Utilities

### `fetchWithTimeout()`

Fetches with timeout support:

```typescript
const response = await fetchWithTimeout(url, {}, 15000); // 15 second timeout
```

### `parseHTML()`

Parses HTML string into a DOM document:

```typescript
const doc = parseHTML(htmlString);
const element = doc.querySelector('.price');
```

### `extractScriptJSON()`

Extracts JSON from `<script>` tags:

```typescript
const data = extractScriptJSON(doc, 'script#__NEXT_DATA__');
```

### `extractWindowJSON()`

Extracts JSON from window variable patterns:

```typescript
const data = extractWindowJSON(html, /window\.__DATA__\s*=\s*({.*?});/);
```

### `parsePrice()`

Parses price from various formats:

```typescript
parsePrice("$29.99")      // 29.99
parsePrice(29.99)         // 29.99
parsePrice({ value: 29.99 }) // 29.99
```

## Configuration

Providers accept optional config:

```typescript
interface ProviderConfig {
  timeout?: number;      // Request timeout (default: 15000ms)
  corsProxy?: string;    // CORS proxy URL (if needed)
}
```

## CORS Considerations

Modern browsers have CORS protections. These providers work because:

1. Many retailers allow cross-origin requests for public data
2. Browsers include proper headers automatically
3. Results are displayed on the same domain that made the request

If CORS becomes an issue, consider:
- Browser extension with elevated permissions
- CORS proxy for development
- Native app wrapper (Electron, Tauri)

## Performance

- All 6 retailers checked in parallel (~5-10 seconds total)
- Individual timeouts prevent slow providers from blocking
- Results displayed as they arrive (progressive enhancement)
- Cached in React state for instant re-display

## Security

- No API keys exposed in frontend
- No sensitive data in requests
- Results validated before storage
- SQL injection protection on backend
- Rate limiting handled by browser

## Troubleshooting

### "Failed to fetch" errors

- Check retailer website is accessible
- Verify URL format is correct
- Try clearing browser cache
- Check browser console for detailed errors

### No results found

- Verify search keyword is reasonable
- Check retailer's website manually
- Adjust keyword normalization in utils.ts

### Slow performance

- Check network speed
- Reduce timeout values
- Disable slow retailers temporarily

## Future Enhancements

- [ ] Add Amazon PA-API integration
- [ ] Cache results for 1 hour
- [ ] Add product image display
- [ ] Price history charts
- [ ] Email alerts for price drops
- [ ] Browser extension for background checking
- [ ] Mobile app integration

## Questions?

See main documentation:
- `/docs/PROVIDER-VERIFICATION-REPORT.md`
- `/docs/LOCAL-DEV.md`
- `/server/src/providers/DEPRECATED.md`

