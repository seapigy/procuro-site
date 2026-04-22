import type { Prisma } from '@prisma/client';
import appConfig from '../../../config/app.json';
import { effectiveBaselineForSavings } from './dealState';

export type CreateDealAlertParams = {
  companyId: number;
  userId: number;
  itemId: number;
  /** Display retailer string (e.g. from formatMatchedRetailerDisplay). */
  displayRetailer: string;
  newPrice: number;
  url: string | null;
};

/**
 * Create an Alert when savings vs baseline meet percent OR minimum dollar threshold,
 * with 24h dedupe on same item/retailer/price band. Returns true if a row was inserted.
 */
export async function createDealAlertIfEligible(
  db: Prisma.TransactionClient,
  params: CreateDealAlertParams
): Promise<boolean> {
  const { companyId, userId, itemId, displayRetailer, newPrice, url } = params;
  if (!Number.isFinite(newPrice) || newPrice <= 0) return false;

  const item = await db.item.findFirst({
    where: { id: itemId, companyId },
  });
  if (!item) return false;

  const baseline = effectiveBaselineForSavings(item);
  if (baseline == null || baseline <= 0) return false;
  if (newPrice >= baseline) return false;

  const savings = baseline - newPrice;
  const pct = savings / baseline;
  const thresholdPct = (appConfig.pricing?.priceDropThreshold as number) ?? 0.05;
  const minDollars = (appConfig.pricing?.minimumSavingsAmount as number) ?? 0.5;

  const meetsPct = pct >= thresholdPct;
  const meetsDollars = savings >= minDollars;
  if (!meetsPct && !meetsDollars) return false;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const duplicate = await db.alert.findFirst({
    where: {
      itemId,
      companyId,
      retailer: displayRetailer,
      alertDate: { gte: dayAgo },
      newPrice: { gte: newPrice - 0.02, lte: newPrice + 0.02 },
    },
  });
  if (duplicate) return false;

  const estimatedMonthlySavings = savings * (30 / (item.reorderIntervalDays || 30));

  await db.alert.create({
    data: {
      userId,
      itemId,
      companyId,
      retailer: displayRetailer,
      oldPrice: baseline,
      newPrice,
      priceDropAmount: savings,
      savingsPerOrder: savings,
      estimatedMonthlySavings,
      url: url || '',
      viewed: false,
      seen: false,
      alertDate: new Date(),
    },
  });
  return true;
}
