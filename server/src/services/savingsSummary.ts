import type { Prisma } from '@prisma/client';
import {
  computeDealState,
  effectiveBaselineForSavings,
  effectiveBestRetailUnitPrice,
} from './dealState';
import { createDealAlertIfEligible } from './dealAlert';
import { formatMatchedRetailerDisplay } from './matchItem';

export type SavingsSummaryPayload = {
  success: true;
  totalMonthlySavings: number;
  fromAlertsMonthly: number;
  trackedDealsSupplementMonthly: number;
  trackedDealsWithoutAlert: Array<{
    itemId: number;
    name: string;
    retailer: string;
    url: string | null;
    oldPrice: number;
    newPrice: number;
    savingsPerOrder: number;
    estimatedMonthlySavings: number;
  }>;
  totalItemsMonitored: number;
  alertsThisMonth: number;
  topSavingsItem: {
    name: string;
    savingsPerOrder: number;
    estimatedMonthlySavings: number;
    retailer: string;
    url: string | null;
  } | null;
  estimatedAnnualSavings: number;
  metricsWindow: string;
  metricsWindowDays: number;
  metricsWindowLabel: string;
};

/**
 * Shared metrics for GET /api/savings-summary and simulate.
 * Pass a tenant-scoped `tx` (from `withCompany`) so RLS applies.
 *
 * May insert `Alert` rows for qualifying open deals that had no alert in the last 30 days,
 * so Overview metrics align with persisted alerts (GET /api/alerts).
 */
export async function buildSavingsSummaryPayload(
  tx: Prisma.TransactionClient,
  companyId: number,
  userId: number
): Promise<SavingsSummaryPayload> {
  const metricsWindowDays = 30;
  const metricsWindow = 'last_30_days';
  const metricsWindowLabel = 'Last 30 days';
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - metricsWindowDays);

  let recentAlerts = await tx.alert.findMany({
    where: { userId, companyId, alertDate: { gte: thirtyDaysAgo } },
    include: { item: true },
  });
  const totalItemsMonitored = await tx.item.count({
    where: { userId, companyId, isMonitored: true, needsClarification: false },
  });
  const itemsForDeals = await tx.item.findMany({
    where: { userId, companyId },
    select: {
      id: true,
      name: true,
      userId: true,
      baselineUnitPrice: true,
      baselinePrice: true,
      bestDealUnitPrice: true,
      bestDealRetailer: true,
      bestDealUrl: true,
      matchedPrice: true,
      matchProvider: true,
      matchUrl: true,
      reorderIntervalDays: true,
    },
  });

  const alertItemIds = new Set(recentAlerts.map((a) => a.itemId));

  for (const row of itemsForDeals) {
    if (alertItemIds.has(row.id)) continue;
    const deal = computeDealState({
      baselineUnitPrice: effectiveBaselineForSavings(row),
      bestDealUnitPrice: effectiveBestRetailUnitPrice(row),
    });
    if (deal.dealState !== 'deal' || deal.savingsAmount == null || deal.savingsAmount <= 0) continue;
    const best = deal.bestPriceToday;
    if (best == null) continue;

    const displayRetailer = row.matchProvider
      ? formatMatchedRetailerDisplay(row.matchProvider)
      : row.bestDealRetailer?.trim() || 'Retailer';
    const url = row.matchUrl ?? row.bestDealUrl ?? null;

    await createDealAlertIfEligible(tx, {
      companyId,
      userId: row.userId,
      itemId: row.id,
      displayRetailer,
      newPrice: best,
      url,
    });
  }

  recentAlerts = await tx.alert.findMany({
    where: { userId, companyId, alertDate: { gte: thirtyDaysAgo } },
    include: { item: true },
  });

  const alertsThisMonth = recentAlerts.length;
  const fromAlertsMonthly = recentAlerts.reduce((sum, a) => sum + a.estimatedMonthlySavings, 0);
  const totalMonthlySavings = fromAlertsMonthly;

  const topCandidates: NonNullable<SavingsSummaryPayload['topSavingsItem']>[] = [];
  for (const a of recentAlerts) {
    topCandidates.push({
      name: a.item.name,
      savingsPerOrder: a.savingsPerOrder,
      estimatedMonthlySavings: a.estimatedMonthlySavings,
      retailer: a.retailer,
      url: a.url,
    });
  }

  let topSavingsItem: SavingsSummaryPayload['topSavingsItem'] = null;
  if (topCandidates.length > 0) {
    topSavingsItem = topCandidates.reduce((max, c) =>
      c.estimatedMonthlySavings > max.estimatedMonthlySavings ? c : max
    );
  }

  return {
    success: true,
    totalMonthlySavings,
    fromAlertsMonthly,
    trackedDealsSupplementMonthly: 0,
    trackedDealsWithoutAlert: [],
    totalItemsMonitored,
    alertsThisMonth,
    topSavingsItem,
    estimatedAnnualSavings: totalMonthlySavings * 12,
    metricsWindow,
    metricsWindowDays,
    metricsWindowLabel,
  };
}
