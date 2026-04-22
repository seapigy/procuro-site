import prisma from '../lib/prisma';
import { computeBestPriceToday } from './bestPriceToday';
import { enabledRetailerProviders } from '../providers/retailerProviders';
import { extractAsin, buildCanonicalProductUrl } from '../utils/amazonIdentity';
import {
  getRetailerMatchesForItem,
  upsertRetailerMatch,
  markMatchChecked,
} from './itemRetailerMatch';
import { normalizeSearchQuery } from './matching/normalize';
import { buildAmazonDiscoveryKeyword, buildAggregateProviderKeyword } from './amazonDiscoveryKeyword';
import { getRetailerVisibility } from './retailerSearchPolicy';
import {
  buildDiscoveryProfileKey,
  getDiscoveryProfile,
  mergeDiscoveryRouting,
  isGlobalDiscoveryProfilesEnabled,
  reinforceDiscoveryFromPriceCheck,
  orderRetailDiscoveryProviders,
} from './discoveryProfile';
import {
  extractHomeDepotProductIdFromUrl,
  buildCanonicalHomeDepotProductUrl,
} from '../utils/homedepotIdentity';

export interface RunPriceCheckResult {
  inserted: number;
  skipped?: boolean;
  quotes: Array<{ retailer: string; url?: string; unitPrice: number; currency: string }>;
  bestDealUnitPrice: number | null;
  bestDealRetailer: string | null;
  bestDealFoundAt: string | null;
  /** True when best quote this run beats previous Item.bestDealUnitPrice. */
  newLowSinceLastCheck?: boolean;
}

function getTodayUtcBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export interface RunPriceCheckOptions {
  /** When true, run discovery even if retailer quotes already exist today (e.g. manual Check price in UI). */
  bypassTodayGuard?: boolean;
}

/**
 * Run price check for an item: call providers, insert quotes, update best deal.
 * Skips provider calls if quotes already exist today (UTC), unless `bypassTodayGuard`.
 */
export async function runPriceCheckForItem(
  companyId: number,
  itemId: number,
  options?: RunPriceCheckOptions
): Promise<RunPriceCheckResult> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, companyId },
  });

  if (!item) {
    throw new Error('Item not found');
  }

  const { start: startOfToday, end: endOfToday } = getTodayUtcBounds();
  const existingToday = await prisma.retailerPriceQuote.findFirst({
    where: {
      companyId,
      itemId,
      capturedAt: { gte: startOfToday, lt: endOfToday },
    },
  });

  if (existingToday && !options?.bypassTodayGuard) {
    const bestResult = await computeBestPriceToday(companyId, itemId);
    let bestDealFoundAt: string | null = null;
    if (bestResult.updated) {
      const itemAfter = await prisma.item.findUnique({
        where: { id: itemId },
        select: { bestDealFoundAt: true },
      });
      bestDealFoundAt = itemAfter?.bestDealFoundAt?.toISOString() ?? null;
    }
    return {
      inserted: 0,
      skipped: true,
      quotes: [],
      bestDealUnitPrice: bestResult.updated ? bestResult.bestUnitPrice ?? null : null,
      bestDealRetailer: bestResult.updated ? bestResult.retailer ?? null : null,
      bestDealFoundAt,
      newLowSinceLastCheck: undefined,
    };
  }

  const allQuotes: Array<{
    retailer: string;
    url?: string;
    unitPrice: number;
    currency: string;
    capturedAt: Date;
    rawJson?: unknown;
  }> = [];

  // Primary: load from ItemRetailerMatch. Fallback: legacy Item fields.
  const retailerMatches = await getRetailerMatchesForItem(itemId, companyId);

  const amazonMatch = retailerMatches.find((m) => m.retailer === 'Amazon');

  const isAmazonDomain = (u: string | null) =>
    typeof u === 'string' &&
    (u.startsWith('https://www.amazon.com') ||
      u.startsWith('https://amazon.com') ||
      u.startsWith('http://www.amazon.com') ||
      u.startsWith('http://amazon.com'));

  // Amazon URL: ItemRetailerMatch first, else legacy Item fields
  const amazonUrl =
    amazonMatch?.productUrl ??
    item.amazonProductUrl ??
    (item.amazonAsin ? `https://www.amazon.com/dp/${item.amazonAsin}` : null) ??
    (isAmazonDomain(item.matchedUrl) ? item.matchedUrl : null) ??
    (isAmazonDomain(item.matchUrl) ? item.matchUrl : null) ??
    (isAmazonDomain(item.manualMatchUrl) ? item.manualMatchUrl : null) ??
    null;
  const isAmazonUrl = typeof amazonUrl === 'string' && isAmazonDomain(amazonUrl);
  // Amazon always uses daily re-discovery (keyword search); never PDP URL fetch
  const skipAmazonSearch = false;

  const DISCOVERY_DEBUG = process.env.DISCOVERY_DEBUG === 'true';
  const AMAZON_DISCOVERY_DEBUG = process.env.AMAZON_DISCOVERY_DEBUG === 'true';

  if (DISCOVERY_DEBUG) {
    console.log(`[discovery] itemId=${itemId} name="${item.name}"`);
    console.log(`[discovery] retailerMatches: ${retailerMatches.length} (Amazon=${!!amazonMatch})`);
    console.log(`[discovery] amazonUrl=${amazonUrl ?? 'null'} isAmazonUrl=${isAmazonUrl} skipAmazonSearch=${skipAmazonSearch}`);
    console.log(`[discovery] path: Amazon=${isAmazonUrl ? 'product-URL-fetch' : skipAmazonSearch ? 'skip' : 'search'}`);
  }

  const prevBestDeal = item.bestDealUnitPrice;
  const visibility = getRetailerVisibility({
    name: item.name,
    category: item.category,
  });

  const profileKey = buildDiscoveryProfileKey({
    name: item.name,
    productBrand: item.productBrand,
    amazonAsin: item.amazonAsin,
  });
  const profileRow =
    isGlobalDiscoveryProfilesEnabled() && profileKey
      ? await getDiscoveryProfile(profileKey)
      : null;

  const mergedRouting = mergeDiscoveryRouting(
    visibility,
    profileRow
      ? {
          hdWinCount: profileRow.hdWinCount,
          amazonWinCount: profileRow.amazonWinCount,
          homeDepotSearchHint: profileRow.homeDepotSearchHint,
          amazonSearchHint: profileRow.amazonSearchHint,
        }
      : null,
    isGlobalDiscoveryProfilesEnabled()
  );

  const amazonDiscoveryKeyword =
    mergedRouting.amazonKeywordOverride ||
    buildAmazonDiscoveryKeyword({
      name: item.name,
      productBrand: item.productBrand,
      amazonSearchHint: item.amazonSearchHint,
      amazonAsin: item.amazonAsin,
    });
  /** Brand + hint + name, no ASIN — same recipe as `buildAggregateProviderKeyword` (non-Amazon discovery). */
  const homeDepotDiscoveryKeyword =
    mergedRouting.homeDepotKeywordOverride ||
    buildAggregateProviderKeyword({
      name: item.name,
      productBrand: item.productBrand,
      amazonSearchHint: item.amazonSearchHint,
      amazonAsin: item.amazonAsin,
    });

  const providersOrdered = orderRetailDiscoveryProviders(
    enabledRetailerProviders,
    mergedRouting.prefersHomeDepotFirst
  );

  const skipAmazonAfterHd =
    process.env.DISCOVERY_SKIP_AMAZON_AFTER_HD?.trim().toLowerCase() === 'true';

  if (DISCOVERY_DEBUG) {
    console.log(
      `[discovery] retailer policy: amazon=${visibility.amazon} homeDepot=${visibility.homeDepot}` +
        ` prefersHdFirst=${mergedRouting.prefersHomeDepotFirst}` +
        (visibility.reason ? ` reason=${visibility.reason}` : '')
    );
    if (profileKey && profileRow) {
      console.log(
        `[discovery] global profile key=${profileKey.slice(0, 12)}… hdWins=${profileRow.hdWinCount} amzWins=${profileRow.amazonWinCount}`
      );
    }
  }

  const policyHint = visibility.reason ? ` (${visibility.reason})` : '';
  console.log(
    `[priceCheck] item ${itemId} "${item.name.slice(0, 80)}${item.name.length > 80 ? '…' : ''}" → policy: Amazon=${visibility.amazon} HomeDepot=${visibility.homeDepot} prefHdFirst=${mergedRouting.prefersHomeDepotFirst}${policyHint}`
  );

  let hdReturnedQuotesThisRun = false;

  for (const provider of providersOrdered) {
    if (skipAmazonSearch && provider.name === 'Amazon') {
      console.log(`[priceCheck] Skip Amazon — search disabled for this item`);
      continue;
    }
    if (!visibility.amazon && provider.name === 'Amazon') {
      console.log(`[priceCheck] Skip Amazon — excluded by item name/category policy`);
      continue;
    }
    if (!visibility.homeDepot && provider.name === 'Home Depot') {
      console.log(`[priceCheck] Skip Home Depot — excluded by item name/category policy`);
      continue;
    }
    if (
      skipAmazonAfterHd &&
      hdReturnedQuotesThisRun &&
      provider.name === 'Amazon'
    ) {
      console.log(`[priceCheck] Skip Amazon — DISCOVERY_SKIP_AMAZON_AFTER_HD`);
      continue;
    }
    const searchQuery =
      provider.name === 'Amazon'
        ? amazonDiscoveryKeyword
        : provider.name === 'Home Depot'
          ? homeDepotDiscoveryKeyword
          : normalizeSearchQuery(item.name);
    console.log(`[priceCheck] Running ${provider.name} search (query="${searchQuery}")`);
    if (DISCOVERY_DEBUG) {
      console.log(`[discovery] Running SEARCH for ${provider.name} (query="${searchQuery}" from "${item.name}")`);
    }
    try {
      const quotes = await provider.getQuotesForItem({
        companyId,
        itemId: item.id,
        name: searchQuery,
        matchItemName:
          provider.name === 'Amazon' || provider.name === 'Home Depot' ? item.name : undefined,
        lastPaidPrice: item.lastPaidPrice ?? undefined,
      });
      const byRetailer = quotes.reduce(
        (acc, q) => {
          acc[q.retailer] = (acc[q.retailer] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      const breakdown = Object.entries(byRetailer)
        .map(([r, n]) => `${r}: ${n}`)
        .join(', ');
      console.log(
        `[priceCheck] ${provider.name} finished — ${quotes.length} quote(s)${breakdown ? ` (${breakdown})` : ''}`
      );
      if (
        provider.name === 'Home Depot' &&
        quotes.some((q) => q.unitPrice > 0 && q.unitPrice < 100000)
      ) {
        hdReturnedQuotesThisRun = true;
      }
      if (DISCOVERY_DEBUG && quotes.length > 0) {
        quotes.forEach((q, i) => {
          const raw = q.rawJson as Record<string, unknown> | undefined;
          const asin = raw?.asin ?? raw?.product_id ?? raw?.us_item_id ?? raw?.item_id ?? '?';
          console.log(`[discovery] ${provider.name} candidate ${i + 1}: title=${(raw?.title ?? raw?.name ?? q.url ?? '?')} price=${q.unitPrice} url=${q.url ?? 'null'} id=${asin}`);
        });
      }

      for (const q of quotes) {
        if (q.unitPrice <= 0 || q.unitPrice >= 100000) continue;
        allQuotes.push({
          retailer: q.retailer,
          url: q.url,
          unitPrice: q.unitPrice,
          currency: q.currency || 'USD',
          capturedAt: q.capturedAt || new Date(),
          rawJson: q.rawJson,
        });
      }
    } catch (err) {
      console.warn(`[priceCheck] ${provider.name} failed for item ${itemId}:`, err);
    }
  }

  await reinforceDiscoveryFromPriceCheck({
    key: profileKey,
    hadHomeDepotQuotes: allQuotes.some((q) => q.retailer === 'Home Depot'),
    hadAmazonQuotes: allQuotes.some((q) => q.retailer === 'Amazon'),
    homeDepotKeyword: homeDepotDiscoveryKeyword,
    amazonKeyword: amazonDiscoveryKeyword,
  });

  const retailersInQuotes = [...new Set(allQuotes.map((q) => q.retailer))];
  console.log(
    `[priceCheck] item ${itemId} done — ${allQuotes.length} valid quote(s) total; retailers: ${retailersInQuotes.length ? retailersInQuotes.join(', ') : 'none'}`
  );

  // Auto-persist Amazon identity when Bright Data returns real product row
  // Writes to ItemRetailerMatch (primary) and syncs legacy Item fields
  const amazonQuote = allQuotes.find(
    (q) =>
      q.retailer === 'Amazon' &&
      q.rawJson &&
      typeof q.rawJson === 'object' &&
      !(q.rawJson as Record<string, unknown>).source
  );
  if (amazonQuote?.rawJson && typeof amazonQuote.rawJson === 'object') {
    const raw = amazonQuote.rawJson as Record<string, unknown>;
    const asinStr = extractAsin(raw, amazonQuote.url);
    const canonicalUrl = buildCanonicalProductUrl(asinStr);
    const shouldPersist = asinStr || canonicalUrl;
    if (shouldPersist) {
      await upsertRetailerMatch(itemId, companyId, 'Amazon', {
        retailerProductId: asinStr ?? null,
        productUrl: canonicalUrl ?? null,
      });
      console.log(
        `[priceCheck] Amazon identity auto-persisted for item ${itemId}: asin=${asinStr ?? '-'} url=${canonicalUrl ?? '-'}`
      );
      if (AMAZON_DISCOVERY_DEBUG || DISCOVERY_DEBUG) {
        console.log(`  [Amazon] ItemRetailerMatch UPDATED: retailerProductId=${asinStr} productUrl=${canonicalUrl}`);
      }
    }
  }

  const homeDepotQuote = allQuotes.find(
    (q) =>
      q.retailer === 'Home Depot' &&
      q.rawJson &&
      typeof q.rawJson === 'object' &&
      !(q.rawJson as Record<string, unknown>).source
  );
  if (homeDepotQuote?.url) {
    const raw = homeDepotQuote.rawJson as Record<string, unknown>;
    const fromUrl = extractHomeDepotProductIdFromUrl(homeDepotQuote.url);
    const fromRow =
      typeof raw.item_id === 'string' && /^\d{6,12}$/.test(raw.item_id)
        ? raw.item_id
        : typeof raw.product_id === 'string' && /^\d{6,12}$/.test(raw.product_id)
          ? raw.product_id
          : null;
    const productId = fromUrl ?? fromRow;
    const canonicalUrl = buildCanonicalHomeDepotProductUrl(productId) ?? homeDepotQuote.url;
    if (productId || canonicalUrl) {
      await upsertRetailerMatch(itemId, companyId, 'Home Depot', {
        retailerProductId: productId ?? null,
        productUrl: canonicalUrl ?? null,
      });
      console.log(
        `[priceCheck] Home Depot identity auto-persisted for item ${itemId}: productId=${productId ?? '-'} url=${canonicalUrl ?? '-'}`
      );
    }
  }

  const toInsert = allQuotes.map(q => ({
    companyId,
    itemId,
    retailer: q.retailer,
    url: q.url ?? null,
    unitPrice: q.unitPrice,
    currency: q.currency,
    capturedAt: q.capturedAt,
    rawJson: q.rawJson != null && typeof q.rawJson === 'object' ? q.rawJson : undefined,
  }));

  if (toInsert.length > 0) {
    await prisma.retailerPriceQuote.createMany({ data: toInsert });
    if (AMAZON_DISCOVERY_DEBUG) {
      const amazonInserted = toInsert.filter((r) => r.retailer === 'Amazon');
      if (amazonInserted.length > 0) {
        console.log(`  [Amazon] RetailerPriceQuote WRITTEN: ${amazonInserted.length} row(s) for itemId=${itemId}`);
        amazonInserted.forEach((q) => {
          console.log(`    - retailer=Amazon unitPrice=${q.unitPrice} url=${q.url ?? 'null'}`);
        });
      }
    }
  }

  const bestResult = await computeBestPriceToday(companyId, itemId);

  let bestDealFoundAt: string | null = null;
  if (bestResult.updated) {
    const itemAfter = await prisma.item.findUnique({
      where: { id: itemId },
      select: { bestDealFoundAt: true },
    });
    bestDealFoundAt = itemAfter?.bestDealFoundAt?.toISOString() ?? null;
  }

  let minQuoteThisRun: number | null = null;
  for (const q of allQuotes) {
    if (q.unitPrice > 0 && q.unitPrice < 100000) {
      if (minQuoteThisRun == null || q.unitPrice < minQuoteThisRun) minQuoteThisRun = q.unitPrice;
    }
  }
  const newLowSinceLastCheck =
    minQuoteThisRun != null &&
    prevBestDeal != null &&
    prevBestDeal > 0 &&
    minQuoteThisRun < prevBestDeal;

  return {
    inserted: toInsert.length,
    quotes: allQuotes.map(q => ({
      retailer: q.retailer,
      url: q.url,
      unitPrice: q.unitPrice,
      currency: q.currency,
    })),
    bestDealUnitPrice: bestResult.updated ? bestResult.bestUnitPrice ?? null : null,
    bestDealRetailer: bestResult.updated ? bestResult.retailer ?? null : null,
    bestDealFoundAt,
    newLowSinceLastCheck: newLowSinceLastCheck || undefined,
  };
}
