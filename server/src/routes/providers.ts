/**
 * Backend provider proxies (CORS bypass for browser / aggregate tests).
 *
 * Not used for monitored item discovery — that is Amazon + Home Depot via Bright Data
 * (see docs/ARCHITECTURE.md). Active routes here: Office Depot HTML proxy, Rakuten (token),
 * Staples (parked stub).
 */

import { Router, Request, Response } from 'express';
import { fetchHtmlWithRetries } from '../utils/fetchHtml';
import { parseOfficeDepotHtml } from '../providers/parsers/officedepotParser';
import { rakutenSearch } from '../providers/rakuten';
import { staplesSearch } from '../providers/staples';

const router = Router();

/**
 * Office Depot — HTML search proxy (legacy aggregate path; not Bright Data HD).
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
    const { html, finalUrl, error } = await fetchHtmlWithRetries(searchUrl, {
      maxRetries: 3,
      timeout: 15000,
      headers: {
        Referer: 'https://www.officedepot.com/',
        Origin: 'https://www.officedepot.com',
      },
    });

    if (error) {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('❌ Office Depot provider error:', error);
    res.json({
      success: false,
      error: message,
      retailer: 'Office Depot',
    });
  }
});

router.get('/rakuten', async (req: Request, res: Response) => {
  const { keyword } = req.query;
  const result = await rakutenSearch(keyword as string);
  res.json(result);
});

router.get('/staples', async (req: Request, res: Response) => {
  const { keyword } = req.query;
  const result = await staplesSearch(keyword as string);
  res.json(result);
});

export default router;
