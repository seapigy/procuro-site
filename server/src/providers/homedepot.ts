/**
 * Home Depot Provider (FREE - scrapes embedded JSON)
 * Extracts product data from window.__app__.pageData
 */

import { PriceResult, ProviderConfig } from './types';
import { fetchWithRetry, extractEmbeddedJSON, parsePrice, sanitizeKeyword, isValidUrl } from './utils';

const BASE_URL = 'https://www.homedepot.com';

export async function getPriceByKeyword(keyword: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Home Depot: Searching for "${keyword}"`);
  
  try {
    const searchUrl = `${BASE_URL}/s/${sanitizeKeyword(keyword)}`;
    const html = await fetchWithRetry(searchUrl, {}, config?.maxRetries, config?.retryDelay);

    // Extract embedded JSON from window.__app__
    const pattern = /window\.__app__\s*=\s*({.*?});/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.pageData || !data.pageData.searchReport) {
      console.log('⚠️  Home Depot: No search results found');
      return createEmptyResult();
    }

    const searchResults = data.pageData.searchReport;
    const products = searchResults.products || [];

    if (products.length === 0) {
      console.log('⚠️  Home Depot: No products in search results');
      return createEmptyResult();
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestProduct: any = null;

    for (const product of products) {
      if (!product.pricing) continue;

      const currentPrice = parsePrice(
        product.pricing.value ||
        product.pricing.specialValue ||
        product.pricing.original
      );

      if (currentPrice && (lowestPrice === null || currentPrice < lowestPrice)) {
        lowestPrice = currentPrice;
        bestProduct = product;
      }
    }

    if (!bestProduct) {
      console.log('⚠️  Home Depot: No valid prices found');
      return createEmptyResult();
    }

    const productUrl = bestProduct.canonicalUrl 
      ? `${BASE_URL}${bestProduct.canonicalUrl}`
      : (bestProduct.productUrl ? `${BASE_URL}${bestProduct.productUrl}` : null);

    const isInStock = bestProduct.fulfillment?.fulfillmentOptions?.some(
      (opt: any) => opt.type === 'BOSS' && opt.available
    ) || bestProduct.availabilityType?.type === 'AVAILABLE';

    console.log(`✅ Home Depot: Found "${bestProduct.identifiers?.productLabel}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`);

    return {
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Home Depot',
      title: bestProduct.identifiers?.productLabel || bestProduct.identifiers?.brandName || null,
      image: bestProduct.media?.images?.[0]?.url || null,
    };
  } catch (error) {
    console.error('Home Depot error:', error);
    return createEmptyResult();
  }
}

export async function getPriceBySKU(sku: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Home Depot: Looking up SKU "${sku}"`);
  
  try {
    // Home Depot product page URL pattern: /p/{sku}
    const productUrl = `${BASE_URL}/p/${sku}`;
    const html = await fetchWithRetry(productUrl, {}, config?.maxRetries, config?.retryDelay);

    const pattern = /window\.__app__\s*=\s*({.*?});/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.pageData || !data.pageData.product) {
      return createEmptyResult();
    }

    const product = data.pageData.product;
    const currentPrice = parsePrice(
      product.pricing?.value ||
      product.pricing?.specialValue ||
      product.pricing?.original
    );

    const isInStock = product.availabilityType?.type === 'AVAILABLE' ||
                      product.fulfillment?.fulfillmentOptions?.some(
                        (opt: any) => opt.type === 'BOSS' && opt.available
                      );

    return {
      price: currentPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Home Depot',
      title: product.identifiers?.productLabel || null,
      image: product.media?.images?.[0]?.url || null,
    };
  } catch (error) {
    console.error('Home Depot SKU lookup error:', error);
    return createEmptyResult();
  }
}

function createEmptyResult(): PriceResult {
  return {
    price: null,
    url: null,
    stock: null,
    retailer: 'Home Depot',
    title: null,
    image: null,
  };
}

