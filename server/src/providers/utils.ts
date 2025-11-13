/**
 * Utility functions for retail price providers
 */

import axios, { AxiosRequestConfig } from 'axios';
import { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY } from './types';

// Re-export constants for use in providers
export { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY };

/**
 * Fetch HTML with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: AxiosRequestConfig = {},
  maxRetries = DEFAULT_MAX_RETRIES,
  retryDelay = DEFAULT_RETRY_DELAY
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: options.timeout || DEFAULT_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          ...options.headers,
        },
        ...options,
      });

      return response.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < maxRetries) {
        console.log(`⚠️  Retry attempt ${attempt + 1}/${maxRetries} for ${url}`);
        await sleep(retryDelay * (attempt + 1)); // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Failed to fetch URL');
}

/**
 * Extract JSON from embedded script tag
 */
export function extractEmbeddedJSON(html: string, pattern: string | RegExp): any | null {
  try {
    const match = html.match(pattern);
    if (!match || !match[1]) {
      return null;
    }

    const jsonString = match[1].trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to extract embedded JSON:', error);
    return null;
  }
}

/**
 * Parse price string to number
 */
export function parsePrice(priceString: string | number | undefined | null): number | null {
  if (typeof priceString === 'number') {
    return priceString;
  }

  if (!priceString) {
    return null;
  }

  // Remove currency symbols, commas, and whitespace
  const cleaned = String(priceString)
    .replace(/[$£€¥,\s]/g, '')
    .trim();

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize search keyword for URLs
 */
export function sanitizeKeyword(keyword: string): string {
  return encodeURIComponent(keyword.trim());
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

