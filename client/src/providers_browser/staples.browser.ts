/**
 * Staples Browser Provider
 * Fetches prices directly from user's browser to avoid IP blocking
 */

import { BrowserPriceResult, ProviderConfig, DEFAULT_TIMEOUT } from './types';
import {
  sanitizeKeyword,
  fetchWithTimeout,
  parseHTML,
  extractScriptJSON,
  parsePrice,
  isValidUrl,
  createEmptyResult,
} from './utils';

const BASE_URL = 'https://www.staples.com';

export async function getPriceByKeyword(
  keyword: string,
  config?: ProviderConfig
): Promise<BrowserPriceResult> {
  console.log(`🔍 Staples (Browser): Searching for "${keyword}"`);

  try {
    const searchUrl = `${BASE_URL}/search?query=${sanitizeKeyword(keyword)}`;
    const response = await fetchWithTimeout(
      searchUrl,
      { mode: 'cors' },
      config?.timeout || DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      console.warn(`⚠️  Staples: HTTP ${response.status}`);
      return createEmptyResult('Staples', `HTTP ${response.status}`);
    }

    const html = await response.text();
    const doc = parseHTML(html);

    // Staples uses __NEXT_DATA__
    const nextData = extractScriptJSON(doc, 'script#__NEXT_DATA__');

    if (!nextData || !nextData.props || !nextData.props.pageProps) {
      console.log('⚠️  Staples: No search data found');
      return createEmptyResult('Staples', 'No search data');
    }

    const searchResults =
      nextData.props.pageProps.initialData?.products ||
      nextData.props.pageProps.searchResults?.products ||
      [];

    if (searchResults.length === 0) {
      console.log('⚠️  Staples: No products found');
      return createEmptyResult('Staples', 'No products found');
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestItem: any = null;

    for (const item of searchResults) {
      const price = parsePrice(
        item.pricing?.finalPrice || item.price?.finalPrice || item.price
      );
      if (price && (lowestPrice === null || price < lowestPrice)) {
        lowestPrice = price;
        bestItem = item;
      }
    }

    if (!bestItem) {
      console.log('⚠️  Staples: No valid prices found');
      return createEmptyResult('Staples', 'No valid prices');
    }

    const productUrl = bestItem.url ? `${BASE_URL}${bestItem.url}` : null;
    const isInStock = bestItem.availability?.status === 'IN_STOCK';

    console.log(
      `✅ Staples: Found "${bestItem.name}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`
    );

    return {
      retailer: 'Staples',
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      title: bestItem.name || bestItem.title || null,
      stock: isInStock,
      image: bestItem.imageUrl || bestItem.image || null,
    };
  } catch (error: any) {
    console.error('Staples browser error:', error);
    return createEmptyResult('Staples', error.message || 'Request failed');
  }
}




