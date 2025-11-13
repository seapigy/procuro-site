/**
 * Staples Provider (FREE - scrapes Next.js JSON)
 * Extracts product data from <script id="__NEXT_DATA__">
 */

import { PriceResult, ProviderConfig } from './types';
import { fetchWithRetry, extractEmbeddedJSON, parsePrice, sanitizeKeyword, isValidUrl } from './utils';

const BASE_URL = 'https://www.staples.com';

export async function getPriceByKeyword(keyword: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Staples: Searching for "${keyword}"`);
  
  try {
    const searchUrl = `${BASE_URL}/s?k=${sanitizeKeyword(keyword)}`;
    const html = await fetchWithRetry(searchUrl, {}, config?.maxRetries, config?.retryDelay);

    // Extract Next.js embedded JSON from <script id="__NEXT_DATA__">
    const pattern = /<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.props || !data.props.pageProps) {
      console.log('⚠️  Staples: No search results found');
      return createEmptyResult();
    }

    const pageProps = data.props.pageProps;
    const products = pageProps.searchResults?.products || 
                     pageProps.products || 
                     pageProps.initialData?.products || [];

    if (products.length === 0) {
      console.log('⚠️  Staples: No products in search results');
      return createEmptyResult();
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestProduct: any = null;

    for (const product of products) {
      if (!product.price && !product.pricing) continue;

      const currentPrice = parsePrice(
        product.price?.value ||
        product.price?.amount ||
        product.pricing?.price ||
        product.finalPrice
      );

      if (currentPrice && (lowestPrice === null || currentPrice < lowestPrice)) {
        lowestPrice = currentPrice;
        bestProduct = product;
      }
    }

    if (!bestProduct) {
      console.log('⚠️  Staples: No valid prices found');
      return createEmptyResult();
    }

    const productUrl = bestProduct.url 
      ? (bestProduct.url.startsWith('http') ? bestProduct.url : `${BASE_URL}${bestProduct.url}`)
      : (bestProduct.productUrl || null);

    const isInStock = bestProduct.inStock === true ||
                      bestProduct.stock?.status === 'IN_STOCK' ||
                      bestProduct.availability?.toLowerCase().includes('in stock');

    console.log(`✅ Staples: Found "${bestProduct.name || bestProduct.title}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`);

    return {
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Staples',
      title: bestProduct.name || bestProduct.title || null,
      image: bestProduct.image?.url || bestProduct.imageUrl || bestProduct.thumbnail || null,
    };
  } catch (error) {
    console.error('Staples error:', error);
    return createEmptyResult();
  }
}

export async function getPriceBySKU(sku: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Staples: Looking up SKU "${sku}"`);
  
  try {
    // Staples product page URL pattern: /product/{sku}
    const productUrl = `${BASE_URL}/product/${sku}`;
    const html = await fetchWithRetry(productUrl, {}, config?.maxRetries, config?.retryDelay);

    const pattern = /<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.props || !data.props.pageProps) {
      return createEmptyResult();
    }

    const product = data.props.pageProps.product || data.props.pageProps.productData;

    if (!product) {
      return createEmptyResult();
    }

    const currentPrice = parsePrice(
      product.price?.value ||
      product.pricing?.price ||
      product.finalPrice
    );

    const isInStock = product.inStock === true ||
                      product.stock?.status === 'IN_STOCK';

    return {
      price: currentPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Staples',
      title: product.name || product.title || null,
      image: product.image?.url || product.imageUrl || null,
    };
  } catch (error) {
    console.error('Staples SKU lookup error:', error);
    return createEmptyResult();
  }
}

function createEmptyResult(): PriceResult {
  return {
    price: null,
    url: null,
    stock: null,
    retailer: 'Staples',
    title: null,
    image: null,
  };
}

