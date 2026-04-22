import prisma from '../lib/prisma';
import appConfig from '../../../config/app.json';

/**
 * Smart Monitoring Engine
 * Computes priority scores and determines which items should be monitored
 */

/**
 * Compute priority score for a single item.
 * Top 20 by this score get daily retailer discovery (Bright Data cost control).
 *
 * Formula:
 * - recencyFactor (0-1): Days since last purchase
 * - frequencyFactor (0-1): Purchase count
 * - spendFactor (0-1): Approximate spend = lastPaidPrice * quantityPerOrder * purchaseCount
 *   (or baselineUnitPrice * estimatedMonthlyUnits when no purchase history)
 */
export function computeItemPriorityScore(item: {
  purchaseCount: number;
  lastPurchasedAt: Date | null;
  estimatedMonthlyUnits: number | null;
  lastPaidPrice?: number | null;
  quantityPerOrder?: number | null;
  baselineUnitPrice?: number | null;
  isPaused?: boolean;
}): number {
  if (item.isPaused) return 0;

  let recencyFactor = 0;
  if (item.lastPurchasedAt) {
    const daysSince = Math.floor(
      (Date.now() - item.lastPurchasedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince <= 14) recencyFactor = 1.0;
    else if (daysSince <= 30) recencyFactor = 0.8;
    else if (daysSince <= 90) recencyFactor = 0.5;
    else if (daysSince <= 180) recencyFactor = 0.2;
  }

  let frequencyFactor = 0;
  if (item.purchaseCount >= 10) frequencyFactor = 1.0;
  else frequencyFactor = Math.min(1.0, item.purchaseCount / 10);

  // Spend: lastPaidPrice * quantityPerOrder * purchaseCount, or baselineUnitPrice * estimatedMonthlyUnits
  let spendFactor = 0;
  const qty = item.quantityPerOrder ?? 1;
  const spend =
    item.lastPaidPrice != null && item.lastPaidPrice > 0
      ? item.lastPaidPrice * qty * Math.max(1, item.purchaseCount)
      : (item.baselineUnitPrice ?? 0) * (item.estimatedMonthlyUnits ?? 0);
  if (spend >= 500) spendFactor = 1.0;
  else if (spend >= 100) spendFactor = 0.8;
  else if (spend >= 50) spendFactor = 0.5;
  else if (spend >= 10) spendFactor = 0.3;
  else if (spend > 0) spendFactor = 0.1;

  const priorityScore = recencyFactor * 0.4 + frequencyFactor * 0.3 + spendFactor * 0.3;
  return Math.round(priorityScore * 100) / 100;
}

/**
 * Recompute monitoring priorities for all items in a company
 * Marks top N items as monitored based on priority score
 */
export async function recomputeMonitoringForCompany(
  companyId: number,
  maxMonitoredItems: number
): Promise<void> {
  try {
    // Fetch all items for this company
    const items = await prisma.item.findMany({
      where: { companyId },
    });

    console.log(`📊 Computing priorities for ${items.length} items in company ${companyId}`);

    // Exclude paused items and items needing clarification from monitoring
    const activeItems = items.filter(i => !i.isPaused && !i.needsClarification);
    console.log(`   Active items (not paused, not needing clarification): ${activeItems.length}`);
    
    // Mark items needing clarification as not monitored
    const itemsNeedingClarification = items.filter(i => i.needsClarification);
    if (itemsNeedingClarification.length > 0) {
      await prisma.item.updateMany({
        where: { 
          id: { in: itemsNeedingClarification.map(i => i.id) },
        },
        data: { 
          isMonitored: false,
          priorityScore: 0,
        },
      });
      console.log(`   Excluded ${itemsNeedingClarification.length} items needing clarification from monitoring`);
    }

    // Compute priority score for each item (quantity/spend from QuickBooks)
    const itemsWithScores = activeItems.map(item => ({
      item,
      score: computeItemPriorityScore({
        purchaseCount: item.purchaseCount,
        lastPurchasedAt: item.lastPurchasedAt,
        estimatedMonthlyUnits: item.estimatedMonthlyUnits,
        lastPaidPrice: item.lastPaidPrice,
        quantityPerOrder: item.quantityPerOrder,
        baselineUnitPrice: item.baselineUnitPrice,
        isPaused: item.isPaused,
      }),
    }));

    // Ensure paused items are marked as not monitored
    const pausedItems = items.filter(i => i.isPaused);
    if (pausedItems.length > 0) {
      await prisma.item.updateMany({
        where: { 
          id: { in: pausedItems.map(i => i.id) },
        },
        data: { 
          isMonitored: false,
          priorityScore: 0,
        },
      });
      console.log(`   Paused ${pausedItems.length} items (excluded from monitoring)`);
    }

    // Update priority scores in database (batch update)
    const updatePromises = itemsWithScores.map(({ item, score }) =>
      prisma.item.update({
        where: { id: item.id },
        data: { priorityScore: score },
      })
    );

    await Promise.all(updatePromises);
    console.log(`✅ Updated priority scores for ${itemsWithScores.length} items`);

    // Sort by priority score (descending)
    itemsWithScores.sort((a, b) => b.score - a.score);

    // Mark top N as monitored
    const topItems = itemsWithScores.slice(0, maxMonitoredItems);
    const topItemIds = topItems.map(({ item }) => item.id);
    const otherItemIds = itemsWithScores
      .slice(maxMonitoredItems)
      .map(({ item }) => item.id);

    // Batch update: mark top items as monitored
    if (topItemIds.length > 0) {
      await prisma.item.updateMany({
        where: { id: { in: topItemIds } },
        data: { isMonitored: true },
      });
      console.log(`✅ Marked ${topItemIds.length} items as monitored`);
    }

    // Batch update: mark all others as not monitored
    if (otherItemIds.length > 0) {
      await prisma.item.updateMany({
        where: { id: { in: otherItemIds } },
        data: { isMonitored: false },
      });
      console.log(`✅ Marked ${otherItemIds.length} items as not monitored`);
    }

    // Log top monitored items
    if (topItems.length > 0) {
      console.log(`📈 Top ${Math.min(5, topItems.length)} monitored items:`);
      topItems.slice(0, 5).forEach(({ item, score }, index) => {
        console.log(`   ${index + 1}. ${item.name} (score: ${score.toFixed(2)})`);
      });
    }
  } catch (error) {
    console.error(`❌ Error recomputing monitoring for company ${companyId}:`, error);
    throw error;
  }
}

/**
 * Get Top N items for daily retailer discovery (Bright Data cost control).
 * Uses same ranking as recomputeMonitoring: QuickBooks purchase data (quantity/spend).
 * Call this before triggering discovery to limit API costs.
 */
export async function getTopItemsForDiscovery(
  companyId: number,
  maxItems: number
): Promise<Array<{ id: number; companyId: number; userId: number; name: string; baselineUnitPrice: number | null }>> {
  const items = await prisma.item.findMany({
    where: {
      companyId,
      isPaused: false,
      needsClarification: false,
    },
    orderBy: [
      { priorityScore: 'desc' },
      { purchaseCount: 'desc' },
      { lastPurchasedAt: 'desc' },
    ],
    take: maxItems,
    select: {
      id: true,
      companyId: true,
      userId: true,
      name: true,
      baselineUnitPrice: true,
    },
  });
  return items;
}

/**
 * Recompute monitoring priorities for all companies
 */
export async function recomputeMonitoringForAllCompanies(
  maxMonitoredItems?: number
): Promise<void> {
  const maxItems =
    maxMonitoredItems ||
    (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) ||
    20;

  try {
    const companies = await prisma.company.findMany({
      select: { id: true },
    });

    console.log(`🔄 Recomputing monitoring for ${companies.length} companies...`);

    for (const company of companies) {
      await recomputeMonitoringForCompany(company.id, maxItems);
    }

    console.log(`✅ Completed monitoring recomputation for all companies`);
  } catch (error) {
    console.error('❌ Error recomputing monitoring for all companies:', error);
    throw error;
  }
}
