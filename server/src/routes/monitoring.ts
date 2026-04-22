import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { runPriceCheckForItem } from '../services/priceCheck';
import { computeDealState } from '../services/dealState';
import { getTopItemsForDiscovery } from '../services/monitoring';
import { getDailyPriceCheckRuntimeStatus, getLatestDailyPriceCheckRun, runDailyPriceCheck } from '../workers/dailyPriceCheck';
import appConfig from '../../../config/app.json';

const router = Router();

const MAX_DISCOVERY_ITEMS = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
const SAVINGS_PCT_THRESHOLD = (appConfig.pricing?.priceDropThreshold as number) ?? 0.05;
const DEDUPE_HOURS = 24;
const MONITORING_ADMIN_TOKEN = process.env.MONITORING_ADMIN_TOKEN || '';

interface RunResult {
  itemId: number;
  inserted: number;
  skipped?: boolean;
  dealState: string;
  bestPriceToday: number | null;
  savingsPct: number | null;
}

function normalizeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeBigInt);
  if (value && typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      obj[k] = normalizeBigInt(v);
    });
    return obj;
  }
  return value;
}

function isAuthorizedForOps(req: Request): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const provided = String(req.headers['x-monitoring-token'] || '');
  return Boolean(MONITORING_ADMIN_TOKEN) && provided === MONITORING_ADMIN_TOKEN;
}

/**
 * GET /api/monitoring/daily/status
 * Returns runtime and latest persisted run snapshot for the global daily scheduler.
 */
router.get('/daily/status', async (req: Request, res: Response) => {
  try {
    if (!isAuthorizedForOps(req)) {
      return res.status(403).json({ error: 'Forbidden: missing or invalid monitoring token' });
    }
    const runtime = getDailyPriceCheckRuntimeStatus();
    const latestRun = await getLatestDailyPriceCheckRun();
    res.json({
      success: true,
      runtime,
      latestRun: normalizeBigInt(latestRun),
    });
  } catch (error) {
    console.error('Error getting daily monitoring status:', error);
    res.status(500).json({
      error: 'Failed to get daily monitoring status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/monitoring/daily/run
 * Manually trigger global daily scheduler with lock and run-state persistence.
 */
router.post('/daily/run', async (req: Request, res: Response) => {
  try {
    if (!isAuthorizedForOps(req)) {
      return res.status(403).json({ error: 'Forbidden: missing or invalid monitoring token' });
    }
    const run = await runDailyPriceCheck('manual');
    res.json({
      success: run.status === 'success',
      run,
    });
  } catch (error) {
    console.error('Error manually running daily monitoring:', error);
    res.status(500).json({
      error: 'Failed to run daily monitoring',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/monitoring/run
 * Body: { limit?: number } default 20, capped at Top 20 for Bright Data cost control
 * Runs retailer discovery for Top N items (by QuickBooks quantity/spend), creates alerts for deals.
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const requestedLimit = Math.max(1, parseInt(String(req.body?.limit ?? MAX_DISCOVERY_ITEMS), 10) || MAX_DISCOVERY_ITEMS);
    const limit = Math.min(requestedLimit, MAX_DISCOVERY_ITEMS);

    const items = await getTopItemsForDiscovery(companyId, limit);

    let totalQuotesInserted = 0;
    let dealsFound = 0;
    let alertsCreated = 0;
    const results: RunResult[] = [];

    const dedupeSince = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000);

    for (const item of items) {
      const baselineUnitPrice = item.baselineUnitPrice;
      if (baselineUnitPrice == null) continue;

      let priceResult: Awaited<ReturnType<typeof runPriceCheckForItem>>;
      try {
        priceResult = await runPriceCheckForItem(companyId, item.id);
      } catch (err) {
        console.warn(`Price check failed for item ${item.id}:`, err);
        results.push({
          itemId: item.id,
          inserted: 0,
          skipped: false,
          dealState: 'error',
          bestPriceToday: null,
          savingsPct: null,
        });
        continue;
      }

      totalQuotesInserted += priceResult.inserted;

      const itemAfter = await prisma.item.findUnique({
        where: { id: item.id },
        select: { bestDealUnitPrice: true, bestDealRetailer: true, bestDealUrl: true },
      });

      const deal = computeDealState({
        baselineUnitPrice,
        bestDealUnitPrice: itemAfter?.bestDealUnitPrice ?? priceResult.bestDealUnitPrice,
      });

      results.push({
        itemId: item.id,
        inserted: priceResult.inserted,
        skipped: priceResult.skipped ?? false,
        dealState: deal.dealState,
        bestPriceToday: deal.bestPriceToday,
        savingsPct: deal.savingsPct,
      });

      if (deal.dealState === 'deal') {
        dealsFound += 1;

        if (
          deal.savingsPct != null &&
          deal.savingsPct >= SAVINGS_PCT_THRESHOLD &&
          deal.savingsAmount != null &&
          deal.savingsAmount > 0 &&
          deal.baselineUnitPrice != null &&
          deal.bestPriceToday != null
        ) {
          const retailer = itemAfter?.bestDealRetailer ?? priceResult.bestDealRetailer ?? 'Unknown';
          const url = itemAfter?.bestDealUrl ?? null;

          const existing = await prisma.alert.findFirst({
            where: {
              companyId,
              itemId: item.id,
              retailer,
              newPrice: deal.bestPriceToday,
              alertDate: { gte: dedupeSince },
            },
          });

          if (!existing) {
            await prisma.alert.create({
              data: {
                itemId: item.id,
                userId: item.userId,
                companyId,
                retailer,
                newPrice: deal.bestPriceToday,
                oldPrice: deal.baselineUnitPrice,
                priceDropAmount: deal.savingsAmount,
                url,
                savingsPerOrder: deal.savingsAmount,
                estimatedMonthlySavings: deal.savingsAmount,
                seen: false,
                viewed: false,
              },
            });
            alertsCreated += 1;
          }
        }
      }
    }

    res.json({
      success: true,
      itemsChecked: items.length,
      totalQuotesInserted,
      dealsFound,
      alertsCreated,
      results,
    });
  } catch (error) {
    console.error('Error running monitoring:', error);
    res.status(500).json({
      error: 'Failed to run monitoring',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
