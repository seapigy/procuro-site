import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { computeBestPriceToday } from './bestPriceToday';
import { createDealAlertIfEligible } from './dealAlert';
import { formatMatchedRetailerDisplay } from './matchItem';

/**
 * After Fix Match / auto-match persists a catalog price, feed the same pipeline as price check:
 * today's RetailerPriceQuote + computeBestPriceToday → Item.bestDealUnitPrice for dashboard deal state.
 * Optionally create an alert when savings vs baseline meet percent OR minimum dollar threshold.
 */
export async function syncCatalogMatchIntoDealPipeline(options: {
  companyId: number;
  itemId: number;
  userId: number;
  retailer: string;
  unitPrice: number;
  url: string;
}): Promise<void> {
  const { companyId, itemId, userId, retailer, unitPrice, url } = options;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return;

  const displayRetailer = formatMatchedRetailerDisplay(retailer);

  await prisma.retailerPriceQuote.create({
    data: {
      companyId,
      itemId,
      retailer: displayRetailer,
      url,
      unitPrice,
      currency: 'USD',
      capturedAt: new Date(),
      rawJson: { source: 'catalog_match', matchProvider: retailer },
    },
  });

  await computeBestPriceToday(companyId, itemId);

  await createDealAlertIfEligible(prisma as unknown as Prisma.TransactionClient, {
    companyId,
    itemId,
    userId,
    displayRetailer,
    newPrice: unitPrice,
    url,
  });
}
