// STAPLES PROVIDER - PARKED / DISABLED
// ====================================
// STATUS: OFFICIALLY PARKED - NOT FUNCTIONAL
// 
// This provider has been officially parked because:
// 1. Staples requires official API access and agreement
// 2. All scraping attempts (HTML, API endpoints, Puppeteer) return 404
// 3. Staples appears to have strong bot protection blocking all programmatic access
// 4. Cannot be used without official partnership/API agreement with Staples
//
// This provider is NOT used for matching and will NOT be enabled until:
// - Official API access is obtained from Staples
// - Partnership agreement is in place
// - Proper authentication/credentials are configured
//
// DO NOT ATTEMPT TO USE THIS PROVIDER - IT WILL NOT WORK
// ====================================

import fetch from 'node-fetch';
import { fetchHtmlWithRetries } from '../utils/fetchHtml';
import * as cheerio from 'cheerio';

// Try to import Puppeteer for headless browser support
let puppeteer: any = null;
try {
  puppeteer = require('puppeteer');
  console.log('✅ Puppeteer loaded successfully');
} catch (e: any) {
  console.log('⚠️ Puppeteer not available, will use fallback methods');
  console.log(`⚠️ Puppeteer error: ${e?.message || e}`);
}

export async function staplesSearch(keyword: string) {
  // OFFICIALLY PARKED - Return error immediately
  return {
    success: false,
    retailer: 'staples',
    items: [],
    error: 'Staples provider is officially parked. Cannot be used without official API access and agreement with Staples. All scraping attempts are blocked.',
  };
}

// Legacy code below - kept for reference but not executed
// ======================================================

async function extractFromHtml(html: string): Promise<Array<{
  title: string;
  price: number;
  url: string;
  image: string;
  retailer: string;
}>> {
  const items: Array<{
    title: string;
    price: number;
    url: string;
    image: string;
    retailer: string;
  }> = [];

  try {
    // Parse HTML with cheerio
    const $ = cheerio.load(html);
    
    // Look for product containers
    const productSelectors = [
      '[data-product-id]',
      '[data-sku]',
      '.product',
      '.product-item',
      '.product-card',
      '.search-result-item',
      '[class*="product"]',
      '[class*="Product"]',
    ];

    for (const selector of productSelectors) {
      const products = $(selector);
      if (products.length > 0) {
        products.each((_, el) => {
          try {
            const $el = $(el);
            
            const title = 
              $el.find('[data-product-name], .product-name, .product-title, h2, h3').first().text().trim() ||
              $el.attr('data-product-name') ||
              $el.attr('title') ||
              '';

            if (!title) return;

            const priceText = 
              $el.find('[data-price], .price, .product-price').first().text() ||
              $el.attr('data-price') ||
              '';
            
            const priceMatch = priceText.match(/[\d,]+\.?\d*/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;
            if (!price || price <= 0) return;

            const urlPath = 
              $el.find('a').first().attr('href') ||
              $el.attr('data-url') ||
              $el.attr('href') ||
              '';
            
            const url = urlPath 
              ? (urlPath.startsWith('http') ? urlPath : `https://www.staples.com${urlPath.startsWith('/') ? '' : '/'}${urlPath}`)
              : '';

            const image = 
              $el.find('img').first().attr('src') ||
              $el.find('img').first().attr('data-src') ||
              $el.attr('data-image') ||
              '';

            if (title && price > 0) {
              items.push({
                title,
                price,
                url,
                image,
                retailer: 'Staples',
              });
            }
          } catch (itemErr) {
            // Skip invalid items
          }
        });

        if (items.length > 0) {
          return items;
        }
      }
    }
  } catch (err) {
    return items;
  }

  return items;
}

function extractStaplesItems(data: any): Array<{
  title: string;
  price: number;
  url: string;
  image: string;
  retailer: string;
}> {
  const items: Array<{
    title: string;
    price: number;
    url: string;
    image: string;
    retailer: string;
  }> = [];

  try {
    let products: any[] = [];
    
    if (data?.products && Array.isArray(data.products)) {
      products = data.products;
    } else if (data?.data?.products && Array.isArray(data.data.products)) {
      products = data.data.products;
    } else if (data?.results?.products && Array.isArray(data.results.products)) {
      products = data.results.products;
    } else if (data?.searchResults?.products && Array.isArray(data.searchResults.products)) {
      products = data.searchResults.products;
    } else if (data?.props?.pageProps?.products && Array.isArray(data.props.pageProps.products)) {
      products = data.props.pageProps.products;
    } else if (data?.props?.pageProps?.searchResults?.products && Array.isArray(data.props.pageProps.searchResults.products)) {
      products = data.props.pageProps.searchResults.products;
    } else if (data?.props?.pageProps?.data?.products && Array.isArray(data.props.pageProps.data.products)) {
      products = data.props.pageProps.data.products;
    } else if (data?.search?.products && Array.isArray(data.search.products)) {
      products = data.search.products;
    } else if (Array.isArray(data)) {
      products = data;
    }

    if (!Array.isArray(products) || products.length === 0) {
      return items;
    }

    for (const product of products) {
      try {
        const title = 
          product.title ||
          product.productTitle ||
          product.name ||
          product.productName ||
          product.displayName ||
          (product.productInfo?.productTitle) ||
          '';

        if (!title) {
          continue;
        }

        let price = 0;
        const priceValue = 
          product.salePrice ||
          product.regularPrice ||
          product.price ||
          product.finalPrice ||
          product.currentPrice ||
          (product.pricing?.salePrice) ||
          (product.pricing?.regularPrice) ||
          (product.pricing?.currentPrice) ||
          (product.priceInfo?.finalPrice) ||
          (product.priceInfo?.salePrice) ||
          (product.productInfo?.price?.finalPrice) ||
          null;

        if (priceValue !== null && priceValue !== undefined) {
          const parsed = typeof priceValue === 'string' 
            ? parseFloat(priceValue.replace(/[^0-9.]/g, ''))
            : parseFloat(String(priceValue));
          if (!isNaN(parsed) && parsed > 0) {
            price = parsed;
          } else {
            continue;
          }
        } else {
          continue;
        }

        const urlPath = 
          product.productUrl ||
          product.url ||
          product.link ||
          product.href ||
          product.canonicalUrl ||
          (product.productInfo?.productUrl) ||
          '';
        
        let url = '';
        if (urlPath) {
          if (urlPath.startsWith('http')) {
            url = urlPath;
          } else {
            const cleanPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
            url = `https://www.staples.com${cleanPath}`;
          }
        }

        const image = 
          product.imageUrl ||
          product.image ||
          product.thumbnail ||
          product.thumbnailUrl ||
          product.img ||
          (product.images && product.images[0]?.url) ||
          (product.productInfo?.imageUrl) ||
          '';

        items.push({
          title: title.trim(),
          price,
          url,
          image,
          retailer: 'Staples',
        });
      } catch (itemErr) {
        continue;
      }
    }
  } catch (err) {
    return items;
  }

  return items;
}
