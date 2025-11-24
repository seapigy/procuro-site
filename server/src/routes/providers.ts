/**
 * Backend Provider Routes
 * Proxies retailer requests to avoid CORS issues
 */

import { Router, Request, Response } from 'express';
import { fetchHtmlWithRetries, extractJsonFromHtml, parsePrice } from '../utils/fetchHtml';

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

    // Extract embedded JSON
    const pattern = /window\.__WML_REDUX_INITIAL_STATE__\s*=\s*({.*?});?\s*<\/script>/s;
    const data = extractJsonFromHtml(html, pattern);

    let parsedResult = null;

    if (data && data.searchContent && data.searchContent.searchContent) {
      const searchResults = data.searchContent.searchContent;
      const items = searchResults.preso?.items || searchResults.items || [];

      if (items.length > 0) {
        // Find the lowest priced item
        let lowestPrice: number | null = null;
        let bestItem: any = null;

        for (const item of items) {
          if (!item.price || !item.availabilityStatusV2?.display) continue;

          const currentPrice = parsePrice(item.price);
          if (currentPrice && (lowestPrice === null || currentPrice < lowestPrice)) {
            lowestPrice = currentPrice;
            bestItem = item;
          }
        }

        if (bestItem) {
          const productUrl = bestItem.canonicalUrl
            ? `https://www.walmart.com${bestItem.canonicalUrl}`
            : bestItem.productPageUrl || null;

          const isInStock =
            bestItem.availabilityStatusV2?.display === 'In stock' ||
            bestItem.availabilityStatusV2?.value === 'IN_STOCK';

          parsedResult = {
            retailer: 'Walmart',
            price: lowestPrice,
            url: productUrl,
            title: bestItem.name || null,
            stock: isInStock,
            image: bestItem.imageInfo?.thumbnailUrl || bestItem.image || null,
          };

          console.log(`✅ Walmart: Found "${bestItem.name}" at $${lowestPrice?.toFixed(2)}`);
        }
      }
    }

    res.json({
      success: true,
      html,
      retailer: 'Walmart',
      url: finalUrl,
      parsed: parsedResult,
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
 * Target Provider - Backend Proxy
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

    console.log(`🎯 Target Provider: Searching for "${keyword}"`);

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

    // Extract __NEXT_DATA__ JSON
    const pattern = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s;
    const data = extractJsonFromHtml(html, pattern);

    let parsedResult = null;

    if (data && data.props && data.props.pageProps && data.props.pageProps.initialData) {
      const searchData = data.props.pageProps.initialData.searchReport;
      const products = searchData?.products || [];

      if (products.length > 0) {
        const product = products[0];
        const price = product.price?.current_retail || null;
        const productUrl = product.pdpUrl
          ? `https://www.target.com${product.pdpUrl}`
          : null;

        parsedResult = {
          retailer: 'Target',
          price: price ? parsePrice(price) : null,
          url: productUrl,
          title: product.item?.product_description?.title || null,
          stock: product.fulfillment?.is_out_of_stock === false,
          image: product.item?.enrichment?.images?.primary_image_url || null,
        };

        console.log(`✅ Target: Found "${parsedResult.title}" at $${parsedResult.price?.toFixed(2)}`);
      }
    }

    res.json({
      success: true,
      html,
      retailer: 'Target',
      url: finalUrl,
      parsed: parsedResult,
    });
  } catch (error: any) {
    console.error('❌ Target provider error:', error);
    res.json({
      success: false,
      error: error.message || 'Internal server error',
      retailer: 'Target',
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
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl);

    if (error) {
      return res.json({
        success: false,
        error,
        retailer: 'Home Depot',
        url: searchUrl,
      });
    }

    // Extract window.__APOLLO_STATE__ JSON
    const pattern = /window\.__APOLLO_STATE__\s*=\s*({.*?});?\s*<\/script>/s;
    const data = extractJsonFromHtml(html, pattern);

    let parsedResult = null;

    if (data) {
      // Home Depot uses complex Apollo cache structure
      const products = Object.values(data).filter((item: any) =>
        item.__typename === 'Product' && item.pricing && item.identifiers
      );

      if (products.length > 0) {
        const product: any = products[0];
        const price = product.pricing?.value || null;

        parsedResult = {
          retailer: 'Home Depot',
          price: price ? parsePrice(price) : null,
          url: product.identifiers?.canonicalUrl
            ? `https://www.homedepot.com${product.identifiers.canonicalUrl}`
            : null,
          title: product.identifiers?.productLabel || null,
          stock: product.availabilityType?.type === 'AVAILABLE',
          image: product.media?.images?.[0]?.url || null,
        };

        console.log(`✅ Home Depot: Found "${parsedResult.title}" at $${parsedResult.price?.toFixed(2)}`);
      }
    }

    res.json({
      success: true,
      html,
      retailer: 'Home Depot',
      url: finalUrl,
      parsed: parsedResult,
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
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl);

    if (error) {
      return res.json({
        success: false,
        error,
        retailer: 'Lowes',
        url: searchUrl,
      });
    }

    // Extract __NEXT_DATA__ JSON
    const pattern = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s;
    const data = extractJsonFromHtml(html, pattern);

    let parsedResult = null;

    if (data && data.props && data.props.pageProps) {
      const products = data.props.pageProps.data?.products || [];

      if (products.length > 0) {
        const product = products[0];
        const pricing = product.pricing?.sellingPrice || product.pricing?.originalPrice;

        parsedResult = {
          retailer: 'Lowes',
          price: pricing ? parsePrice(pricing) : null,
          url: product.url ? `https://www.lowes.com${product.url}` : null,
          title: product.name || null,
          stock: product.availability?.inStock === true,
          image: product.imageUrl || null,
        };

        console.log(`✅ Lowes: Found "${parsedResult.title}" at $${parsedResult.price?.toFixed(2)}`);
      }
    }

    res.json({
      success: true,
      html,
      retailer: 'Lowes',
      url: finalUrl,
      parsed: parsedResult,
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

    const searchUrl = `https://www.staples.com/search?query=${encodeURIComponent(keyword)}`;
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl);

    if (error) {
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

    const searchUrl = `https://www.officedepot.com/catalog/search.do?Ntt=${encodeURIComponent(keyword)}`;
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl);

    if (error) {
      return res.json({
        success: false,
        error,
        retailer: 'Office Depot',
        url: searchUrl,
      });
    }

    // Extract window.__APP_STATE__ JSON
    const pattern = /window\.__APP_STATE__\s*=\s*({.*?});?\s*<\/script>/s;
    const data = extractJsonFromHtml(html, pattern);

    let parsedResult = null;

    if (data && data.search && data.search.results) {
      const products = data.search.results;

      if (products.length > 0) {
        const product = products[0];

        parsedResult = {
          retailer: 'Office Depot',
          price: product.pricing?.salePrice || product.pricing?.listPrice
            ? parsePrice(product.pricing?.salePrice || product.pricing?.listPrice)
            : null,
          url: product.url
            ? `https://www.officedepot.com${product.url}`
            : null,
          title: product.name || null,
          stock: product.inventory?.available === true,
          image: product.images?.[0]?.url || null,
        };

        console.log(`✅ Office Depot: Found "${parsedResult.title}" at $${parsedResult.price?.toFixed(2)}`);
      }
    }

    res.json({
      success: true,
      html,
      retailer: 'Office Depot',
      url: finalUrl,
      parsed: parsedResult,
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



