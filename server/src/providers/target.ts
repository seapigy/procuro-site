/**
 * Target Provider (FREE - uses RedSky API)
 * Target's public RedSky API for product search
 */

import fetch from 'node-fetch';
import { PriceResult, ProviderConfig } from './types';
import { parsePrice } from './utils';

export async function getTargetPrice(keyword: string): Promise<PriceResult> {
  // Target's frontend uses this RedSky API endpoint for search
  // Based on the config found in Target's HTML
  const apiKey = '9f36aeafbe60771e321a7cc95a78140772ab3e96';
  const encodedKeyword = encodeURIComponent(keyword);
  const endpoint = `https://redsky.target.com/redsky_aggregations/v1/web/plp_client_v1?key=${apiKey}&channel=WEB&count=24&default_purchasability_filter=true&include_sponsored=true&keyword=${encodedKeyword}&offset=0&page=%2Fs%2F${encodedKeyword}&platform=desktop&pricing_store_id=3991&scheduled_delivery_store_id=3991&store_ids=3991%2C2047%2C1996%2C3258&useragent=Mozilla%2F5.0&visitor_id=017F8B8A5C5F0201B8B8A5C5F0201`;

  try {
    console.log(`🔵 Target: Calling RedSky API endpoint for keyword: "${keyword}"`);
    
    const res = await fetch(endpoint, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.target.com/",
        "Origin": "https://www.target.com",
      },
    });

    console.log(`🔵 Target: RedSky API response status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`🔴 Target RedSky API returned status ${res.status}: ${res.statusText}`);
      console.error(`🔴 Error response body:`, errorText.substring(0, 500));
      
      // If the API fails, fall back to HTML parsing (which also won't work, but at least we tried)
      return {
        retailer: "Target",
        title: null,
        price: null,
        url: null,
        image: null,
        stock: null,
      };
    }

    const json = await res.json();
    console.log(`🔵 Target: Successfully parsed JSON response`);

    // Log the full response structure for debugging
    console.log('========================================');
    console.log('🎯 TARGET API RESPONSE DEBUG');
    console.log('========================================');
    console.log('Full response (first 2000 chars):', JSON.stringify(json, null, 2).substring(0, 2000));
    console.log('Response keys:', Object.keys(json || {}));
    if (json?.data) {
      console.log('Data keys:', Object.keys(json.data || {}));
      if (json.data?.search) {
        console.log('Search keys:', Object.keys(json.data.search || {}));
      }
    }
    console.log('========================================');

    // Try multiple possible response structures
    const product =
      json?.data?.search?.products?.[0] ??
      json?.data?.search?.product_list?.[0] ??
      json?.data?.products?.[0] ??
      json?.search?.products?.[0] ??
      json?.products?.[0] ??
      json?.data?.product ??
      null;

    if (!product) {
      console.log('Target: No product found in response');
      console.log('Available paths checked:', [
        'json?.data?.search?.products?.[0]',
        'json?.data?.search?.product_list?.[0]',
        'json?.data?.products?.[0]',
        'json?.search?.products?.[0]',
        'json?.products?.[0]',
        'json?.data?.product'
      ]);
      return {
        retailer: "Target",
        title: null,
        price: null,
        url: null,
        image: null,
        stock: null,
      };
    }

    console.log('Target: Found product:', JSON.stringify(product, null, 2).substring(0, 500));

    const tcin = product?.tcin ?? null;

    // Safely extract price - handle both number and string formats
    let price: number | null = null;
    if (product?.price) {
      if (typeof product.price === 'number') {
        price = product.price;
      } else if (product.price.current_retail) {
        price = typeof product.price.current_retail === 'number' 
          ? product.price.current_retail 
          : parsePrice(product.price.current_retail);
      } else if (typeof product.price === 'string') {
        price = parsePrice(product.price);
      }
    }

    // Safely extract title
    const title = product?.item?.product_description?.title ?? 
                  product?.title ?? 
                  product?.item?.title ?? 
                  null;

    // Safely extract image
    const image = product?.images?.primary_image_url ?? 
                  product?.image?.primary_image_url ??
                  product?.item?.enrichment?.images?.primary_image_url ??
                  null;

    // Safely extract stock status
    const stock = product?.availability_status === "IN_STOCK" ||
                  product?.availability?.online?.availability === "IN_STOCK" ||
                  (product?.availability_status && String(product.availability_status).toUpperCase().includes('IN_STOCK')) ||
                  false;

    return {
      retailer: "Target",
      title,
      price,
      url: tcin ? `https://www.target.com/p/${tcin}` : null,
      image,
      stock,
    };
  } catch (error: any) {
    console.error('Target RedSky API error:', error);
    console.error('Error details:', error?.message, error?.stack);
    return {
      retailer: "Target",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null,
    };
  }
}

export async function getPriceByKeyword(keyword: string, config?: ProviderConfig): Promise<PriceResult> {
  console.log(`🔍 Target: Searching for "${keyword}"`);
  return await getTargetPrice(keyword);
}

export async function getPriceBySKU(sku: string, config?: ProviderConfig): Promise<PriceResult> {
  // For SKU lookup, we can use the same function with the SKU as keyword
  // or implement a separate TCIN lookup endpoint if needed
  console.log(`🔍 Target: Looking up SKU "${sku}"`);
  return await getTargetPrice(sku);
}
