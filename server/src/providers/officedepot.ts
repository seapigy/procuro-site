/**
 * Office Depot Provider (FREE - scrapes Next.js JSON)
 * Extracts product data from <script id="__NEXT_DATA__">
 */

import { PriceResult, ProviderConfig } from './types';
import { fetchWithRetry, extractEmbeddedJSON, parsePrice, sanitizeKeyword, isValidUrl } from './utils';

const BASE_URL = 'https://www.officedepot.com';

export async function getPriceByKeyword(keyword: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Office Depot: Searching for "${keyword}"`);
  
  try {
    const searchUrl = `${BASE_URL}/catalog/search.do?Ntt=${sanitizeKeyword(keyword)}`;
    const html = await fetchWithRetry(searchUrl, {}, config?.maxRetries, config?.retryDelay);

    // Extract Next.js embedded JSON from <script id="__NEXT_DATA__">
    const pattern = /<script\s+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s;
    const data = extractEmbeddedJSON(html, pattern);

    if (!data || !data.props || !data.props.pageProps) {
      console.log('⚠️  Office Depot: No search results found');
      return createEmptyResult();
    }

    const pageProps = data.props.pageProps;
    const products = pageProps.searchResults?.products ||
                     pageProps.products ||
                     pageProps.initialState?.products || [];

    if (products.length === 0) {
      console.log('⚠️  Office Depot: No products in search results');
      return createEmptyResult();
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestProduct: any = null;

    for (const product of products) {
      if (!product.price && !product.pricing) continue;

      const currentPrice = parsePrice(
        product.price?.value ||
        product.price?.salePrice ||
        product.pricing?.currentPrice ||
        product.currentPrice
      );

      if (currentPrice && (lowestPrice === null || currentPrice < lowestPrice)) {
        lowestPrice = currentPrice;
        bestProduct = product;
      }
    }

    if (!bestProduct) {
      console.log('⚠️  Office Depot: No valid prices found');
      return createEmptyResult();
    }

    const productUrl = bestProduct.url
      ? (bestProduct.url.startsWith('http') ? bestProduct.url : `${BASE_URL}${bestProduct.url}`)
      : (bestProduct.productUrl || null);

    const isInStock = bestProduct.availability === 'In Stock' ||
                      bestProduct.inStock === true ||
                      bestProduct.stock?.available === true;

    console.log(`✅ Office Depot: Found "${bestProduct.title || bestProduct.name}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`);

    return {
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Office Depot',
      title: bestProduct.title || bestProduct.name || null,
      image: bestProduct.image?.url || bestProduct.imageUrl || bestProduct.thumbnail || null,
    };
  } catch (error) {
    console.error('Office Depot error:', error);
    return createEmptyResult();
  }
}

export async function getPriceBySKU(sku: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Office Depot: Looking up SKU "${sku}"`);
  
  try {
    // Office Depot product page URL pattern: /a/products/{sku}
    const productUrl = `${BASE_URL}/a/products/${sku}/`;
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
      product.pricing?.currentPrice ||
      product.currentPrice
    );

    const isInStock = product.availability === 'In Stock' ||
                      product.inStock === true;

    return {
      price: currentPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Office Depot',
      title: product.title || product.name || null,
      image: product.image?.url || product.imageUrl || null,
    };
  } catch (error) {
    console.error('Office Depot SKU lookup error:', error);
    return createEmptyResult();
  }
}

function createEmptyResult(): PriceResult {
  return {
    price: null,
    url: null,
    stock: null,
    retailer: 'Office Depot',
    title: null,
    image: null,
  };
}

