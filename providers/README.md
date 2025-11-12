# Retailer API Providers

This directory contains modules for integrating with various retailer APIs (Amazon, Walmart, etc.) to fetch product pricing data.

## Structure

Each retailer should have its own module:
- `amazon.ts` - Amazon Product Advertising API integration
- `walmart.ts` - Walmart API integration
- `base.ts` - Base provider interface/abstract class

## Example Usage

```typescript
import { AmazonProvider } from './amazon';

const provider = new AmazonProvider({
  accessKey: process.env.AMAZON_ACCESS_KEY!,
  secretKey: process.env.AMAZON_SECRET_KEY!,
  region: process.env.AMAZON_REGION!,
});

const price = await provider.getPrice('B08N5WRWNW');
```





