/**
 * Home Depot Browser Provider
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

const BASE_URL = 'https://www.homedepot.com';

export async function getPriceByKeyword(
  keyword: string,
  config?: ProviderConfig
): Promise<BrowserPriceResult> {
  console.log(`🔍 Home Depot (Browser): Searching for "${keyword}"`);

  try {
    const searchUrl = `${BASE_URL}/s/${sanitizeKeyword(keyword)}`;
    const response = await fetchWithTimeout(
      searchUrl,
      { mode: 'cors' },
      config?.timeout || DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      console.warn(`⚠️  Home Depot: HTTP ${response.status}`);
      return createEmptyResult('Home Depot', `HTTP ${response.status}`);
    }

    const html = await response.text();
    const doc = parseHTML(html);

    // Home Depot uses __NEXT_DATA__
    const nextData = extractScriptJSON(doc, 'script#__NEXT_DATA__');

    if (!nextData || !nextData.props || !nextData.props.pageProps) {
      console.log('⚠️  Home Depot: No search data found');
      return createEmptyResult('Home Depot', 'No search data');
    }

    const searchResults =
      nextData.props.pageProps.searchResults?.products ||
      nextData.props.pageProps.data?.products ||
      [];

    if (searchResults.length === 0) {
      console.log('⚠️  Home Depot: No products found');
      return createEmptyResult('Home Depot', 'No products found');
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestItem: any = null;

    for (const item of searchResults) {
      const price = parsePrice(item.pricing?.value || item.price);
      if (price && (lowestPrice === null || price < lowestPrice)) {
        lowestPrice = price;
        bestItem = item;
      }
    }

    if (!bestItem) {
      console.log('⚠️  Home Depot: No valid prices found');
      return createEmptyResult('Home Depot', 'No valid prices');
    }

    const productUrl = bestItem.itemUrl ? `${BASE_URL}${bestItem.itemUrl}` : null;
    const isInStock = bestItem.fulfillment?.fulfillable === true;

    console.log(
      `✅ Home Depot: Found "${bestItem.productLabel}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`
    );

    return {
      retailer: 'Home Depot',
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      title: bestItem.productLabel || bestItem.title || null,
      stock: isInStock,
      image: bestItem.media?.images?.[0]?.url || null,
    };
  } catch (error: any) {
    console.error('Home Depot browser error:', error);
    return createEmptyResult('Home Depot', error.message || 'Request failed');
  }
}




