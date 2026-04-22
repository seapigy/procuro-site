import prisma from "../server/src/lib/prisma";
import { getBestPriceForItem } from "../providers";

export async function runDailyPriceCheck() {
  const items = await prisma.item.findMany();

  for (const item of items) {
    const best = await getBestPriceForItem(item);
    if (!best || best.price === null) continue;

    // Use baselinePrice for savings calculations (with fallback to lastPaidPrice for safety)
    const baseline = (item.baselinePrice && item.baselinePrice > 0) ? item.baselinePrice : item.lastPaidPrice;
    
    // Skip if baseline is invalid
    if (baseline <= 0) {
      continue;
    }

    if (best.price < baseline) {
      // Calculate savings
      const quantity = item.quantityPerOrder;
      const interval = item.reorderIntervalDays;
      const savingsPerUnit = baseline - best.price;
      const savingsPerOrder = savingsPerUnit * quantity;
      const estimatedMonthlySavings = (30 / interval) * savingsPerOrder;

      await prisma.alert.create({
        data: {
          itemId: item.id,
          userId: item.userId,
          retailer: best.retailer,
          newPrice: best.price,
          oldPrice: baseline,
          url: best.url,
          savingsPerOrder: savingsPerOrder,
          estimatedMonthlySavings: estimatedMonthlySavings,
        }
      });
    }
  }
  console.log("✅ Daily price check completed.");
}

