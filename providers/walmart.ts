import fetch from 'node-fetch';

interface WalmartPriceResult {
  price: number | null;
  retailer: 'Walmart';
  url: string | null;
  inStock: boolean;
}

interface WalmartProduct {
  price?: number;
  productPageUrl?: string;
  stockStatus?: string;
}

interface WalmartApiResponse {
  products?: WalmartProduct[];
}

/**
 * Walmart free product API provider
 */
export class WalmartProvider {
  /**
   * Get price by product name using Walmart's public API
   */
  static async getPriceByName(name: string): Promise<WalmartPriceResult> {
    try {
      console.log(`🔍 Searching Walmart for: "${name}"`);

      const url = `https://product-api.walmart.com/api/v1/products?query=${encodeURIComponent(name)}&limit=1`;
      
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`❌ Walmart API error: ${response.status} ${response.statusText}`);
        return {
          price: null,
          retailer: 'Walmart',
          url: null,
          inStock: false,
        };
      }

      const data = (await response.json()) as WalmartApiResponse;

      // Check if any products were found
      if (!data.products || data.products.length === 0) {
        console.log(`⚠️  No products found for: "${name}"`);
        return {
          price: null,
          retailer: 'Walmart',
          url: null,
          inStock: false,
        };
      }

      const result = data.products[0];

      console.log(`✅ Found: $${result.price?.toFixed(2) || 'N/A'} | Stock: ${result.stockStatus}`);

      return {
        price: result.price || null,
        retailer: 'Walmart',
        url: result.productPageUrl || null,
        inStock: result.stockStatus === 'IN_STOCK',
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Walmart API Error: ${error.message}`);
      }

      // Return null values gracefully on error
      return {
        price: null,
        retailer: 'Walmart',
        url: null,
        inStock: false,
      };
    }
  }
}

// Test function (run standalone)
if (require.main === module) {
  (async () => {
    console.log('🧪 Testing Walmart Provider...\n');

    try {
      const result = await WalmartProvider.getPriceByName('HP Printer Paper 500 Sheets');
      console.log('\n📦 Test Result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('\n❌ Test Failed:', error);
    }
  })();
}
