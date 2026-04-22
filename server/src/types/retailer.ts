/**
 * Retailer quote from a provider (e.g. mock, Bright Data)
 */
export interface RetailerQuote {
  retailer: string;
  url?: string;
  unitPrice: number;
  currency?: string;
  capturedAt?: Date;
  rawJson?: unknown;
}

/**
 * Provider that fetches price quotes for an item
 */
export interface RetailerProvider {
  name: string;
  getQuotesForItem(input: {
    companyId: number;
    itemId: number;
    /** Search / discovery keyword (e.g. normalized + brand + hint). */
    name: string;
    /** Item display name for attribute extraction / matcher; defaults to `name` when omitted. */
    matchItemName?: string;
    lastPaidPrice?: number | null;
  }): Promise<RetailerQuote[]>;
}
