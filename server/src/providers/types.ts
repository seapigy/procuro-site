/**
 * Common types for all retail price providers
 */

export interface PriceResult {
  price: number | null;
  url: string | null;
  stock: boolean | null;
  retailer: string;
  title: string | null;
  image: string | null;
}

export interface ProviderConfig {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export const DEFAULT_TIMEOUT = 10000; // 10 seconds
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_RETRY_DELAY = 1000; // 1 second

