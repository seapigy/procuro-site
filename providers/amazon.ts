import { BaseProvider, PriceData, ProductInfo } from './base';
// @ts-ignore - paapi5-nodejs-sdk doesn't have types
import ProductAdvertisingAPIv1 from 'paapi5-nodejs-sdk';

interface AmazonProviderConfig {
  accessKey: string;
  secretKey: string;
  region: string;
  partnerTag?: string;
}

interface AmazonPriceResult {
  price: number;
  stock: boolean;
  url: string;
}

/**
 * Amazon Product Advertising API v5 provider
 */
export class AmazonProvider extends BaseProvider {
  private config: AmazonProviderConfig;
  private defaultClient: any;
  private api: any;

  constructor(config: AmazonProviderConfig) {
    super();
    this.config = {
      ...config,
      partnerTag: config.partnerTag || 'procuroapp-20', // Default partner tag
    };

    // Initialize Amazon PAAPI client
    this.defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
    this.defaultClient.accessKey = this.config.accessKey;
    this.defaultClient.secretKey = this.config.secretKey;
    this.defaultClient.host = this.getHost(this.config.region);
    this.defaultClient.region = this.config.region;

    this.api = new ProductAdvertisingAPIv1.DefaultApi();
  }

  /**
   * Get Amazon API host based on region
   */
  private getHost(region: string): string {
    const hosts: { [key: string]: string } = {
      'us-east-1': 'webservices.amazon.com',
      'us-west-2': 'webservices.amazon.com',
      'eu-west-1': 'webservices.amazon.co.uk',
      'ap-northeast-1': 'webservices.amazon.co.jp',
    };
    return hosts[region] || 'webservices.amazon.com';
  }

  /**
   * Search for a product by keyword and return the lowest "New" offer price
   */
  async getPriceByKeyword(keyword: string): Promise<AmazonPriceResult> {
    try {
      console.log(`🔍 Searching Amazon for: "${keyword}"`);

      // Create search items request
      const searchItemsRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();
      searchItemsRequest.PartnerTag = this.config.partnerTag;
      searchItemsRequest.PartnerType = 'Associates';
      searchItemsRequest.Keywords = keyword;
      searchItemsRequest.SearchIndex = 'All';
      searchItemsRequest.ItemCount = 5; // Get top 5 results
      searchItemsRequest.Resources = [
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.Condition',
        'Offers.Listings.Availability.Type',
      ];

      // Make API request
      const response = await new Promise((resolve, reject) => {
        this.api.searchItems(searchItemsRequest, (error: any, data: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      });

      const data = response as any;

      if (!data.SearchResult || !data.SearchResult.Items || data.SearchResult.Items.length === 0) {
        throw new Error(`No products found for keyword: "${keyword}"`);
      }

      // Find the lowest "New" condition price
      let lowestPrice: number | null = null;
      let productUrl = '';
      let inStock = false;

      for (const item of data.SearchResult.Items) {
        if (!item.Offers || !item.Offers.Listings) continue;

        for (const listing of item.Offers.Listings) {
          // Check if condition is "New"
          if (listing.Condition && listing.Condition.Value === 'New') {
            const price = listing.Price?.Amount || listing.Price?.DisplayAmount;
            
            if (price) {
              const numericPrice = typeof price === 'number' ? price : parseFloat(price);
              
              if (lowestPrice === null || numericPrice < lowestPrice) {
                lowestPrice = numericPrice;
                productUrl = item.DetailPageURL || '';
                inStock = listing.Availability?.Type === 'Now' || listing.Availability?.Type === 'InStock';
              }
            }
          }
        }
      }

      if (lowestPrice === null) {
        throw new Error(`No "New" condition offers found for: "${keyword}"`);
      }

      console.log(`✅ Found price: $${lowestPrice.toFixed(2)} | Stock: ${inStock}`);
      console.log(`   URL: ${productUrl}`);

      return {
        price: lowestPrice,
        stock: inStock,
        url: productUrl,
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Amazon API Error: ${error.message}`);
        
        // Handle specific error cases
        if (error.message.includes('No products found')) {
          throw new Error(`404: No products found for keyword "${keyword}"`);
        }
        if (error.message.includes('No "New" condition offers')) {
          throw new Error(`404: No new items available for "${keyword}"`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get price by product ASIN
   */
  async getPrice(productId: string): Promise<PriceData> {
    try {
      // Create get items request
      const getItemsRequest = new ProductAdvertisingAPIv1.GetItemsRequest();
      getItemsRequest.PartnerTag = this.config.partnerTag;
      getItemsRequest.PartnerType = 'Associates';
      getItemsRequest.ItemIds = [productId];
      getItemsRequest.Resources = [
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.Condition',
        'Offers.Listings.Availability.Type',
      ];

      const response = await new Promise((resolve, reject) => {
        this.api.getItems(getItemsRequest, (error: any, data: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      });

      const data = response as any;

      if (!data.ItemsResult || !data.ItemsResult.Items || data.ItemsResult.Items.length === 0) {
        throw new Error(`Product not found: ${productId}`);
      }

      const item = data.ItemsResult.Items[0];
      const listing = item.Offers?.Listings?.[0];
      const price = listing?.Price?.Amount || 0;
      const availability = listing?.Availability?.Type === 'Now' || listing?.Availability?.Type === 'InStock';

      return {
        productId,
        price: typeof price === 'number' ? price : parseFloat(price),
        currency: listing?.Price?.Currency || 'USD',
        availability,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Error fetching price from Amazon:', error);
      throw error;
    }
  }

  /**
   * Get product information by ASIN
   */
  async getProductInfo(productId: string): Promise<ProductInfo> {
    try {
      const priceData = await this.getPrice(productId);
      
      // Get additional product details
      const getItemsRequest = new ProductAdvertisingAPIv1.GetItemsRequest();
      getItemsRequest.PartnerTag = this.config.partnerTag;
      getItemsRequest.PartnerType = 'Associates';
      getItemsRequest.ItemIds = [productId];
      getItemsRequest.Resources = [
        'ItemInfo.Title',
        'Images.Primary.Large',
        'Offers.Listings.Price',
      ];

      const response = await new Promise((resolve, reject) => {
        this.api.getItems(getItemsRequest, (error: any, data: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      });

      const data = response as any;
      const item = data.ItemsResult?.Items?.[0];

      return {
        productId,
        title: item?.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
        imageUrl: item?.Images?.Primary?.Large?.URL,
        url: item?.DetailPageURL || '',
        price: priceData.price,
        currency: priceData.currency,
      };
    } catch (error) {
      console.error('Error fetching product info from Amazon:', error);
      throw error;
    }
  }
}

// Test function (run standalone)
if (require.main === module) {
  (async () => {
    console.log('🧪 Testing Amazon Provider...\n');

    const provider = new AmazonProvider({
      accessKey: process.env.AMAZON_ACCESS_KEY || '',
      secretKey: process.env.AMAZON_SECRET_KEY || '',
      region: process.env.AMAZON_REGION || 'us-east-1',
    });

    try {
      const result = await provider.getPriceByKeyword('HP Printer Paper 500 Sheets');
      console.log('\n📦 Test Result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('\n❌ Test Failed:', error);
    }
  })();
}