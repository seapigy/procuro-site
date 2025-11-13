/**
 * Walmart Provider (FREE - uses public search API)
 * Scrapes embedded JSON from Walmart.com search results
 */

import { PriceResult, ProviderConfig } from './types';
import { fetchWithRetry, extractEmbeddedJSON, parsePrice, sanitizeKeyword, isValidUrl } from './utils';

const BASE_URL = 'https://www.walmart.com';

export async function getPriceByKeyword(keyword: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Walmart: Searching for "${keyword}"`);
  
  try {
    const searchUrl = `${BASE_URL}/search?q=${sanitizeKeyword(keyword)}`;
    const html = await fetchWithRetry(searchUrl, {}, config?.maxRetries, config?.retryDelay);

    // Extract embedded JSON from window.__WML_REDUX_INITIAL_STATE__
    const pattern = /<script[^>]*>window\.__WML_REDUX_INITIAL_STATE__\s*=\s*({.*?});?<\/script>/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.searchContent || !data.searchContent.searchContent) {
      console.log('⚠️  Walmart: No search results found');
      return createEmptyResult();
    }

    const searchResults = data.searchContent.searchContent;
    const items = searchResults.preso?.items || searchResults.items || [];

    if (items.length === 0) {
      console.log('⚠️  Walmart: No items in search results');
      return createEmptyResult();
    }

    // Find the lowest priced item
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
      return createEmptyResult();
    }

    const productUrl = bestItem.canonicalUrl 
      ? `${BASE_URL}${bestItem.canonicalUrl}`
      : (bestItem.productPageUrl || null);

    const isInStock = bestItem.availabilityStatusV2?.display === 'In stock' ||
                      bestItem.availabilityStatusV2?.value === 'IN_STOCK';

    console.log(`✅ Walmart: Found "${bestItem.name}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`);

    return {
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Walmart',
      title: bestItem.name || null,
      image: bestItem.imageInfo?.thumbnailUrl || bestItem.image || null,
    };
  } catch (error) {
    console.error('Walmart error:', error);
    return createEmptyResult();
  }
}

export async function getPriceBySKU(sku: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Walmart: Looking up SKU "${sku}"`);
  
  try {
    // Walmart product page URL pattern: /ip/{product-name}/{SKU}
    const productUrl = `${BASE_URL}/ip/${sku}`;
    const html = await fetchWithRetry(productUrl, {}, config?.maxRetries, config?.retryDelay);

    const pattern = /<script[^>]*>window\.__WML_REDUX_INITIAL_STATE__\s*=\s*({.*?});?<\/script>/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.product) {
      return createEmptyResult();
    }

    const product = data.product;
    const currentPrice = parsePrice(product.priceInfo?.currentPrice?.price);
    const isInStock = product.availabilityStatus === 'IN_STOCK';

    return {
      price: currentPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Walmart',
      title: product.name || null,
      image: product.imageInfo?.thumbnailUrl || null,
    };
  } catch (error) {
    console.error('Walmart SKU lookup error:', error);
    return createEmptyResult();
  }
}

function createEmptyResult(): PriceResult {
  return {
    price: null,
    url: null,
    stock: null,
    retailer: 'Walmart',
    title: null,
    image: null,
  };
}

