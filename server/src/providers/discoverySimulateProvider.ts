/**
 * Simulated discovery provider for testing the search → persist → product-URL-fetch flow.
 * Returns persistable quotes (rawJson without 'source') so auto-persist runs.
 * Enable with DISCOVERY_SIMULATE=true when external APIs are unavailable.
 */
import type { RetailerProvider, RetailerQuote } from '../types/retailer';

const AMAZON_ASIN = 'B001234567';
const HD_PRODUCT_ID = '123456789012';

export const discoverySimulateProvider: RetailerProvider = {
  name: 'DiscoverySimulate',

  async getQuotesForItem(input: {
    companyId: number;
    itemId: number;
    name: string;
  }): Promise<RetailerQuote[]> {
    // Simulates Amazon + Home Depot search returning one candidate each.
    // rawJson has no 'source' key so priceCheck auto-persist will run.
    const capturedAt = new Date();
    return [
      {
        retailer: 'Amazon',
        url: `https://www.amazon.com/dp/${AMAZON_ASIN}`,
        unitPrice: 12.99,
        currency: 'USD',
        capturedAt,
        rawJson: { asin: AMAZON_ASIN, title: `Simulated: ${input.name}`, url: `https://www.amazon.com/dp/${AMAZON_ASIN}` },
      },
      {
        retailer: 'Home Depot',
        url: `https://www.homedepot.com/p/example/${HD_PRODUCT_ID}`,
        unitPrice: 9.99,
        currency: 'USD',
        capturedAt,
        rawJson: {
          product_id: HD_PRODUCT_ID,
          product_name: `Simulated: ${input.name}`,
          url: `https://www.homedepot.com/p/example/${HD_PRODUCT_ID}`,
        },
      },
    ];
  },
};
