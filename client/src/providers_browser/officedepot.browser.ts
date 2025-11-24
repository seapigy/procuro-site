/**
 * Office Depot Browser Provider
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

const BASE_URL = 'https://www.officedepot.com';

export async function getPriceByKeyword(
  keyword: string,
  config?: ProviderConfig
): Promise<BrowserPriceResult> {
  console.log(`🔍 Office Depot (Browser): Searching for "${keyword}"`);

  try {
    const searchUrl = `${BASE_URL}/catalog/search.do?Ntt=${sanitizeKeyword(keyword)}`;
    const response = await fetchWithTimeout(
      searchUrl,
      { mode: 'cors' },
      config?.timeout || DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      console.warn(`⚠️  Office Depot: HTTP ${response.status}`);
      return createEmptyResult('Office Depot', `HTTP ${response.status}`);
    }

    const html = await response.text();
    const doc = parseHTML(html);

    // Office Depot uses __NEXT_DATA__ or embedded JSON
    const nextData = extractScriptJSON(doc, 'script#__NEXT_DATA__');

    if (!nextData || !nextData.props || !nextData.props.pageProps) {
      console.log('⚠️  Office Depot: No search data found');
      return createEmptyResult('Office Depot', 'No search data');
    }

    const searchResults =
      nextData.props.pageProps.initialData?.products ||
      nextData.props.pageProps.searchData?.products ||
      [];

    if (searchResults.length === 0) {
      console.log('⚠️  Office Depot: No products found');
      return createEmptyResult('Office Depot', 'No products found');
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestItem: any = null;

    for (const item of searchResults) {
      const price = parsePrice(
        item.pricing?.price || item.price?.finalPrice || item.price
      );
      if (price && (lowestPrice === null || price < lowestPrice)) {
        lowestPrice = price;
        bestItem = item;
      }
    }

    if (!bestItem) {
      console.log('⚠️  Office Depot: No valid prices found');
      return createEmptyResult('Office Depot', 'No valid prices');
    }

    const productUrl = bestItem.url ? `${BASE_URL}${bestItem.url}` : null;
    const isInStock = bestItem.availability?.inStock === true;

    console.log(
      `✅ Office Depot: Found "${bestItem.name}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`
    );

    return {
      retailer: 'Office Depot',
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      title: bestItem.name || bestItem.title || null,
      stock: isInStock,
      image: bestItem.imageUrl || bestItem.image || null,
    };
  } catch (error: any) {
    console.error('Office Depot browser error:', error);
    return createEmptyResult('Office Depot', error.message || 'Request failed');
  }
}




