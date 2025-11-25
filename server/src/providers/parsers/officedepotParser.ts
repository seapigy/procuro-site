import * as cheerio from "cheerio";

export interface ParsedRetailerResult {
  retailer: string;
  title: string | null;
  price: number | null;
  url: string | null;
  image: string | null;
  stock: boolean | null;
}

export function parseOfficeDepotHtml(html: string): ParsedRetailerResult {
  try {
    const $ = cheerio.load(html);

    // Office Depot uses multiple possible data structures:
    // 1. window.__APP_STATE__ (legacy)
    // 2. Embedded JSON in script tags
    // 3. React component data

    // Try window.__APP_STATE__ first
    const appStateMatch = html.match(/window\.__APP_STATE__\s*=\s*({.*?});?\s*<\/script>/s);
    if (appStateMatch && appStateMatch[1]) {
      try {
        const appState = JSON.parse(appStateMatch[1]);
        
        // Try to find products in search results
        if (appState?.search?.results && Array.isArray(appState.search.results) && appState.search.results.length > 0) {
          // Find the first actual product (skip promotional items)
          let product = null;
          for (const item of appState.search.results) {
            // Skip items that are not actual products (promotions, banners, etc.)
            if (item.sku || item.productId || (item.pricing && item.name && !item.name.toLowerCase().includes('pickup'))) {
              product = item;
              break;
            }
          }
          
          if (!product && appState.search.results.length > 0) {
            product = appState.search.results[0];
          }

          if (product) {
            const price = 
              product.pricing?.salePrice || 
              product.pricing?.listPrice || 
              product.pricing?.price ||
              product.price ||
              null;

            const title = 
              product.name || 
              product.title || 
              product.productName ||
              null;

            // Stock status - try multiple fields
            const stock = 
              product.inventory?.available === true ||
              product.inventory?.inStock === true ||
              product.availability === 'IN_STOCK' ||
              product.inStock === true ||
              product.availabilityStatus === 'IN_STOCK' ||
              (product.inventory?.status && product.inventory.status.toLowerCase().includes('stock')) ||
              false;

            console.log('Office Depot: Found product in __APP_STATE__:', { 
              title, 
              price, 
              stock,
              hasSku: !!product.sku,
              pricingKeys: product.pricing ? Object.keys(product.pricing) : []
            });

            return {
              retailer: "Office Depot",
              price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
              url: product.url
                ? (product.url.startsWith('http') ? product.url : `https://www.officedepot.com${product.url}`)
                : product.productUrl
                ? (product.productUrl.startsWith('http') ? product.productUrl : `https://www.officedepot.com${product.productUrl}`)
                : null,
              title,
              stock,
              image: product.images?.[0]?.url || product.image || product.imageUrl || null,
            };
          }
        }
      } catch (e) {
        console.log('Office Depot: Failed to parse __APP_STATE__:', e);
      }
    }

    // Try to find product data in script tags with JSON
    const scriptTags = $('script[type="application/json"]');
    for (let i = 0; i < scriptTags.length; i++) {
      try {
        const scriptContent = $(scriptTags[i]).html();
        if (scriptContent) {
          const json = JSON.parse(scriptContent);
          
          // Look for product data in various structures
          if (json?.search?.results && Array.isArray(json.search.results) && json.search.results.length > 0) {
            // Find the first actual product (skip promotional items)
            let product = null;
            for (const item of json.search.results) {
              if (item.sku || item.productId || (item.pricing && item.name && !item.name.toLowerCase().includes('pickup'))) {
                product = item;
                break;
              }
            }
            
            if (!product && json.search.results.length > 0) {
              product = json.search.results[0];
            }

            if (product) {
              const price = 
                product.pricing?.salePrice || 
                product.pricing?.listPrice || 
                product.pricing?.price ||
                product.price ||
                null;

              const title = 
                product.name || 
                product.title || 
                product.productName ||
                null;

              const stock = 
                product.inventory?.available === true ||
                product.inventory?.inStock === true ||
                product.availability === 'IN_STOCK' ||
                product.inStock === true ||
                product.availabilityStatus === 'IN_STOCK' ||
                (product.inventory?.status && product.inventory.status.toLowerCase().includes('stock')) ||
                false;

              return {
                retailer: "Office Depot",
                price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
                url: product.url
                  ? (product.url.startsWith('http') ? product.url : `https://www.officedepot.com${product.url}`)
                  : product.productUrl
                  ? (product.productUrl.startsWith('http') ? product.productUrl : `https://www.officedepot.com${product.productUrl}`)
                  : null,
                title,
                stock,
                image: product.images?.[0]?.url || product.image || product.imageUrl || null,
              };
            }
          }

          // Try other possible structures
          if (json?.products && Array.isArray(json.products) && json.products.length > 0) {
            const product = json.products[0];
            const price = product.pricing?.salePrice || product.pricing?.listPrice || product.price || null;

            return {
              retailer: "Office Depot",
              price: price ? parseFloat(String(price).replace(/[$,]/g, '')) : null,
              url: product.url
                ? (product.url.startsWith('http') ? product.url : `https://www.officedepot.com${product.url}`)
                : null,
              title: product.name || product.title || null,
              stock: product.inventory?.available === true || product.availability === 'IN_STOCK',
              image: product.images?.[0]?.url || product.image || null,
            };
          }
        }
      } catch (e) {
        // Continue to next script tag
      }
    }

    // Try to find product cards in HTML (fallback)
    const productCards = $('[data-product-id], .product-card, [class*="ProductCard"], [class*="product-item"]');
    if (productCards.length > 0) {
      const firstCard = productCards.first();
      const title = firstCard.find('[data-product-name], h2, h3, [class*="title"], [class*="name"]').first().text().trim();
      const priceText = firstCard.find('[data-price], [class*="price"], [class*="Price"]').first().text().trim();
      const link = firstCard.find('a').first().attr('href');
      const image = firstCard.find('img').first().attr('src') || firstCard.find('img').first().attr('data-src');

      if (title && priceText) {
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        const url = link ? (link.startsWith('http') ? link : `https://www.officedepot.com${link}`) : null;

        return {
          retailer: "Office Depot",
          title: title || null,
          price: isNaN(price) ? null : price,
          url,
          image: image || null,
          stock: null // Can't determine stock from HTML cards
        };
      }
    }

    console.log('Office Depot: No product data found in any known structure');
    return {
      retailer: "Office Depot",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  } catch (err) {
    console.error('Office Depot parser error:', err);
    return {
      retailer: "Office Depot",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  }
}

