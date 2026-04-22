import prisma from '../lib/prisma';
import { computeBestPriceToday } from './bestPriceToday';
import { getBrightDataConfig } from '../config/brightData';
import {
  getSnapshotRows,
  pickBestRow,
  waitForSnapshot,
  isBrightDataConfigured,
} from './brightData';
import { extractAsin, buildCanonicalProductUrl } from '../utils/amazonIdentity';
import {
  extractHomeDepotProductIdFromUrl,
  buildCanonicalHomeDepotProductUrl,
} from '../utils/homedepotIdentity';
import { upsertRetailerMatch } from './itemRetailerMatch';

function extractUrlFromRow(row: Record<string, unknown>, fallback: string): string {
  const fields = ['url', 'product_url', 'productUrl', 'link', 'href'];
  for (const f of fields) {
    const v = row[f];
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  return fallback;
}
const POLL_COOLDOWN_MS = 60_000; // Skip if lastCheckedAt within 60s

export interface PollResult {
  processed: number;
  ready: number;
  failed: number;
}

/**
 * Poll pending Bright Data jobs, check status, download when ready, insert quotes.
 */
export async function pollPendingBrightDataJobs(
  companyId: number,
  limit = 20
): Promise<PollResult> {
  const config = getBrightDataConfig();
  if (!config.enabled) {
    return { processed: 0, ready: 0, failed: 0 };
  }

  const cooldownSince = new Date(Date.now() - POLL_COOLDOWN_MS);

  const jobs = await prisma.brightDataScrapeJob.findMany({
    where: {
      companyId,
      status: 'pending',
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: cooldownSince } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const result: PollResult = { processed: 0, ready: 0, failed: 0 };

  for (const job of jobs) {
    result.processed += 1;
    await prisma.brightDataScrapeJob.update({
      where: { id: job.id },
      data: { lastCheckedAt: new Date() },
    });

    try {
      // Test mode: s_test_* snapshots (BRIGHTDATA_FORCE_202) - no real API data, skip quote
      if (job.snapshotId.startsWith('s_test_')) {
        await prisma.brightDataScrapeJob.update({
          where: { id: job.id },
          data: { status: 'ready' },
        });
        result.ready += 1;
        continue;
      }

      if (!isBrightDataConfigured() || !config.apiKey) {
        await prisma.brightDataScrapeJob.update({
          where: { id: job.id },
          data: { status: 'failed', error: 'Bright Data API key not configured' },
        });
        result.failed += 1;
        continue;
      }

      try {
        await waitForSnapshot(job.snapshotId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await prisma.brightDataScrapeJob.update({
          where: { id: job.id },
          data: { status: 'failed', error: msg },
        });
        result.failed += 1;
        continue;
      }

      const rows = await getSnapshotRows(job.snapshotId);
      const retailer = job.provider || 'Amazon';
      const fallbackUrl =
        retailer === 'Home Depot'
          ? 'https://www.homedepot.com/p/unknown'
          : 'https://www.amazon.com/dp/unknown';
      const picked = pickBestRow(rows);

      if (!picked) {
        await prisma.brightDataScrapeJob.update({
          where: { id: job.id },
          data: { status: 'ready', error: 'No valid price in results' },
        });
        result.ready += 1;
        continue;
      }

      const { row: bestRow, unitPrice: minPrice } = picked;
      const url = extractUrlFromRow(bestRow, fallbackUrl);
      const capturedAt = new Date();

      const rawJson = {
        ...bestRow,
        _snapshotId: job.snapshotId,
        _dataset: config.amazonDatasetId,
      } as object;

      await prisma.retailerPriceQuote.create({
        data: {
          companyId: job.companyId,
          itemId: job.itemId,
          retailer,
          url,
          unitPrice: minPrice,
          currency: 'USD',
          capturedAt,
          rawJson,
        },
      });

      // Auto-persist retailer identity when Bright Data returns real product row (no source)
      // Writes to ItemRetailerMatch (primary) and syncs legacy Item fields
      const hasSource = (bestRow as Record<string, unknown>).source != null;
      if (!hasSource) {
        if (retailer === 'Amazon') {
          const asinStr = extractAsin(bestRow, url);
          const canonicalUrl = buildCanonicalProductUrl(asinStr);
          if (asinStr || canonicalUrl) {
            await upsertRetailerMatch(job.itemId, job.companyId, 'Amazon', {
              retailerProductId: asinStr ?? null,
              productUrl: canonicalUrl ?? null,
            });
            console.log(
              `[BrightDataJobs] Amazon identity auto-persisted for item ${job.itemId}: asin=${asinStr ?? '-'} url=${canonicalUrl ?? '-'}`
            );
          }
        } else if (retailer === 'Home Depot') {
          const productId = extractHomeDepotProductIdFromUrl(url);
          const canonicalUrl = buildCanonicalHomeDepotProductUrl(productId);
          if (productId || canonicalUrl) {
            await upsertRetailerMatch(job.itemId, job.companyId, 'Home Depot', {
              retailerProductId: productId ?? null,
              productUrl: canonicalUrl ?? null,
            });
            console.log(
              `[BrightDataJobs] Home Depot identity auto-persisted for item ${job.itemId}: productId=${productId ?? '-'} url=${canonicalUrl ?? '-'}`
            );
          }
        }
      }

      await computeBestPriceToday(job.companyId, job.itemId);

      await prisma.brightDataScrapeJob.update({
        where: { id: job.id },
        data: { status: 'ready' },
      });
      result.ready += 1;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[BrightDataJobs] Job ${job.snapshotId} error:`, errMsg);
      await prisma.brightDataScrapeJob.update({
        where: { id: job.id },
        data: { status: 'failed', error: errMsg },
      });
      result.failed += 1;
    }
  }

  return result;
}
