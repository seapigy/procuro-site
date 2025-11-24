/**
 * Common types for browser-based retail price providers
 * These providers run in the user's browser to avoid IP blocking
 */

export interface BrowserPriceResult {
  retailer: string;
  price: number | null;
  url: string | null;
  title: string | null;
  stock: boolean | null;
  image: string | null;
  error?: string;
}

export interface ProviderConfig {
  timeout?: number;
  corsProxy?: string;
}

export const DEFAULT_TIMEOUT = 15000; // 15 seconds for browser requests




