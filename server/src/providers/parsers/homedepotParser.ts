import * as cheerio from "cheerio";

export interface ParsedRetailerResult {
  retailer: string;
  title: string | null;
  price: number | null;
  url: string | null;
  image: string | null;
  stock: boolean | null;
}

export function parseHomeDepotHtml(html: string): ParsedRetailerResult {
  try {
    const $ = cheerio.load(html);

    // Home Depot uses multiple possible data structures:
    // 1. __NEXT_DATA__ (Next.js)
    // 2. window.__APOLLO_STATE__ (Apollo GraphQL cache)
    // 3. window.__app__ (legacy)

    // Try __NEXT_DATA__ first (most common for modern Home Depot)
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
          pageProps?.searchResults?.products?.[0] ||
          pageProps?.data?.products?.[0] ||
          pageProps?.products?.[0] ||
          pageProps?.product ||
          null;

        if (products) {
          const product = products;
          const price = 
            product?.pricing?.value ||
            product?.pricing?.specialValue ||
            product?.price ||
            null;

          const title = 
            product?.identifiers?.productLabel ||
            product?.title ||
            product?.name ||
            null;

          const url = 
            product?.identifiers?.canonicalUrl
              ? `https://www.homedepot.com${product.identifiers.canonicalUrl}`
              : product?.url
              ? (product.url.startsWith('http') ? product.url : `https://www.homedepot.com${product.url}`)
              : null;

          const image = 
            product?.media?.images?.[0]?.url ||
            product?.image ||
            product?.images?.[0] ||
            null;

          const stock = 
            product?.availabilityType?.type === 'AVAILABLE' ||
            product?.fulfillment?.fulfillmentOptions?.some((opt: any) => opt.available) ||
            product?.inStock ||
            false;

          return {
            retailer: "Home Depot",
            title,
            price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
            url,
            image,
            stock
          };
        }
      } catch (e) {
        console.log('Home Depot: Failed to parse __NEXT_DATA__:', e);
      }
    }

    // Try window.__APOLLO_STATE__ (Apollo GraphQL cache)
    const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*({.*?});?\s*<\/script>/s);
    if (apolloMatch && apolloMatch[1]) {
      try {
        const apolloState = JSON.parse(apolloMatch[1]);
        const products = Object.values(apolloState).filter((item: any) =>
          item?.__typename === 'Product' && item?.pricing
        );

        if (products.length > 0) {
          const product: any = products[0];
          const price = product.pricing?.value || null;

          return {
            retailer: "Home Depot",
            price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
            url: product.identifiers?.canonicalUrl
              ? `https://www.homedepot.com${product.identifiers.canonicalUrl}`
              : null,
            title: product.identifiers?.productLabel || null,
            stock: product.availabilityType?.type === 'AVAILABLE',
            image: product.media?.images?.[0]?.url || null,
          };
        }
      } catch (e) {
        console.log('Home Depot: Failed to parse __APOLLO_STATE__:', e);
      }
    }

    // Try window.__app__ (legacy)
    const appMatch = html.match(/window\.__app__\s*=\s*({.*?});/s);
    if (appMatch && appMatch[1]) {
      try {
        const appData = JSON.parse(appMatch[1]);
        const searchResults = appData?.pageData?.searchReport;
        const products = searchResults?.products || [];

        if (products.length > 0) {
          const product = products[0];
          const price = product.pricing?.value || product.pricing?.specialValue || null;

          return {
            retailer: "Home Depot",
            price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
            url: product.canonicalUrl
              ? (product.canonicalUrl.startsWith('http') ? product.canonicalUrl : `https://www.homedepot.com${product.canonicalUrl}`)
              : null,
            title: product.identifiers?.productLabel || product.title || null,
            stock: product.availabilityType?.type === 'AVAILABLE',
            image: product.media?.images?.[0]?.url || null,
          };
        }
      } catch (e) {
        console.log('Home Depot: Failed to parse __app__:', e);
      }
    }

    console.log('Home Depot: No product data found in any known structure');
    return {
      retailer: "Home Depot",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  } catch (err) {
    console.error('Home Depot parser error:', err);
    return {
      retailer: "Home Depot",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  }
}

