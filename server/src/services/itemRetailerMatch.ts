/**
 * ItemRetailerMatch service - multi-retailer architecture.
 *
 * Long-term target:
 * - Load retailer matches from ItemRetailerMatch
 * - Check each active retailer match
 * - Compare prices across all matched retailers
 *
 * Existing Item fields (amazonAsin, etc.) remain for backward
 * compatibility during migration. This service provides the new path.
 */

import prisma from '../lib/prisma';

export interface RetailerMatchForCheck {
  retailer: string;
  retailerProductId: string | null;
  productUrl: string | null;
  matchId: number;
}

/**
 * Load active retailer matches for an item.
 * Prefers ItemRetailerMatch; falls back to legacy Item fields when no matches exist.
 */
export async function getRetailerMatchesForItem(
  itemId: number,
  companyId: number
): Promise<RetailerMatchForCheck[]> {
  const matches = await prisma.itemRetailerMatch.findMany({
    where: { itemId, companyId, isActive: true },
    select: {
      id: true,
      retailer: true,
      retailerProductId: true,
      productUrl: true,
    },
  });

  if (matches.length > 0) {
    return matches.map((m) => ({
      retailer: m.retailer,
      retailerProductId: m.retailerProductId,
      productUrl: m.productUrl,
      matchId: m.id,
    }));
  }

  // Fallback: derive from legacy Item fields (backward compatibility)
  const item = await prisma.item.findFirst({
    where: { id: itemId, companyId },
    select: {
      amazonAsin: true,
      amazonProductUrl: true,
    },
  });
  if (!item) return [];

  const legacy: RetailerMatchForCheck[] = [];
  if (item.amazonAsin || item.amazonProductUrl) {
    const url =
      item.amazonProductUrl ||
      (item.amazonAsin ? `https://www.amazon.com/dp/${item.amazonAsin}` : null);
    legacy.push({
      retailer: 'Amazon',
      retailerProductId: item.amazonAsin ?? null,
      productUrl: url,
      matchId: -1, // no ItemRetailerMatch row
    });
  }
  return legacy;
}

/**
 * Update lastCheckedAt for an ItemRetailerMatch.
 */
export async function markMatchChecked(matchId: number): Promise<void> {
  if (matchId <= 0) return;
  await prisma.itemRetailerMatch.update({
    where: { id: matchId },
    data: { lastCheckedAt: new Date() },
  });
}

/**
 * Upsert ItemRetailerMatch when auto-persisting retailer identity.
 * Also syncs legacy Item fields for backward compatibility.
 */
export async function upsertRetailerMatch(
  itemId: number,
  companyId: number,
  retailer: string,
  data: {
    retailerProductId: string | null;
    productUrl: string | null;
  }
): Promise<void> {
  const matchedAt = new Date();
  await prisma.itemRetailerMatch.upsert({
    where: { itemId_retailer: { itemId, retailer } },
    create: {
      itemId,
      companyId,
      retailer,
      retailerProductId: data.retailerProductId,
      productUrl: data.productUrl,
      matchedAt,
      isActive: true,
    },
    update: {
      retailerProductId: data.retailerProductId ?? undefined,
      productUrl: data.productUrl ?? undefined,
      matchedAt,
    },
  });

  // Sync legacy Item fields for backward compatibility
  if (retailer === 'Amazon' && (data.retailerProductId || data.productUrl)) {
    await prisma.item.update({
      where: { id: itemId },
      data: {
        ...(data.retailerProductId ? { amazonAsin: data.retailerProductId } : {}),
        ...(data.productUrl ? { amazonProductUrl: data.productUrl } : {}),
        amazonMatchedAt: matchedAt,
      },
    });
  }
}
