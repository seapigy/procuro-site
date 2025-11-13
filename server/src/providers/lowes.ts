/**
 * Lowe's Provider (FREE - scrapes embedded JSON)
 * Extracts product data from window.__PRELOADED_STATE__
 */

import { PriceResult, ProviderConfig } from './types';
import { fetchWithRetry, extractEmbeddedJSON, parsePrice, sanitizeKeyword, isValidUrl } from './utils';

const BASE_URL = 'https://www.lowes.com';

export async function getPriceByKeyword(keyword: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Lowe's: Searching for "${keyword}"`);
  
  try {
    const searchUrl = `${BASE_URL}/search?searchTerm=${sanitizeKeyword(keyword)}`;
    const html = await fetchWithRetry(searchUrl, {}, config?.maxRetries, config?.retryDelay);

    // Extract embedded JSON from window.__PRELOADED_STATE__
    const pattern = /window\.__PRELOADED_STATE__\s*=\s*({.*?});/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.searchModel || !data.searchModel.productList) {
      console.log('⚠️  Lowe\'s: No search results found');
      return createEmptyResult();
    }

    const products = data.searchModel.productList;

    if (products.length === 0) {
      console.log('⚠️  Lowe\'s: No products in search results');
      return createEmptyResult();
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestProduct: any = null;

    for (const product of products) {
      if (!product.pricing) continue;

      const currentPrice = parsePrice(
        product.pricing.value ||
        product.pricing.sellPrice ||
        product.pricing.regularPrice
      );

      if (currentPrice && (lowestPrice === null || currentPrice < lowestPrice)) {
        lowestPrice = currentPrice;
        bestProduct = product;
      }
    }

    if (!bestProduct) {
      console.log('⚠️  Lowe\'s: No valid prices found');
      return createEmptyResult();
    }

    const productUrl = bestProduct.url ? `${BASE_URL}${bestProduct.url}` : null;
    
    const isInStock = bestProduct.availability?.status === 'In Stock' ||
                      bestProduct.availabilityStatus === 'IN_STOCK' ||
                      bestProduct.fulfillment?.availableQuantity > 0;

    console.log(`✅ Lowe's: Found "${bestProduct.title}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`);

    return {
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: "Lowe's",
      title: bestProduct.title || bestProduct.brand || null,
      image: bestProduct.imageUrl || bestProduct.image?.url || null,
    };
  } catch (error) {
    console.error('Lowe\'s error:', error);
    return createEmptyResult();
  }
}

export async function getPriceBySKU(sku: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Lowe's: Looking up SKU "${sku}"`);
  
  try {
    // Lowe's product page URL pattern: /pd/{product-name}/{sku}
    const productUrl = `${BASE_URL}/pd/${sku}`;
    const html = await fetchWithRetry(productUrl, {}, config?.maxRetries, config?.retryDelay);

    const pattern = /window\.__PRELOADED_STATE__\s*=\s*({.*?});/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.productDetails) {
      return createEmptyResult();
    }

    const product = data.productDetails;
    const currentPrice = parsePrice(
      product.pricing?.value ||
      product.pricing?.sellPrice ||
      product.pricing?.regularPrice
    );

    const isInStock = product.availability?.status === 'In Stock' ||
                      product.availabilityStatus === 'IN_STOCK';

    return {
      price: currentPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: "Lowe's",
      title: product.title || null,
      image: product.imageUrl || null,
    };
  } catch (error) {
    console.error('Lowe\'s SKU lookup error:', error);
    return createEmptyResult();
  }
}

function createEmptyResult(): PriceResult {
  return {
    price: null,
    url: null,
    stock: null,
    retailer: "Lowe's",
    title: null,
    image: null,
  };
}

