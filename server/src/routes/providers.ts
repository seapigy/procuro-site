/**
 * Backend Provider Routes
 * Proxies retailer requests to avoid CORS issues
 */

import { Router, Request, Response } from 'express';
import { fetchHtmlWithRetries, extractJsonFromHtml, parsePrice } from '../utils/fetchHtml';
import { parseWalmartHtml } from '../providers/parsers/walmartParser';
import { parseTargetHtml } from '../providers/parsers/targetParser';
import { parseHomeDepotHtml } from '../providers/parsers/homedepotParser';
import { parseLowesHtml } from '../providers/parsers/lowesParser';
import { parseOfficeDepotHtml } from '../providers/parsers/officedepotParser';

const router = Router();

/**
 * Walmart Provider - Backend Proxy
 */
router.get('/walmart', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid keyword parameter',
        retailer: 'Walmart',
      });
    }

    console.log(`🛒 Walmart Provider: Searching for "${keyword}"`);

    const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(keyword)}`;
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl);

    if (error) {
      return res.json({
        success: false,
        error,
        retailer: 'Walmart',
        url: searchUrl,
      });
    }

    // Use new __NEXT_DATA__ parser
    const parsed = parseWalmartHtml(html);

    if (parsed.price && parsed.title) {
      console.log(`✅ Walmart: Found "${parsed.title}" at $${parsed.price?.toFixed(2)}`);
    } else {
      console.log(`⚠️ Walmart: Could not parse product data from HTML`);
    }

    res.json({
      success: true,
      html,
      retailer: 'Walmart',
      url: finalUrl,
      parsed: parsed.price ? parsed : null,
    });
  } catch (error: any) {
    console.error('❌ Walmart provider error:', error);
    res.json({
      success: false,
      error: error.message || 'Internal server error',
      retailer: 'Walmart',
    });
  }
});

/**
 * Target Provider - Backend Proxy (uses HTML scraping - RedSky API not working)
 */
router.get('/target', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid keyword parameter',
        retailer: 'Target',
      });
    }

    console.log(`🎯 Target Provider: Searching for "${keyword}" via HTML scraping`);

    const searchUrl = `https://www.target.com/s?searchTerm=${encodeURIComponent(keyword)}`;
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl);

    if (error) {
      return res.json({
        success: false,
        error,
        retailer: 'Target',
        url: searchUrl,
      });
    }

    // Target's HTML doesn't contain product data - it loads dynamically via JavaScript/API
    // Try to parse what we can from HTML, but it likely won't have product data
    console.log(`🎯 Target: HTML received, length: ${html.length}`);
    
    const parsed = parseTargetHtml(html);

    if (parsed.price && parsed.title) {
      console.log(`✅ Target: Found "${parsed.title}" at $${parsed.price?.toFixed(2)}`);
    } else {
      console.log(`⚠️ Target: Could not parse product data from HTML`);
      console.log(`⚠️ Target: Target loads product data dynamically via JavaScript/API calls`);
      console.log(`⚠️ Target: HTML scraping won't work - need to use RedSky API or headless browser`);
    }

    res.json({
      success: true,
      html,
      retailer: 'Target',
      url: finalUrl,
      parsed: parsed.price && parsed.title ? parsed : null,
    });
  } catch (error: any) {
    console.error('❌ Target provider error:', error);
    console.error('Error stack:', error?.stack);
    res.json({
      success: false,
      error: error?.message || 'Internal server error',
      retailer: 'Target',
      parsed: null,
    });
  }
});

/**
 * Home Depot Provider - Backend Proxy
 */
router.get('/homedepot', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid keyword parameter',
        retailer: 'Home Depot',
      });
    }

    console.log(`🏠 Home Depot Provider: Searching for "${keyword}"`);

    const searchUrl = `https://www.homedepot.com/s/${encodeURIComponent(keyword)}`;
    
    // Home Depot has aggressive bot detection - use enhanced headers
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl, {
      maxRetries: 3,
      timeout: 15000,
      headers: {
        'Referer': 'https://www.homedepot.com/',
        'Origin': 'https://www.homedepot.com',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'DNT': '1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      },
    });

    if (error) {
      return res.json({
        success: false,
        error,
        retailer: 'Home Depot',
        url: searchUrl,
      });
    }

    // Check if Home Depot returned an error page (bot detection)
    if (html.includes('Oops!! Something went wrong') || html.includes('Error Page')) {
      console.log(`⚠️ Home Depot: Bot detection triggered - received error page`);
      return res.json({
        success: false,
        error: 'Home Depot bot detection triggered. Please try again later or use a different provider.',
        retailer: 'Home Depot',
        url: searchUrl,
        parsed: null,
      });
    }

    // Use dedicated Home Depot parser
    const parsed = parseHomeDepotHtml(html);

    if (parsed.price && parsed.title) {
      console.log(`✅ Home Depot: Found "${parsed.title}" at $${parsed.price?.toFixed(2)}`);
    } else {
      console.log(`⚠️ Home Depot: Could not parse product data from HTML`);
    }

    res.json({
      success: true,
      html,
      retailer: 'Home Depot',
      url: finalUrl,
      parsed: parsed.price ? parsed : null,
    });
  } catch (error: any) {
    console.error('❌ Home Depot provider error:', error);
    res.json({
      success: false,
      error: error.message || 'Internal server error',
      retailer: 'Home Depot',
    });
  }
});

/**
 * Lowes Provider - Backend Proxy
 */
router.get('/lowes', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid keyword parameter',
        retailer: 'Lowes',
      });
    }

    console.log(`🔨 Lowes Provider: Searching for "${keyword}"`);

    const searchUrl = `https://www.lowes.com/search?searchTerm=${encodeURIComponent(keyword)}`;
    
    // Lowes may have bot detection - use enhanced headers
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl, {
      maxRetries: 3,
      timeout: 15000,
      headers: {
        'Referer': 'https://www.lowes.com/',
        'Origin': 'https://www.lowes.com',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'DNT': '1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      },
    });

    if (error) {
      // Check if it's a 403 Forbidden (bot detection)
      if (error.includes('403') || error.includes('Forbidden')) {
        return res.json({
          success: false,
          error: 'Lowes bot detection triggered (403 Forbidden). Please try again later or use a different provider.',
          retailer: 'Lowes',
          url: searchUrl,
          parsed: null,
        });
      }
      return res.json({
        success: false,
        error,
        retailer: 'Lowes',
        url: searchUrl,
      });
    }

    // Use dedicated Lowes parser
    const parsed = parseLowesHtml(html);

    if (parsed.price && parsed.title) {
      console.log(`✅ Lowes: Found "${parsed.title}" at $${parsed.price?.toFixed(2)}`);
    } else {
      console.log(`⚠️ Lowes: Could not parse product data from HTML`);
    }

    res.json({
      success: true,
      html,
      retailer: 'Lowes',
      url: finalUrl,
      parsed: parsed.price ? parsed : null,
    });
  } catch (error: any) {
    console.error('❌ Lowes provider error:', error);
    res.json({
      success: false,
      error: error.message || 'Internal server error',
      retailer: 'Lowes',
    });
  }
});

/**
 * Staples Provider - Backend Proxy
 */
router.get('/staples', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid keyword parameter',
        retailer: 'Staples',
      });
    }

    console.log(`📎 Staples Provider: Searching for "${keyword}"`);

    // Try multiple Staples search URL patterns
    const searchUrl = `https://www.staples.com/s/${encodeURIComponent(keyword)}`;
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl, {
      maxRetries: 3,
      timeout: 15000,
      headers: {
        'Referer': 'https://www.staples.com/',
        'Origin': 'https://www.staples.com',
      },
    });

    if (error) {
      // Check if it's a 404 (URL might be wrong)
      if (error.includes('404') || error.includes('Not Found')) {
        return res.json({
          success: false,
          error: 'Staples search URL returned 404. The search URL pattern may have changed.',
          retailer: 'Staples',
          url: searchUrl,
          parsed: null,
        });
      }
      return res.json({
        success: false,
        error,
        retailer: 'Staples',
        url: searchUrl,
      });
    }

    // Extract window.__PRELOADED_STATE__ JSON
    const pattern = /window\.__PRELOADED_STATE__\s*=\s*({.*?});?\s*<\/script>/s;
    const data = extractJsonFromHtml(html, pattern);

    let parsedResult = null;

    if (data && data.search && data.search.products) {
      const products = data.search.products;

      if (products.length > 0) {
        const product = products[0];

        parsedResult = {
          retailer: 'Staples',
          price: product.finalPrice ? parsePrice(product.finalPrice) : null,
          url: product.productURL
            ? `https://www.staples.com${product.productURL}`
            : null,
          title: product.name || null,
          stock: product.inventory?.status === 'IN_STOCK',
          image: product.image || null,
        };

        console.log(`✅ Staples: Found "${parsedResult.title}" at $${parsedResult.price?.toFixed(2)}`);
      }
    }

    res.json({
      success: true,
      html,
      retailer: 'Staples',
      url: finalUrl,
      parsed: parsedResult,
    });
  } catch (error: any) {
    console.error('❌ Staples provider error:', error);
    res.json({
      success: false,
      error: error.message || 'Internal server error',
      retailer: 'Staples',
    });
  }
});

/**
 * Office Depot Provider - Backend Proxy
 */
router.get('/officedepot', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid keyword parameter',
        retailer: 'Office Depot',
      });
    }

    console.log(`🖊️ Office Depot Provider: Searching for "${keyword}"`);

    // Office Depot search URL
    const searchUrl = `https://www.officedepot.com/catalog/search.do?Ntt=${encodeURIComponent(keyword)}`;
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl, {
      maxRetries: 3,
      timeout: 15000,
      headers: {
        'Referer': 'https://www.officedepot.com/',
        'Origin': 'https://www.officedepot.com',
      },
    });

    if (error) {
      // Check if it's a 404 (URL might be wrong)
      if (error.includes('404') || error.includes('Not Found')) {
        return res.json({
          success: false,
          error: 'Office Depot search URL returned 404. The search URL pattern may have changed.',
          retailer: 'Office Depot',
          url: searchUrl,
          parsed: null,
        });
      }
      return res.json({
        success: false,
        error,
        retailer: 'Office Depot',
        url: searchUrl,
      });
    }

    // Use dedicated Office Depot parser
    const parsed = parseOfficeDepotHtml(html);

    if (parsed.price && parsed.title) {
      console.log(`✅ Office Depot: Found "${parsed.title}" at $${parsed.price?.toFixed(2)}`);
    } else {
      console.log(`⚠️ Office Depot: Could not parse product data from HTML`);
    }

    res.json({
      success: true,
      html,
      retailer: 'Office Depot',
      url: finalUrl,
      parsed: parsed.price ? parsed : null,
    });
  } catch (error: any) {
    console.error('❌ Office Depot provider error:', error);
    res.json({
      success: false,
      error: error.message || 'Internal server error',
      retailer: 'Office Depot',
    });
  }
});

export default router;



