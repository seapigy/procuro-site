/**
 * Walmart Browser Provider
 * Fetches prices directly from user's browser to avoid IP blocking
 */

import { BrowserPriceResult, ProviderConfig, DEFAULT_TIMEOUT } from './types';
import {
  sanitizeKeyword,
  fetchWithTimeout,
  extractWindowJSON,
  parsePrice,
  isValidUrl,
  createEmptyResult,
} from './utils';

const BASE_URL = 'https://www.walmart.com';

export async function getPriceByKeyword(
  keyword: string,
  config?: ProviderConfig
): Promise<BrowserPriceResult> {
  console.log(`🔍 Walmart (Browser): Searching for "${keyword}"`);

  try {
    const searchUrl = `${BASE_URL}/search?q=${sanitizeKeyword(keyword)}`;
    const response = await fetchWithTimeout(
      searchUrl,
      { mode: 'cors' },
      config?.timeout || DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      console.warn(`⚠️  Walmart: HTTP ${response.status}`);
      return createEmptyResult('Walmart', `HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract embedded JSON from window.__WML_REDUX_INITIAL_STATE__
    const pattern = /window\.__WML_REDUX_INITIAL_STATE__\s*=\s*({.*?});?\s*<\/script>/s;
    const data = extractWindowJSON(html, pattern);

    if (!data || !data.searchContent || !data.searchContent.searchContent) {
      console.log('⚠️  Walmart: No search results found');
      return createEmptyResult('Walmart', 'No search results');
    }

    const searchResults = data.searchContent.searchContent;
    const items = searchResults.preso?.items || searchResults.items || [];

    if (items.length === 0) {
      console.log('⚠️  Walmart: No items in search results');
      return createEmptyResult('Walmart', 'No items found');
    }

    // Find the lowest priced item that's available
    let lowestPrice: number | null = null;
    let bestItem: any = null;

    for (const item of items) {
      if (!item.price || !item.availabilityStatusV2?.display) continue;

      const currentPrice = parsePrice(item.price);
      if (currentPrice && (lowestPrice === null || currentPrice < lowestPrice)) {
        lowestPrice = currentPrice;
        bestItem = item;
      }
    }

    if (!bestItem) {
      console.log('⚠️  Walmart: No valid prices found');
      return createEmptyResult('Walmart', 'No valid prices');
    }

    const productUrl = bestItem.canonicalUrl
      ? `${BASE_URL}${bestItem.canonicalUrl}`
      : bestItem.productPageUrl || null;

    const isInStock =
      bestItem.availabilityStatusV2?.display === 'In stock' ||
      bestItem.availabilityStatusV2?.value === 'IN_STOCK';

    console.log(
      `✅ Walmart: Found "${bestItem.name}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`
    );

    return {
      retailer: 'Walmart',
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      title: bestItem.name || null,
      stock: isInStock,
      image: bestItem.imageInfo?.thumbnailUrl || bestItem.image || null,
    };
  } catch (error: any) {
    console.error('Walmart browser error:', error);
    return createEmptyResult('Walmart', error.message || 'Request failed');
  }
}




