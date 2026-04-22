import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
  runDatasetAndGetRows,
  pickBestRow,
  isBrightDataConfigured,
} from '../services/brightData';

const router = Router();

/**
 * POST /api/debug/brightdata
 * Body: { url: string, itemId?: number }
 * Response: { snapshotId, rowCount, sampleRowKeys, normalizedPrice, stored?: boolean }
 * Temporary test endpoint - remove before production.
 * Does NOT log API key.
 * When itemId provided and valid for company, stores quote to RetailerPriceQuote for verification.
 */
router.post('/brightdata', async (req: Request, res: Response) => {
  try {
    if (!isBrightDataConfigured()) {
      return res.status(400).json({
        error: 'Bright Data not configured',
        hint: 'Set BRIGHTDATA_API_KEY and BRIGHTDATA_DATASET_ID (or BRIGHTDATA_AMAZON_DATASET_ID)',
      });
    }

    const { url, itemId: bodyItemId } = req.body as { url?: string; itemId?: number };
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'url (string) required in body' });
    }

    const productUrl = url.trim();
    if (
      !productUrl.startsWith('https://www.amazon.com') &&
      !productUrl.startsWith('https://amazon.com') &&
      !productUrl.startsWith('http://www.amazon.com') &&
      !productUrl.startsWith('http://amazon.com')
    ) {
      return res.status(400).json({
        error: 'URL must start with amazon.com or www.amazon.com',
      });
    }

    const { snapshotId, rows } = await runDatasetAndGetRows({ url: productUrl });
    const rowCount = rows.length;

    const sampleRow = rows[0];
    const sampleRowKeys =
      sampleRow && typeof sampleRow === 'object'
        ? Object.keys(sampleRow as Record<string, unknown>)
        : [];

    const picked = pickBestRow(rows);
    const normalizedPrice = picked ? picked.unitPrice : null;

    let stored = false;
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    const itemIdNum = bodyItemId != null ? parseInt(String(bodyItemId), 10) : null;

    if (picked && companyId != null && contextUser && itemIdNum != null && !isNaN(itemIdNum)) {
      const item = await prisma.item.findFirst({
        where: { id: itemIdNum, companyId },
      });
      if (item) {
        const rawJson = {
          ...picked.row,
          _snapshotId: snapshotId,
          _dataset: 'debug',
        } as object;
        await prisma.retailerPriceQuote.create({
          data: {
            companyId,
            itemId: itemIdNum,
            retailer: 'Amazon',
            url: productUrl,
            unitPrice: picked.unitPrice,
            currency: 'USD',
            capturedAt: new Date(),
            rawJson,
          },
        });
        stored = true;
      }
    }

    res.json({
      snapshotId,
      rowCount,
      sampleRowKeys,
      normalizedPrice,
      sampleRowKeysCount: sampleRowKeys.length,
      stored,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      error: 'Bright Data debug failed',
      details: msg,
    });
  }
});

export default router;
