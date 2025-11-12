import prisma from "../server/src/lib/prisma";
import { getBestPriceForItem } from "../providers";

export async function runDailyPriceCheck() {
  const items = await prisma.item.findMany();

  for (const item of items) {
    const best = await getBestPriceForItem(item);
    if (!best || best.price === null) continue;

    // Determine if it's cheaper than last paid
    const lastPaid = item.lastPaidPrice;

    if (best.price < lastPaid) {
      // Calculate savings
      const quantity = item.quantityPerOrder;
      const interval = item.reorderIntervalDays;
      const savingsPerUnit = item.lastPaidPrice - best.price;
      const savingsPerOrder = savingsPerUnit * quantity;
      const estimatedMonthlySavings = (30 / interval) * savingsPerOrder;

      await prisma.alert.create({
        data: {
          itemId: item.id,
          userId: item.userId,
          retailer: best.retailer,
          newPrice: best.price,
          oldPrice: lastPaid,
          url: best.url,
          savingsPerOrder: savingsPerOrder,
          estimatedMonthlySavings: estimatedMonthlySavings,
        }
      });
    }
  }
  console.log("✅ Daily price check completed.");
}

