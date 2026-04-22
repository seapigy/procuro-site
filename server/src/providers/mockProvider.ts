import type { RetailerProvider, RetailerQuote } from '../types/retailer';

/**
 * Deterministic mock provider for testing.
 * Same itemId yields similar quotes each run (unitPrice in 5–80 range).
 */
export const mockProvider: RetailerProvider = {
  name: 'Mock',

  async getQuotesForItem(input: {
    companyId: number;
    itemId: number;
    name: string;
  }): Promise<RetailerQuote[]> {
    const { itemId } = input;
    const seed = itemId * 7919 + 31; // deterministic
    const base = 5 + (seed % 76); // 5–80
    const offset = (seed % 17) - 8; // -8 to +8

    const amazonPrice = base;
    const homeDepotPrice = Math.max(5, Math.min(80, base + offset));

    const capturedAt = new Date();

    return [
      {
        retailer: 'Amazon',
        url: `https://amazon.com/dp/MOCK-${itemId}`,
        unitPrice: amazonPrice,
        currency: 'USD',
        capturedAt,
        rawJson: { source: 'mock', itemId },
      },
      {
        retailer: 'Home Depot',
        url: `https://www.homedepot.com/p/MOCK-${itemId}`,
        unitPrice: homeDepotPrice,
        currency: 'USD',
        capturedAt,
        rawJson: { source: 'mock', itemId },
      },
    ];
  },
};
