/**
 * HTML Fetching Utility with Retry Logic
 * Handles fetching retailer HTML from the backend to avoid CORS
 */

import fetch from 'node-fetch';

// Comprehensive list of real browser User-Agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:119.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
];

/**
 * Get a random User-Agent from the pool
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Validate HTML content
 */
function isValidHtml(html: string): boolean {
  if (!html || html.length < 100) return false;
  
  // Check for common HTML tags
  const hasHtmlTag = html.includes('<html') || html.includes('<!DOCTYPE');
  const hasBody = html.includes('<body') || html.includes('<div');
  
  return hasHtmlTag || hasBody;
}

/**
 * Fetch HTML with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: any,
  timeout: number
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch HTML with retry logic and error handling
 */
export async function fetchHtmlWithRetries(
  url: string,
  options: {
    maxRetries?: number;
    timeout?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<{
  html: string;
  finalUrl: string;
  error?: string;
  userAgent?: string;
}> {
  const maxRetries = options.maxRetries || 3;
  const timeout = options.timeout || 10000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const userAgent = getRandomUserAgent();
      
      console.log(`🔍 Fetching HTML (attempt ${attempt}/${maxRetries}): ${url}`);
      
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            ...options.headers,
          },
        },
        timeout
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Validate HTML
      if (!isValidHtml(html)) {
        throw new Error('Invalid HTML received (too short or malformed)');
      }

      console.log(`✅ HTML fetched successfully (${html.length} bytes)`);

      return {
        html,
        finalUrl: response.url || url,
        userAgent,
      };
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Attempt ${attempt} failed: ${error.message}`);

      // Don't retry on certain errors
      if (error.message.includes('404') || error.message.includes('403')) {
        break;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries failed
  console.error(`❌ Failed to fetch after ${maxRetries} attempts: ${lastError?.message}`);
  
  return {
    html: '',
    finalUrl: url,
    error: lastError?.message || 'Failed to fetch HTML',
  };
}

/**
 * Extract JSON from HTML patterns
 */
export function extractJsonFromHtml(html: string, pattern: RegExp): any {
  const match = html.match(pattern);
  if (!match || !match[1]) {
    return null;
  }

  try {
    let jsonStr = match[1];
    jsonStr = jsonStr.replace(/;+$/, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON from HTML:', error);
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

  if (typeof priceData === 'number') {
    return priceData > 0 ? priceData : null;
  }

  if (typeof priceData === 'string') {
    const cleaned = priceData.replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

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




