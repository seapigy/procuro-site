# Amazon Product Advertising API Integration

## Overview

The Amazon Provider (`/providers/amazon.ts`) implements the Amazon Product Advertising API v5 for fetching real-time product prices.

## Setup

### 1. Get Amazon Product Advertising API Credentials

1. Sign up for [Amazon Associates](https://affiliate-program.amazon.com/)
2. Go to [Amazon Product Advertising API](https://webservices.amazon.com/paapi5/documentation/)
3. Register for API access
4. Get your Access Key and Secret Key

### 2. Configure Environment Variables

Add to `server/.env`:

```bash
AMAZON_ACCESS_KEY=your_access_key_here
AMAZON_SECRET_KEY=your_secret_key_here
AMAZON_REGION=us-east-1
```

### 3. Install Dependencies

```bash
cd server
npm install
```

## API Functions

### `getPriceByKeyword(keyword: string)`

Searches Amazon for products matching the keyword and returns the lowest "New" condition price.

**Parameters:**
- `keyword` (string) - Search term (e.g., "HP Printer Paper 500 Sheets")

**Returns:**
```typescript
{
  price: number;      // Lowest price in USD
  stock: boolean;     // true if in stock
  url: string;        // Amazon product URL
}
```

**Example:**
```typescript
const result = await provider.getPriceByKeyword('HP Printer Paper 500 Sheets');
// { price: 12.99, stock: true, url: 'https://amazon.com/...' }
```

**Error Handling:**
- Throws `"404: No products found..."` if no results
- Throws `"404: No new items available..."` if no "New" condition offers
- Proper error messages for rate limits, auth issues, etc.

### `getPrice(productId: string)`

Gets price by Amazon ASIN (product ID).

**Parameters:**
- `productId` (string) - Amazon ASIN (e.g., "B08N5WRWNW")

**Returns:**
```typescript
{
  productId: string;
  price: number;
  currency: string;
  availability: boolean;
  lastUpdated: Date;
}
```

### `getProductInfo(productId: string)`

Gets full product information including title, image, and price.

## Testing

### Option 1: Run Standalone Test

```bash
# From project root
npx tsx providers/test-amazon.ts
```

### Option 2: Run Built-in Test

```bash
# From project root
cd providers
npx tsx amazon.ts
```

### Expected Output

```
🧪 Testing Amazon Provider...

🔍 Searching Amazon for: "HP Printer Paper 500 Sheets"
✅ Found price: $12.99 | Stock: true
   URL: https://www.amazon.com/dp/B001234567

📦 Test Result:
{
  "price": 12.99,
  "stock": true,
  "url": "https://www.amazon.com/dp/B001234567"
}
```

## Implementation Details

### Features

✅ Amazon Product Advertising API v5 integration  
✅ Search by keyword  
✅ Filters for "New" condition items  
✅ Returns lowest available price  
✅ Stock availability checking  
✅ Comprehensive error handling  
✅ 404 handling for no matches  
✅ Rate limit detection  

### API Resources Used

The implementation requests these Amazon API resources:
- `ItemInfo.Title` - Product name
- `Offers.Listings.Price` - Price information
- `Offers.Listings.Condition` - Product condition (New/Used)
- `Offers.Listings.Availability.Type` - Stock status

### Regional Support

Supported regions:
- `us-east-1` - United States (default)
- `us-west-2` - United States (West)
- `eu-west-1` - United Kingdom
- `ap-northeast-1` - Japan

## Troubleshooting

### "Invalid credentials"
- Verify `AMAZON_ACCESS_KEY` and `AMAZON_SECRET_KEY` in `.env`
- Ensure you're approved for Product Advertising API access

### "TooManyRequests"
- Amazon has rate limits (typically 1 request/second for free tier)
- Wait a few minutes and try again
- Consider implementing request throttling for production

### "No products found"
- This is expected behavior - the keyword didn't match any products
- Try different search terms
- Check Amazon's website to confirm product exists

### "No new items available"
- Product exists but no "New" condition offers
- Only used/refurbished items available
- Modify code to accept other conditions if needed

## Production Considerations

1. **Rate Limiting**: Implement request throttling
2. **Caching**: Cache results to reduce API calls
3. **Partner Tag**: Use your actual Amazon Associates tag
4. **Error Retry**: Add exponential backoff for transient errors
5. **Monitoring**: Track API usage and errors
6. **Fallback**: Have backup pricing sources

## Example Integration

```typescript
import { AmazonProvider } from './providers/amazon';

const provider = new AmazonProvider({
  accessKey: process.env.AMAZON_ACCESS_KEY!,
  secretKey: process.env.AMAZON_SECRET_KEY!,
  region: 'us-east-1',
});

// Search for product
try {
  const result = await provider.getPriceByKeyword('office supplies');
  console.log(`Price: $${result.price}`);
} catch (error) {
  if (error.message.includes('404')) {
    console.log('Product not found');
  } else {
    console.error('API error:', error);
  }
}
```

## Resources

- [Amazon Product Advertising API Documentation](https://webservices.amazon.com/paapi5/documentation/)
- [PAAPI5 Node.js SDK](https://github.com/amazonlinux/amazon-paapi5-nodejs-sdk)
- [Amazon Associates](https://affiliate-program.amazon.com/)
