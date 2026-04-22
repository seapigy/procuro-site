import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { computeBestPriceToday } from '../services/bestPriceToday';
import { runPriceCheckForItem } from '../services/priceCheck';
import { pollPendingBrightDataJobs } from '../services/brightDataJobs';
import { enabledRetailerProviders } from '../providers/retailerProviders';

const router = Router();

/**
 * GET /api/prices/brightdata-samples
 * Query params: provider (optional), itemId (optional)
 * Returns latest BrightDataRawSample rows for the company to inspect real dataset output.
 * Requires req.companyId and req.companyContextUser.
 */
router.get('/brightdata-samples', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const provider = typeof req.query.provider === 'string' ? req.query.provider.trim() : undefined;
    const itemIdParam = req.query.itemId;
    const itemId = itemIdParam != null ? parseInt(String(itemIdParam), 10) : undefined;

    const where: { companyId: number; provider?: string; itemId?: number } = { companyId };
    if (provider) where.provider = provider;
    if (itemId != null && !isNaN(itemId)) where.itemId = itemId;

    const samples = await prisma.brightDataRawSample.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      samples: samples.map((s) => ({
        id: s.id,
        provider: s.provider,
        itemId: s.itemId,
        capturedAt: s.capturedAt,
        inputUrl: s.inputUrl,
        rowsJson: s.rowsJson,
        statusCode: s.statusCode,
        notes: s.notes,
      })),
    });
  } catch (error) {
    console.error('Error fetching brightdata samples:', error);
    res.status(500).json({
      error: 'Failed to fetch samples',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/prices/providers
 * Returns list of enabled provider names (for debugging).
 */
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    providers: enabledRetailerProviders.map((p) => p.name),
  });
});

/**
 * POST /api/prices/poll-jobs
 * Polls pending Bright Data jobs for the company, downloads when ready, inserts quotes.
 */
router.post('/poll-jobs', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const result = await pollPendingBrightDataJobs(companyId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error polling jobs:', error);
    res.status(500).json({
      error: 'Failed to poll jobs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/prices/run
 * Body: { itemId: number }
 * Runs price check for item via enabled providers, inserts quotes, updates best deal.
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const { itemId } = req.body as { itemId: number };
    const itemIdNum = parseInt(String(itemId), 10);
    if (isNaN(itemIdNum)) {
      return res.status(400).json({ error: 'Invalid itemId' });
    }

    const result = await runPriceCheckForItem(companyId, itemIdNum);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg === 'Item not found') {
      return res.status(404).json({ error: msg });
    }
    console.error('Error running price check:', error);
    res.status(500).json({
      error: 'Failed to run price check',
      details: msg,
    });
  }
});

interface QuoteInput {
  retailer: string;
  url?: string;
  unitPrice: number;
  currency?: string;
  capturedAt?: string;
  rawJson?: object;
}

/**
 * POST /api/prices/quotes
 * Body: { itemId, quotes: [{ retailer, url?, unitPrice, currency?, capturedAt?, rawJson? }] }
 * Require req.companyId and req.companyContextUser.
 * Validate unitPrice > 0 and < 100000.
 */
router.post('/quotes', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const { itemId, quotes } = req.body as { itemId: number; quotes: QuoteInput[] };
    if (!itemId || !Array.isArray(quotes) || quotes.length === 0) {
      return res.status(400).json({ error: 'itemId and non-empty quotes array required' });
    }

    const itemIdNum = parseInt(String(itemId), 10);
    if (isNaN(itemIdNum)) {
      return res.status(400).json({ error: 'Invalid itemId' });
    }

    // Verify item belongs to company
    const item = await prisma.item.findFirst({
      where: { id: itemIdNum, companyId },
    });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const toInsert: Array<{
      companyId: number;
      itemId: number;
      retailer: string;
      url: string | null;
      unitPrice: number;
      currency: string;
      capturedAt: Date;
      rawJson?: object;
    }> = [];

    for (const q of quotes) {
      if (!q.retailer || typeof q.unitPrice !== 'number') {
        return res.status(400).json({ error: 'Each quote must have retailer and unitPrice (number)' });
      }
      const unitPrice = q.unitPrice;
      if (unitPrice <= 0 || unitPrice >= 100000) {
        return res.status(400).json({ error: 'unitPrice must be > 0 and < 100000' });
      }
      const capturedAt = q.capturedAt ? new Date(q.capturedAt) : new Date();
      toInsert.push({
        companyId,
        itemId: itemIdNum,
        retailer: String(q.retailer).trim(),
        url: q.url != null ? String(q.url) : null,
        unitPrice,
        currency: q.currency || 'USD',
        capturedAt,
        rawJson: q.rawJson != null && typeof q.rawJson === 'object' ? q.rawJson : undefined,
      });
    }

    const result = await prisma.retailerPriceQuote.createMany({
      data: toInsert,
    });

    // Update Item best-deal fields from today's quotes
    await computeBestPriceToday(companyId, itemIdNum).catch(err =>
      console.warn('computeBestPriceToday failed:', err)
    );

    res.json({
      success: true,
      inserted: result.count,
    });
  } catch (error) {
    console.error('Error storing quotes:', error);
    res.status(500).json({
      error: 'Failed to store quotes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
