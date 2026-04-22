import * as cheerio from "cheerio";

export interface ParsedRetailerResult {
  retailer: string;
  title: string | null;
  price: number | null;
  url: string | null;
  image: string | null;
  stock: boolean | null;
}

export function parseTargetHtml(html: string): ParsedRetailerResult {
  try {
    const $ = cheerio.load(html);

    // Target's HTML doesn't contain product data in __NEXT_DATA__ - it loads dynamically
    // But let's check if there are any product cards with data attributes we can parse
    console.log('Target: Searching HTML for product data...');
    
    // Try to find product cards by common Target selectors
    const productCards = $('[data-test="product-card"], [data-testid*="product"], .product-card, [class*="ProductCard"]');
    console.log(`Target: Found ${productCards.length} potential product cards`);
    
    if (productCards.length > 0) {
      const firstCard = productCards.first();
      const title = firstCard.find('[data-test="product-title"], h2, h3, [class*="title"]').first().text().trim();
      const priceText = firstCard.find('[data-test="product-price"], [class*="price"], [class*="Price"]').first().text().trim();
      const link = firstCard.find('a').first().attr('href');
      const image = firstCard.find('img').first().attr('src') || firstCard.find('img').first().attr('data-src');
      
      if (title && priceText) {
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        const url = link ? (link.startsWith('http') ? link : `https://www.target.com${link}`) : null;
        
        console.log('Target: Found product from HTML cards:', { title, price, url });
        
        return {
          retailer: "Target",
          title: title || null,
          price: isNaN(price) ? null : price,
          url,
          image: image || null,
          stock: null // Can't determine stock from HTML cards
        };
      }
    }
    
    // Fallback: Try __NEXT_DATA__ (though it likely won't have product data)
    let nextDataScript = $("#__NEXT_DATA__").html();
    
    if (!nextDataScript) {
      const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>(.*?)<\/script>/s);
      if (nextDataMatch && nextDataMatch[1]) {
        nextDataScript = nextDataMatch[1];
      }
    }
    
    if (nextDataScript) {
      console.log('Target: Found __NEXT_DATA__, but it likely doesn\'t contain product data (loaded dynamically)');
      const json = JSON.parse(nextDataScript);
      const pageProps = json?.props?.pageProps || {};
      
      // Even though product data isn't here, log what we find for debugging
      console.log('Target: pageProps keys:', Object.keys(pageProps));
    }

    console.log('Target: No product data found in HTML (Target loads products dynamically via API)');
    return {
      retailer: "Target",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  } catch (err) {
    console.error('Target parser error:', err);
    console.error('Target parser error stack:', err instanceof Error ? err.stack : 'No stack');
    return {
      retailer: "Target",
      title: null,
      price: null,
      url: null,
      image: null,
      stock: null
    };
  }
}

