/**
 * Target Provider (FREE - uses RedSky API)
 * Target's public RedSky API for product search
 */

import axios from 'axios';
import { PriceResult, ProviderConfig } from './types';
import { parsePrice, sanitizeKeyword, DEFAULT_TIMEOUT, isValidUrl } from './utils';

const REDSKY_API_URL = 'https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1';
const BASE_URL = 'https://www.target.com';

export async function getPriceByKeyword(keyword: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Target: Searching for "${keyword}"`);
  
  try {
    const apiUrl = `${REDSKY_API_URL}?key=ff457966e64d5e877fdbad070f276d18ecec4a01&channel=WEB&page=%2Fs%2F${sanitizeKeyword(keyword)}`;

    const response = await axios.get(apiUrl, {
      timeout: config?.timeout || DEFAULT_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    const data = response.data;

    if (!data || !data.data || !data.data.search || !data.data.search.products) {
      console.log('⚠️  Target: No search results found');
      return createEmptyResult();
    }

    const products = data.data.search.products;

    if (products.length === 0) {
      console.log('⚠️  Target: No products in search results');
      return createEmptyResult();
    }

    // Find the lowest priced item
    let lowestPrice: number | null = null;
    let bestProduct: any = null;

    for (const product of products) {
      if (!product.price) continue;

      const currentPrice = parsePrice(product.price.current_retail || product.price.reg_retail);
      
      if (currentPrice && (lowestPrice === null || currentPrice < lowestPrice)) {
        lowestPrice = currentPrice;
        bestProduct = product;
      }
    }

    if (!bestProduct) {
      console.log('⚠️  Target: No valid prices found');
      return createEmptyResult();
    }

    const productUrl = bestProduct.url ? `${BASE_URL}${bestProduct.url}` : null;
    const isInStock = bestProduct.availability?.toLowerCase() === 'available' ||
                      bestProduct.available === true;

    console.log(`✅ Target: Found "${bestProduct.title}" at $${lowestPrice?.toFixed(2)} (Stock: ${isInStock})`);

    return {
      price: lowestPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Target',
      title: bestProduct.title || null,
      image: bestProduct.image_url || null,
    };
  } catch (error) {
    console.error('Target error:', error);
    return createEmptyResult();
  }
}

export async function getPriceBySKU(sku: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Target: Looking up SKU "${sku}"`);
  
  try {
    // Target product API using TCIN (Target.com Item Number)
    const apiUrl = `${REDSKY_API_URL}?key=ff457966e64d5e877fdbad070f276d18ecec4a01&tcin=${sku}`;

    const response = await axios.get(apiUrl, {
      timeout: config?.timeout || DEFAULT_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    const data = response.data;
    const product = data?.data?.product;

    if (!product) {
      return createEmptyResult();
    }

    const currentPrice = parsePrice(
      product.price?.current_retail || 
      product.price?.reg_retail
    );

    const productUrl = product.item?.enrichment?.buy_url || 
                       `${BASE_URL}/p/-/A-${sku}`;

    const isInStock = product.available_to_promise_network?.availability_status === 'IN_STOCK';

    console.log(`✅ Target: Found SKU ${sku} at $${currentPrice?.toFixed(2)}`);

    return {
      price: currentPrice,
      url: isValidUrl(productUrl) ? productUrl : null,
      stock: isInStock,
      retailer: 'Target',
      title: product.item?.product_description?.title || null,
      image: product.item?.enrichment?.images?.primary_image_url || null,
    };
  } catch (error) {
    console.error('Target SKU lookup error:', error);
    return createEmptyResult();
  }
}

function createEmptyResult(): PriceResult {
  return {
    price: null,
    url: null,
    stock: null,
    retailer: 'Target',
    title: null,
    image: null,
  };
}

