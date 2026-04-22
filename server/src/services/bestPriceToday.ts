import prisma from '../lib/prisma';

/**
 * Compute best price from quotes captured today (UTC) and update Item deal fields.
 * If found: update Item.bestDealUnitPrice, bestDealFoundAt, bestDealRetailer, bestDealUrl.
 * If none: leave bestDeal fields null.
 */
export async function computeBestPriceToday(
  companyId: number,
  itemId: number
): Promise<{ updated: boolean; bestUnitPrice?: number; retailer?: string }> {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const quotes = await prisma.retailerPriceQuote.findMany({
    where: {
      companyId,
      itemId,
      capturedAt: {
        gte: startOfToday,
        lt: endOfToday,
      },
    },
    orderBy: { unitPrice: 'asc' },
    take: 1,
  });

  const best = quotes[0];
  if (!best) {
    return { updated: false };
  }

  await prisma.item.updateMany({
    where: { id: itemId, companyId },
    data: {
      bestDealUnitPrice: best.unitPrice,
      bestDealFoundAt: best.capturedAt,
      bestDealRetailer: best.retailer,
      bestDealUrl: best.url,
    },
  });

  return {
    updated: true,
    bestUnitPrice: best.unitPrice,
    retailer: best.retailer,
  };
}
