import fetch from 'node-fetch';

interface TargetPriceResult {
  price: number | null;
  retailer: 'Target';
  url: string | null;
  inStock: boolean;
}

interface TargetProduct {
  price?: {
    current_retail?: number;
  };
  item?: {
    enrichment?: {
      buy_url?: string;
    };
  };
  available_to_promise_network?: {
    availability_status?: string;
  };
}

interface TargetApiResponse {
  data?: {
    search?: {
      products?: TargetProduct[];
    };
  };
}

/**
 * Target free product API provider using Redsky API
 */
export class TargetProvider {
  private static readonly apiKey = 'ff72517a02a4a298bdf46f87f8ff6df8';

  /**
   * Get price by product name using Target's public Redsky API
   */
  static async getPriceByName(name: string): Promise<TargetPriceResult> {
    try {
      console.log(`🔍 Searching Target for: "${name}"`);

      const url = `https://redsky.target.com/redsky_aggregations/v1/web/plp_product_v1?keyword=${encodeURIComponent(name)}&key=${TargetProvider.apiKey}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.error(`❌ Target API error: ${response.status} ${response.statusText}`);
        return {
          price: null,
          retailer: 'Target',
          url: null,
          inStock: false,
        };
      }

      const data = (await response.json()) as TargetApiResponse;

      // Check if any products were found
      const products = data.data?.search?.products;
      if (!products || products.length === 0) {
        console.log(`⚠️  No products found for: "${name}"`);
        return {
          price: null,
          retailer: 'Target',
          url: null,
          inStock: false,
        };
      }

      const product = products[0];
      const price = product.price?.current_retail || null;
      const url = product.item?.enrichment?.buy_url || null;
      const availabilityStatus = product.available_to_promise_network?.availability_status;
      const inStock = availabilityStatus === 'IN_STOCK' || availabilityStatus === 'AVAILABLE';

      console.log(`✅ Found: $${price?.toFixed(2) || 'N/A'} | Stock: ${inStock}`);

      return {
        price,
        retailer: 'Target',
        url: url ? `https://www.target.com${url}` : null,
        inStock,
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Target API Error: ${error.message}`);
      }

      // Return null values gracefully on error
      return {
        price: null,
        retailer: 'Target',
        url: null,
        inStock: false,
      };
    }
  }
}

// Test function (run standalone)
if (require.main === module) {
  (async () => {
    console.log('🧪 Testing Target Provider...\n');

    try {
      const result = await TargetProvider.getPriceByName('HP Printer Paper 500 Sheets');
      console.log('\n📦 Test Result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('\n❌ Test Failed:', error);
    }
  })();
}

