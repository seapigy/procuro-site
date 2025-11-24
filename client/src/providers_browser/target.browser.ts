/**
 * Target Browser Provider
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

const BASE_URL = 'https://www.target.com';

export async function getPriceByKeyword(
  keyword: string,
  config?: ProviderConfig
): Promise<BrowserPriceResult> {
  console.log(`🔍 Target (Browser): Searching for "${keyword}"`);

  try {
    const searchUrl = `${BASE_URL}/s?searchTerm=${sanitizeKeyword(keyword)}`;
    const response = await fetchWithTimeout(
      searchUrl,
      { mode: 'cors' },
      config?.timeout || DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      console.warn(`⚠️  Target: HTTP ${response.status}`);
      return createEmptyResult('Target', `HTTP ${response.status}`);
    }

    const html = await response.text();
    const doc = parseHTML(html);

    // Target uses __NEXT_DATA__ for their data
    const nextData = extractScriptJSON(doc, 'script#__NEXT_DATA__');

    if (!nextData || !nextData.props || !nextData.props.pageProps) {
      console.log('⚠️  Target: No search data found');
      return createEmptyResult('Target', 'No search data');
    }

    const pageProps = nextData.props.pageProps;
    const searchResults =
      pageProps.initialData?.searchResponse?.products ||
      pageProps.data?.search?.products ||
      [];

    if (searchResults.length === 0) {
      console.log('⚠️  Target: No products found');
      return createEmptyResult('Target', 'No products found');
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestItem: any = null;

    for (const item of searchResults) {
      const price = parsePrice(item.price?.current_retail || item.price?.current);
      if (price && (lowestPrice === null || price < lowestPrice)) {
        lowestPrice = price;
        bestItem = item;
      }
    }

    if (!bestItem) {
      console.log('⚠️  Target: No valid prices found');
      return createEmptyResult('Target', 'No valid prices');
    }

    const productUrl = bestItem.url ? `${BASE_URL}${bestItem.url}` : null;
    const isInStock = bestItem.fulfillment?.is_out_of_stock === false;

    console.log(
      `✅ Target: Found "${bestItem.title}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`
    );

    return {
      retailer: 'Target',
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      title: bestItem.title || null,
      stock: isInStock,
      image: bestItem.image?.base_url || bestItem.image_url || null,
    };
  } catch (error: any) {
    console.error('Target browser error:', error);
    return createEmptyResult('Target', error.message || 'Request failed');
  }
}




