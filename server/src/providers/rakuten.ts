// RAKUTEN PROVIDER (STANDBY MODE)
// This provider is NOT used for matching until explicitly enabled.

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const ACCESS_TOKEN = process.env.RAKUTEN_ACCESS_TOKEN || '';
const RAKUTEN_DEBUG = process.env.RAKUTEN_DEBUG === 'true';

export async function rakutenSearch(keyword: string) {
  try {
    if (!ACCESS_TOKEN) {
      return { success: false, retailer: 'rakuten', error: 'Missing access token' };
    }

    const url = `https://productsearch.linksynergy.com/productsearch?keyword=${encodeURIComponent(keyword)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        Accept: 'application/json, application/xml, text/xml',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      
      if (RAKUTEN_DEBUG) {
        console.log(`[RakutenDebug] URL=${url}`);
        console.log(`[RakutenDebug] Status=${res.status} ${res.statusText}`);
        console.log(`[RakutenDebug] BodyPreview=${errorText.substring(0, 500)}`);
      }
      
      return { 
        success: false, 
        retailer: 'rakuten', 
        error: `API error: ${res.status} ${res.statusText} - ${errorText.substring(0, 200)}` 
      };
    }

    const responseText = await res.text();
    
    if (RAKUTEN_DEBUG) {
      console.log(`[RakutenDebug] URL=${url}`);
      console.log(`[RakutenDebug] Status=${res.status} ${res.statusText}`);
      console.log(`[RakutenDebug] BodyPreview=${responseText.substring(0, 500)}`);
    }
    
    // Try to parse as JSON first
    let products: any[] = [];
    try {
      const json = JSON.parse(responseText);
      if (json.products && Array.isArray(json.products)) {
        products = json.products;
      }
    } catch {
      // If JSON parsing fails, try XML parsing
      try {
        const $ = cheerio.load(responseText, { xmlMode: true });
        // Parse XML structure - adjust selectors based on actual XML format
        $('product, item').each((_, elem) => {
          const $elem = $(elem);
          products.push({
            productName: $elem.find('productName, name, title').first().text() || $elem.attr('name'),
            price: $elem.find('price, amount').first().text() || $elem.attr('price'),
            clickUrl: $elem.find('clickUrl, url, link').first().text() || $elem.attr('url'),
            imageUrl: $elem.find('imageUrl, image, img').first().text() || $elem.attr('image'),
          });
        });
      } catch (xmlErr: any) {
        return { 
          success: false, 
          retailer: 'rakuten', 
          error: `Failed to parse response: ${xmlErr.message}. Response preview: ${responseText.substring(0, 200)}` 
        };
      }
    }

    if (!products || products.length === 0) {
      return { success: true, retailer: 'rakuten', items: [] };
    }

    const items = products.map((p: any) => ({
      title: p.productName || p.name || p.title || '',
      price: parseFloat(p.price || 0),
      url: p.clickUrl || p.url || p.link || '',
      image: p.imageUrl || p.image || p.img || '',
      retailer: 'Rakuten'
    }));

    return { success: true, retailer: 'rakuten', items };
  } catch (err: any) {
    return { success: false, retailer: 'rakuten', error: err.message };
  }
}

