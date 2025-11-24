/**
 * Utility functions for browser-based price providers
 */

/**
 * Sanitize keyword for URL encoding
 */
export function sanitizeKeyword(keyword: string): string {
  return encodeURIComponent(keyword.trim());
}

/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Parse HTML string using DOMParser
 */
export function parseHTML(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Extract JSON from embedded script tags
 */
export function extractScriptJSON(doc: Document, selector: string): any {
  const script = doc.querySelector(selector);
  if (!script || !script.textContent) {
    return null;
  }

  try {
    return JSON.parse(script.textContent);
  } catch (error) {
    console.error('Failed to parse script JSON:', error);
    return null;
  }
}

/**
 * Extract JSON from window variable pattern
 */
export function extractWindowJSON(html: string, pattern: RegExp): any {
  const match = html.match(pattern);
  if (!match || !match[1]) {
    return null;
  }

  try {
    // Clean up the JSON string
    let jsonStr = match[1];
    
    // Remove trailing semicolons and clean up
    jsonStr = jsonStr.replace(/;+$/, '').trim();
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse window JSON:', error);
    return null;
  }
}

/**
 * Parse price from various formats
 */
export function parsePrice(priceData: any): number | null {
  if (priceData === null || priceData === undefined) {
    return null;
  }

  // If it's already a number
  if (typeof priceData === 'number') {
    return priceData > 0 ? priceData : null;
  }

  // If it's a string, extract the number
  if (typeof priceData === 'string') {
    const cleaned = priceData.replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  // If it's an object, try common price fields
  if (typeof priceData === 'object') {
    const possibleFields = ['price', 'value', 'amount', 'currentPrice', 'finalPrice'];
    for (const field of possibleFields) {
      if (priceData[field] !== undefined) {
        return parsePrice(priceData[field]);
      }
    }
  }

  return null;
}

/**
 * Validate URL
 */
export function isValidUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create empty result for a retailer
 */
export function createEmptyResult(retailer: string, error?: string): any {
  return {
    retailer,
    price: null,
    url: null,
    title: null,
    stock: null,
    image: null,
    error: error || 'No data available',
  };
}




