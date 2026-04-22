/**
 * Home Depot Bright Data: uses the same discovery matcher as Amazon — selectCheapestValidDiscoveryCandidate
 * (0.6 × attributeScore + 0.4 × legacy scoreCandidate, confidence bands, product family, hard filters,
 * normalized unit price ordering, tie-breakers). Rows are mapped to a common shape for extractProductAttributes.
 */

import type { RetailerQuote } from '../types/retailer';
import { selectCheapestValidDiscoveryCandidate, extractUrl } from './brightDataAmazonParse';
import { getAmazonMatchSearchDepths } from '../config/brightData';

const HOMEDEPOT_BASE = 'https://www.homedepot.com';

/** Set `HOME_DEPOT_DISCOVERY_DEBUG=true` for matcher parity logging. */
const HD_MATCH_DEBUG = process.env.HOME_DEPOT_DISCOVERY_DEBUG === 'true';

export type HomeDepotMatchContext = {
  matchItemName?: string;
  discoveryQuery: string;
  lastPaidPrice?: number | null;
};

/** Map Home Depot dataset rows so extractProductAttributes / title paths match Amazon-style fields. */
export function mapHomeDepotRowForMatcher(row: Record<string, unknown>): Record<string, unknown> {
  const productName = String(row.product_name ?? row.title ?? row.name ?? '').trim();
  const manufacturer = String(row.manufacturer ?? row.brand ?? '').trim();
  const title = [manufacturer, productName].filter(Boolean).join(' ').trim() || productName;

  const tree = row.category_tree;
  const categoriesFromTree =
    Array.isArray(tree) && tree.length > 0
      ? (tree as Array<{ name?: string }>).map((c) => c?.name).filter(Boolean).map(String)
      : [];
  const productCategory = typeof row.product_category === 'string' ? row.product_category : '';
  const categoriesFromPath =
    productCategory.length > 0 ? productCategory.split('>').map((s) => s.trim()).filter(Boolean) : [];
  const categories =
    categoriesFromTree.length > 0 ? categoriesFromTree : categoriesFromPath.length > 0 ? categoriesFromPath : row.categories;

  return {
    ...row,
    title,
    name: title,
    product_title: productName,
    brand: manufacturer || row.brand,
    description: (row.description as string) ?? '',
    product_details: row.product_details ?? row.details,
    features: row.features,
    categories: categories ?? row.categories,
  };
}

export function extractHdProductUrl(row: Record<string, unknown>): string | null {
  const urlFields = ['url', 'product_url', 'productUrl', 'canonicalUrl', 'link', 'href'];
  for (const field of urlFields) {
    const val = row[field];
    if (typeof val === 'string' && val.startsWith('http')) return val;
    if (typeof val === 'string' && val.startsWith('/')) return `${HOMEDEPOT_BASE}${val}`;
  }
  const pid = row.product_id;
  if (typeof pid === 'string' && /^\d{5,12}$/.test(pid)) {
    return `${HOMEDEPOT_BASE}/p/${pid}`;
  }
  return null;
}

function parseBestPriceOnly(rows: unknown[]): RetailerQuote[] {
  let best: Record<string, unknown> | null = null;
  let minPrice: number | null = null;
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    const pr = row.final_price ?? row.price ?? row.current_price;
    let price: number | null = null;
    if (typeof pr === 'number' && pr > 0 && pr < 100000) price = pr;
    else if (typeof pr === 'string') {
      const p = parseFloat(pr.replace(/[^0-9.]/g, ''));
      if (!isNaN(p) && p > 0 && p < 100000) price = p;
    }
    if (price == null) continue;
    if (minPrice == null || price < minPrice) {
      minPrice = price;
      best = row;
    }
  }
  if (best == null || minPrice == null) return [];
  const url = extractHdProductUrl(best);
  if (!url) return [];
  return [
    {
      retailer: 'Home Depot',
      url,
      unitPrice: minPrice,
      currency: 'USD',
      capturedAt: new Date(),
      rawJson: best,
    },
  ];
}

function toRecordRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.filter((r): r is Record<string, unknown> => r != null && typeof r === 'object' && !Array.isArray(r));
}

/**
 * Same matcher stack as Amazon discovery (selectCheapestValidDiscoveryCandidate), including depth escalation.
 */
export function matchHomeDepotRowsToQuotes(rows: unknown[], ctx: HomeDepotMatchContext): RetailerQuote[] {
  const q = ctx.discoveryQuery.trim();
  const itemName = (ctx.matchItemName?.trim() || q || 'item').trim();

  const isPdpUrlOnly = /^https?:\/\//i.test(q) && !ctx.matchItemName?.trim();
  if (isPdpUrlOnly) {
    return parseBestPriceOnly(rows);
  }

  const mapped = toRecordRows(rows).map(mapHomeDepotRowForMatcher);
  if (mapped.length === 0) return [];

  const urlKey = q || itemName;
  const fallbackUrl = `${HOMEDEPOT_BASE}/s/${encodeURIComponent(urlKey)}`;
  const lastPaid = ctx.lastPaidPrice ?? undefined;
  const { defaultDepth, escalationDepth } = getAmazonMatchSearchDepths();
  const hdOpts = { candidateRetailer: 'Home Depot' as const };

  let parsed = selectCheapestValidDiscoveryCandidate(
    itemName,
    mapped,
    fallbackUrl,
    lastPaid,
    false,
    defaultDepth,
    hdOpts
  );

  const pass1 = Math.min(mapped.length, defaultDepth);

  if (parsed && parsed.bestRow && !parsed.needsReview) {
    if (HD_MATCH_DEBUG) {
      console.log(`[HomeDepotMatch] records processed: ${pass1} (no escalation)`);
    }
  } else {
    const shouldEscalate = !parsed || !parsed.bestRow || parsed.needsReview;
    if (shouldEscalate && mapped.length > defaultDepth) {
      parsed = selectCheapestValidDiscoveryCandidate(
        itemName,
        mapped,
        fallbackUrl,
        lastPaid,
        false,
        escalationDepth,
        hdOpts
      );
      if (HD_MATCH_DEBUG) {
        console.log(
          `[HomeDepotMatch] records processed: ${pass1} -> ${Math.min(mapped.length, escalationDepth)} (escalation)`
        );
      }
    } else if (HD_MATCH_DEBUG) {
      console.log(`[HomeDepotMatch] records processed: ${pass1} (escalation: no — not enough rows or no-op)`);
    }
  }

  if (!parsed?.bestRow && lastPaid != null && lastPaid > 0) {
    parsed = selectCheapestValidDiscoveryCandidate(
      itemName,
      mapped,
      fallbackUrl,
      undefined,
      false,
      escalationDepth,
      hdOpts
    );
    if (HD_MATCH_DEBUG) {
      console.log('[HomeDepotMatch] retry without lastPaidPrice (fail-open)');
    }
  }

  if (!parsed?.bestRow) return [];

  const { bestRow, minPrice } = parsed;
  const url = extractHdProductUrl(bestRow) ?? extractUrl(bestRow, fallbackUrl);

  if (HD_MATCH_DEBUG) {
    const t = (bestRow.title ?? bestRow.product_name ?? bestRow.name ?? '').toString().slice(0, 80);
    console.log(
      `[HomeDepotMatch] SELECTED price=$${minPrice.toFixed(2)} score=${parsed.score.toFixed(2)} product_id=${bestRow.product_id ?? '-'} title=${t}`
    );
    if (parsed.needsReview) console.log('[HomeDepotMatch] NEEDS_REVIEW: medium-confidence');
  }

  return [
    {
      retailer: 'Home Depot',
      url,
      unitPrice: minPrice,
      currency: 'USD',
      capturedAt: new Date(),
      rawJson: bestRow,
    },
  ];
}
