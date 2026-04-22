import prisma from '../lib/prisma';

/**
 * Store price history for an item (tenant-scoped)
 */
export async function storePriceHistory(
  itemId: number,
  companyId: number,
  price: number,
  retailer: string
): Promise<void> {
  try {
    await prisma.priceHistory.create({
      data: { itemId, companyId, price, retailer },
    });

    // Get all price history entries for this item, ordered by date
    const allEntries = await prisma.priceHistory.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    // If we have more than 20 entries, delete the oldest ones
    if (allEntries.length > 20) {
      const entriesToDelete = allEntries.slice(20);
      const idsToDelete = entriesToDelete.map(e => e.id);

      if (idsToDelete.length > 0) {
        await prisma.priceHistory.deleteMany({
          where: {
            id: { in: idsToDelete },
          },
        });
      }
    }
  } catch (error) {
    console.error(`Error storing price history for item ${itemId}:`, error);
    // Don't throw - price history is non-critical
  }
}

/**
 * Get price history stats for an item (last 30 days)
 */
export async function getPriceHistoryStats(itemId: number): Promise<{
  bestPrice30Days: number | null;
  avgPrice30Days: number | null;
  history: Array<{ date: Date; price: number; retailer: string }>;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const history = await prisma.priceHistory.findMany({
    where: {
      itemId,
      createdAt: { gte: thirtyDaysAgo },
    },
    orderBy: { createdAt: 'asc' },
  });

  const prices = history.map(h => h.price);
  const bestPrice30Days = prices.length > 0 ? Math.min(...prices) : null;
  const avgPrice30Days =
    prices.length > 0
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : null;

  return {
    bestPrice30Days,
    avgPrice30Days,
    history: history.map(h => ({
      date: h.createdAt,
      price: h.price,
      retailer: h.retailer,
    })),
  };
}




