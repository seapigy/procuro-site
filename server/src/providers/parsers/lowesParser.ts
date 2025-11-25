import * as cheerio from "cheerio";

export interface ParsedRetailerResult {
  retailer: string;
  title: string | null;
  price: number | null;
  url: string | null;
  image: string | null;
  stock: boolean | null;
}

export function parseLowesHtml(html: string): ParsedRetailerResult {
  try {
    const $ = cheerio.load(html);

    // Lowe's uses multiple possible data structures:
    // 1. __NEXT_DATA__ (Next.js - modern)
    // 2. window.__PRELOADED_STATE__ (legacy)

    // Try __NEXT_DATA__ first (most common for modern Lowe's)
    let nextDataScript = $("#__NEXT_DATA__").html();
    
    if (!nextDataScript) {
      const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>(.*?)<\/script>/s);
      if (nextDataMatch && nextDataMatch[1]) {
        nextDataScript = nextDataMatch[1];
      }
    }

    if (nextDataScript) {
      try {
        const json = JSON.parse(nextDataScript);
        const pageProps = json?.props?.pageProps || {};
        
        // Try to find products in various locations
        const products = 
          pageProps?.data?.products?.[0] ||
          pageProps?.searchResults?.products?.[0] ||
          pageProps?.products?.[0] ||
          pageProps?.product ||
          null;

        if (products) {
          const product = products;
          const price = 
            product?.pricing?.sellingPrice ||
            product?.pricing?.originalPrice ||
            product?.pricing?.value ||
            product?.price ||
            null;

          const title = 
            product?.title ||
            product?.name ||
            product?.productName ||
            null;

          const url = 
            product?.url
              ? (product.url.startsWith('http') ? product.url : `https://www.lowes.com${product.url}`)
              : product?.productUrl
              ? (product.productUrl.startsWith('http') ? product.productUrl : `https://www.lowes.com${product.productUrl}`)
              : null;

          const image = 
            product?.imageUrl ||
            product?.image?.url ||
            product?.images?.[0]?.url ||
            product?.media?.images?.[0]?.url ||
            null;

          const stock = 
            product?.availability?.status === 'In Stock' ||
            product?.availabilityStatus === 'IN_STOCK' ||
            product?.inStock ||
            false;

          return {
            retailer: "Lowes",
            title,
            price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
            url,
            image,
            stock
          };
        }
      } catch (e) {
        console.log('Lowes: Failed to parse __NEXT_DATA__:', e);
      }
    }

    // Try window.__PRELOADED_STATE__ (legacy)
    const preloadedMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});/s);
    if (preloadedMatch && preloadedMatch[1]) {
      try {
        const preloadedState = JSON.parse(preloadedMatch[1]);
        
        // Try search results
        const searchModel = preloadedState?.searchModel;
        if (searchModel?.productList && searchModel.productList.length > 0) {
          const product = searchModel.productList[0];
          const price = product.pricing?.value || product.pricing?.sellPrice || product.pricing?.regularPrice || null;

          return {
            retailer: "Lowes",
            price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
            url: product.url ? `https://www.lowes.com${product.url}` : null,
            title: product.title || product.name || null,
            stock: product.availability?.status === 'In Stock',
            image: product.imageUrl || product.image || null,
          };
        }

        // Try product details
        const productDetails = preloadedState?.productDetails;
        if (productDetails) {
          const price = productDetails.pricing?.value || productDetails.pricing?.sellPrice || productDetails.pricing?.regularPrice || null;

          return {
            retailer: "Lowes",
            price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
            url: null, // Product details page doesn't have URL in state
            title: productDetails.title || productDetails.name || null,
            stock: productDetails.availability?.status === 'In Stock' || productDetails.availabilityStatus === 'IN_STOCK',
            image: productDetails.imageUrl || productDetails.image || null,
          };
        }
      } catch (e) {
        console.log('Lowes: Failed to parse __PRELOADED_STATE__:', e);
      }
    }

    console.log('Lowes: No product data found in any known structure');
    return {
      retailer: "Lowes",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  } catch (err) {
    console.error('Lowes parser error:', err);
    return {
      retailer: "Lowes",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  }
}

