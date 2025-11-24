/**
 * Lowe's Browser Provider
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

const BASE_URL = 'https://www.lowes.com';

export async function getPriceByKeyword(
  keyword: string,
  config?: ProviderConfig
): Promise<BrowserPriceResult> {
  console.log(`🔍 Lowe's (Browser): Searching for "${keyword}"`);

  try {
    const searchUrl = `${BASE_URL}/search?searchTerm=${sanitizeKeyword(keyword)}`;
    const response = await fetchWithTimeout(
      searchUrl,
      { mode: 'cors' },
      config?.timeout || DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      console.warn(`⚠️  Lowe's: HTTP ${response.status}`);
      return createEmptyResult("Lowe's", `HTTP ${response.status}`);
    }

    const html = await response.text();

    // Lowe's uses window.__PRELOADED_STATE__
    const pattern = /window\.__PRELOADED_STATE__\s*=\s*({.*?});?\s*<\/script>/s;
    const data = extractWindowJSON(html, pattern);

    if (!data || !data.searchModel || !data.searchModel.productList) {
      console.log('⚠️  Lowe\'s: No search results found');
      return createEmptyResult("Lowe's", 'No search results');
    }

    const products = data.searchModel.productList.products || [];

    if (products.length === 0) {
      console.log('⚠️  Lowe\'s: No products found');
      return createEmptyResult("Lowe's", 'No products found');
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestItem: any = null;

    for (const item of products) {
      const price = parsePrice(
        item.pricing?.price || item.pricing?.sellingPrice || item.price
      );
      if (price && (lowestPrice === null || price < lowestPrice)) {
        lowestPrice = price;
        bestItem = item;
      }
    }

    if (!bestItem) {
      console.log('⚠️  Lowe\'s: No valid prices found');
      return createEmptyResult("Lowe's", 'No valid prices');
    }

    const productUrl = bestItem.url ? `${BASE_URL}${bestItem.url}` : null;
    const isInStock = bestItem.availability?.isAvailable === true;

    console.log(
      `✅ Lowe's: Found "${bestItem.name}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`
    );

    return {
      retailer: "Lowe's",
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      title: bestItem.name || bestItem.title || null,
      stock: isInStock,
      image: bestItem.imageUrl || bestItem.image || null,
    };
  } catch (error: any) {
    console.error('Lowe\'s browser error:', error);
    return createEmptyResult("Lowe's", error.message || 'Request failed');
  }
}




