/**
 * Shared parsing logic for Bright Data Amazon dataset rows.
 * Commerce matching: required/preferred attributes, confidence bands, category templates.
 * Selects cheapest HIGH-CONFIDENCE valid candidate within product family.
 */

import {
  extractItemAttributes,
  extractProductAttributes,
  hardFilterReject,
  attributeScore,
  getConfidenceBand,
  isInProductFamily,
} from '../services/matching/attributes';
import { inferBrandFromItemName } from '../services/matching/brandInference';
import { getCategoryTemplate, getMatchRequirements, buildProductFamily, computeNormalizedPrice } from '../services/matching/categoryTemplates';
import type { CandidateDebugView, RejectionReason } from '../services/matching/types';
import { normalizeItemName } from '../services/matching/normalize';
import { scoreCandidate, type Candidate } from '../services/matching/score';
import { hasNegativeKeyword, detectBundleReplacementRenewed, itemImpliesBundleReplacementRenewed } from '../services/matching/synonyms';
import { getAmazonMatchSearchDepths } from '../config/brightData';
import { normalizePrice } from '../services/brightData';

/** @deprecated Use getAmazonMatchSearchDepths() from ../config/brightData — env BRIGHTDATA_AMAZON_MATCH_DEPTH */
export const DEFAULT_SEARCH_DEPTH = 20;
/** @deprecated Use getAmazonMatchSearchDepths() — env BRIGHTDATA_AMAZON_MATCH_DEPTH_ESCALATION */
export const ESCALATION_SEARCH_DEPTH = 50;
/** Max candidates to keep after confidence filter (before price sort). */
const MAX_CANDIDATES_AFTER_FILTER = 10;

/** Parse a numeric price from various formats. */
function parsePrice(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && value > 0 && value < 100000) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed) && parsed > 0 && parsed < 100000) return parsed;
  }
  return null;
}

export function extractPrice(row: Record<string, unknown>): number | null {
  const buybox = row.buybox_prices ?? row.buyboxPrices;
  if (buybox && typeof buybox === 'object' && !Array.isArray(buybox)) {
    const bp = buybox as Record<string, unknown>;
    const p = parsePrice(bp.final_price ?? bp.finalPrice ?? bp.price);
    if (p != null) return p;
  }
  // Home Depot / mixed datasets: current_price, offer_price, nested pricing (see normalizePrice)
  const normalized = normalizePrice(row);
  if (normalized != null) return normalized;
  const priceFields = [
    'final_price',
    'finalPrice',
    'price',
    'unit_price',
    'unitPrice',
    'initial_price',
    'initialPrice',
    'price_amount',
    'priceAmount',
  ];
  for (const field of priceFields) {
    const p = parsePrice(row[field]);
    if (p != null) return p;
  }
  return null;
}

/** Build amazonDebug for a candidate. */
function buildAmazonDebug(
  row: Record<string, unknown>,
  productAttrs: ReturnType<typeof extractProductAttributes>,
  rejection: RejectionReason | null,
  itemName: string
): CandidateDebugView['amazonDebug'] {
  const productText = [
    (row.title as string) ?? '',
    (row.product_name as string) ?? '',
    (row.description as string) ?? '',
    flattenRowField(row.product_details),
    flattenRowField(row.features),
  ].join(' ');
  const bundleDetected = detectBundleReplacementRenewed(productText);
  const categoriesDept = [
    ...(Array.isArray(row.categories) ? row.categories.map(String) : row.categories ? [String(row.categories)] : []),
    row.department ? String(row.department) : '',
  ].filter(Boolean).join(' > ');
  let availability: string | boolean | undefined;
  const ia = row.is_available ?? row.availability;
  if (typeof ia === 'boolean') availability = ia;
  else if (typeof ia === 'string') availability = ia;
  else availability = undefined;

  const out: CandidateDebugView['amazonDebug'] = {
    brand: productAttrs.brand ?? (row.brand as string) ?? undefined,
    model_number: productAttrs.model ?? (row.model_number as string) ?? undefined,
    categoriesDeptSummary: categoriesDept || undefined,
    chosenPriceField: getChosenPriceField(row),
    availability,
    amazon_prime: row.amazon_prime === true || (typeof row.amazon_prime === 'string' && /true|yes/i.test(row.amazon_prime)),
    bundleReplacementRenewedDetected: bundleDetected,
    matchOrRejectReason: rejection ? `${rejection.code}: ${rejection.detail}` : 'matched',
  };
  if (productAttrs.category === 'monitor' && productAttrs.length) {
    out.monitorSizeSource = productAttrs.screenSizeFromTitle ? 'screen_size_from_title' : 'product_dimensions';
    out.monitorScreenSize = `${productAttrs.length.value} ${productAttrs.length.unit}`;
  }
  return out;
}

/** Return which price field was used (for debug). */
function getChosenPriceField(row: Record<string, unknown>): string {
  const buybox = row.buybox_prices ?? row.buyboxPrices;
  if (buybox && typeof buybox === 'object' && !Array.isArray(buybox)) {
    const bp = buybox as Record<string, unknown>;
    if (parsePrice(bp.final_price) != null) return 'buybox_prices.final_price';
    if (parsePrice(bp.finalPrice) != null) return 'buybox_prices.finalPrice';
    if (parsePrice(bp.price) != null) return 'buybox_prices.price';
  }
  const priceFields = ['final_price', 'finalPrice', 'price', 'unit_price', 'unitPrice', 'initial_price', 'initialPrice'];
  for (const field of priceFields) {
    if (parsePrice(row[field]) != null) return field;
  }
  return 'unknown';
}

export function extractUrl(row: Record<string, unknown>, fallbackUrl: string): string {
  const urlFields = ['url', 'product_url', 'productUrl', 'link', 'href'];
  for (const field of urlFields) {
    const val = row[field];
    if (typeof val === 'string' && val.startsWith('http')) return val;
  }
  return fallbackUrl;
}

export function extractBrand(row: Record<string, unknown>): string | null {
  const val = row.brand ?? row.Brand ?? row.brand_name ?? row.brandName;
  if (typeof val === 'string' && val.trim()) return val.trim();
  return null;
}

export function parseBestRowFromRows(
  rows: unknown[],
  fallbackUrl: string
): { bestRow: Record<string, unknown>; minPrice: number } | null {
  let bestRow: Record<string, unknown> | null = null;
  let minPrice: number | null = null;

  for (const row of rows) {
    if (row && typeof row === 'object') {
      const price = extractPrice(row as Record<string, unknown>);
      if (price != null && (minPrice == null || price < minPrice)) {
        minPrice = price;
        bestRow = row as Record<string, unknown>;
      }
    }
  }

  if (bestRow == null || minPrice == null) return null;
  return { bestRow, minPrice };
}

function flattenRowField(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(String).join(' ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/** Tie-breaker score for ranking when normalized price is equal. Higher = better. */
function getRankingTieBreakerScore(row: Record<string, unknown>): number {
  let score = 0;
  const isAvailable = row.is_available ?? row.isAvailable;
  if (isAvailable === true || (typeof isAvailable === 'string' && /true|yes|in stock/i.test(isAvailable))) score += 2;
  const availability = row.availability;
  if (typeof availability === 'string' && /in stock|available/i.test(availability.toLowerCase())) score += 1;
  const prime = row.amazon_prime ?? row.amazonPrime;
  if (prime === true || (typeof prime === 'string' && /true|yes/i.test(prime))) score += 1;
  const rating = row.rating;
  if (typeof rating === 'number' && rating > 0) score += rating * 0.5;
  else if (typeof rating === 'string') {
    const r = parseFloat(rating);
    if (!isNaN(r) && r > 0) score += r * 0.5;
  }
  const starRating = row.star_rating ?? row.starRating;
  if (typeof starRating === 'number' && starRating > 0) score += starRating * 0.15;
  else if (typeof starRating === 'string') {
    const sr = parseFloat(starRating);
    if (!isNaN(sr) && sr > 0) score += sr * 0.15;
  }
  if (row.in_stock === true || (typeof row.in_stock === 'string' && /true|yes/i.test(row.in_stock))) {
    score += 1.5;
  }
  const reviews = row.reviews_count ?? row.reviewsCount;
  if (typeof reviews === 'number' && reviews > 0) score += Math.min(1, Math.log10(reviews + 1) * 0.3);
  if (row.sponsored === true || (typeof row.sponsored === 'string' && /true|yes/i.test(row.sponsored))) score -= 0.5;
  return score;
}

/** Only high-confidence candidates can auto-win. */
const HIGH_CONFIDENCE_MIN = 0.75;

/** When true, log detailed candidate scores and rejection reasons for Amazon discovery. */
const AMAZON_DISCOVERY_DEBUG = process.env.AMAZON_DISCOVERY_DEBUG === 'true';

/**
 * Select best Amazon candidate using scoring: title similarity, brand match (e.g. HP),
 * sheet count/size match, valid price.
 */
export function selectBestAmazonCandidate(
  itemName: string,
  rows: Record<string, unknown>[],
  fallbackUrl: string,
  lastPaidPrice?: number
): { bestRow: Record<string, unknown>; minPrice: number; score: number } | null {
  const itemMeta = normalizeItemName(itemName);
  const candidates: Array<{ row: Record<string, unknown>; candidate: Candidate; scoreResult: { score: number } }> = [];

  for (const row of rows) {
    const price = extractPrice(row);
    if (price == null || price <= 0 || price >= 100000) continue;

    const title =
      (row.title as string) ??
      (row.name as string) ??
      (row.product_title as string) ??
      (row.product_name as string) ??
      '';
    const url = extractUrl(row, fallbackUrl);

    const candidate: Candidate = {
      title,
      price,
      url,
      retailer: 'Amazon',
    };

    const scoreResult = scoreCandidate(itemMeta, candidate, lastPaidPrice);
    candidates.push({ row, candidate, scoreResult });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.scoreResult.score - a.scoreResult.score);
  const best = candidates[0];
  return {
    bestRow: best.row,
    minPrice: best.candidate.price,
    score: best.scoreResult.score,
  };
}

/**
 * Select cheapest HIGH-CONFIDENCE valid candidate within product family.
 * Same pipeline for Amazon and Home Depot Bright Data rows: attribute + legacy score (0.6/0.4),
 * confidence bands, normalized unit price sort.
 * @param maxDepth - Max records to process (default from BRIGHTDATA_AMAZON_MATCH_DEPTH).
 */
export function selectCheapestValidDiscoveryCandidate(
  itemName: string,
  rows: Record<string, unknown>[],
  fallbackUrl: string,
  lastPaidPrice?: number,
  returnDebugViews?: boolean,
  maxDepth: number = getAmazonMatchSearchDepths().defaultDepth,
  options?: { candidateRetailer?: 'Amazon' | 'Home Depot' }
): {
  bestRow: Record<string, unknown>;
  minPrice: number;
  normalizedUnitPrice?: number;
  normalizedUnitType?: string;
  score: number;
  validCount: number;
  needsReview: boolean;
  debugViews?: CandidateDebugView[];
} | null {
  const candidateRetailer = options?.candidateRetailer ?? 'Amazon';
  const itemAttrs = extractItemAttributes(itemName);
  const template = getCategoryTemplate(itemAttrs.category);
  const requirements = getMatchRequirements(itemAttrs, template);
  const productFamily = buildProductFamily(itemAttrs);

  const evaluated: Array<{
    row: Record<string, unknown>;
    candidate: Candidate;
    itemAttrs: typeof itemAttrs;
    productAttrs: ReturnType<typeof extractProductAttributes>;
    rejection: RejectionReason | null;
    attrScore: number;
    legacyScore: number;
    combinedScore: number;
    scoreReasons: Record<string, number>;
    confidenceBand: 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'rejected';
  }> = [];

  const rowsToProcess = rows.slice(0, maxDepth);

  for (const row of rowsToProcess) {
    const price = extractPrice(row);
    if (price == null || price <= 0 || price >= 100000) continue;

    const title =
      (row.title as string) ??
      (row.name as string) ??
      (row.product_title as string) ??
      (row.product_name as string) ??
      '';
    const url = extractUrl(row, fallbackUrl);
    const candidate: Candidate = { title, price, url, retailer: candidateRetailer };
    const productAttrs = extractProductAttributes(row);

    let rejection: RejectionReason | null = null;

    if (hasNegativeKeyword(title, itemAttrs.category)) {
      rejection = { code: 'negative_keyword', detail: 'product title contains refill/accessory/mount/cable/stand/replacement/sample/adapter' };
    }
    if (!rejection) {
      const productText = [
        title,
        (row.description as string) ?? '',
        flattenRowField(row.product_details),
        flattenRowField(row.features),
      ].join(' ');
      const bundleReplacement = detectBundleReplacementRenewed(productText);
      if (bundleReplacement && !itemImpliesBundleReplacementRenewed(itemName)) {
        const imNorm = itemAttrs.model?.toLowerCase().replace(/[-_\s]/g, '') ?? '';
        const pmNorm = (productAttrs.model ?? '').toLowerCase().replace(/[-_\s]/g, '');
        const exactModelMatch = imNorm && pmNorm && (imNorm === pmNorm || pmNorm.includes(imNorm) || imNorm.includes(pmNorm));
        const allowRenewedFallback = itemAttrs.category === 'monitor' && exactModelMatch && /^(renewed|refurbished)$/i.test(bundleReplacement);
        if (!allowRenewedFallback) {
          rejection = { code: 'bundle_replacement_renewed', detail: `product indicates ${bundleReplacement} but item does not` };
        }
      }
    }
    if (!rejection && !isInProductFamily(itemAttrs, productAttrs, title)) {
      rejection = { code: 'outside_product_family', detail: 'product outside item product family' };
    }
    if (!rejection) {
      rejection = hardFilterReject(itemAttrs, productAttrs, title, requirements.required);
    }
    if (!rejection) {
      const itemMeta = normalizeItemName(itemName);
      const legacyResult = scoreCandidate(itemMeta, candidate, lastPaidPrice ?? undefined);
      if (legacyResult.reasons.priceRatio === 0) {
        rejection = { code: 'price_sanity_mismatch', detail: 'price >3x or <0.33x lastPaidPrice' };
      }
    }

    const { score: attrScore, reasons: scoreReasons } = attributeScore(itemAttrs, productAttrs, title, itemName);
    const itemMeta = normalizeItemName(itemName);
    const legacyResult = scoreCandidate(itemMeta, candidate, lastPaidPrice ?? undefined);
    const legacyScore = legacyResult.score;
    const combinedScore = 0.6 * attrScore + 0.4 * legacyScore;

    const confidenceBand = rejection ? 'rejected' : getConfidenceBand(combinedScore, null);
    const scoreTooLow = combinedScore < 0.5;
    const finalRejection = rejection ?? (scoreTooLow ? { code: 'score_too_low' as const, detail: `score ${combinedScore.toFixed(2)} < 0.5` } : null);

    evaluated.push({
      row,
      candidate,
      itemAttrs: { ...itemAttrs },
      productAttrs: { ...productAttrs },
      rejection: finalRejection,
      attrScore,
      legacyScore,
      combinedScore,
      scoreReasons,
      confidenceBand: finalRejection ? 'rejected' : confidenceBand,
    });
  }

  const highConfidence = evaluated.filter((e) => e.confidenceBand === 'high_confidence');
  const mediumConfidence = evaluated.filter((e) => e.confidenceBand === 'medium_confidence');
  let valid = highConfidence.length > 0 ? highConfidence : mediumConfidence;
  valid = valid.slice(0, MAX_CANDIDATES_AFTER_FILTER);
  const needsReview = highConfidence.length === 0 || (valid.length > 0 && valid[0].confidenceBand === 'medium_confidence');

  if (AMAZON_DISCOVERY_DEBUG) {
    console.log('\n--- [Match] Candidate Debug View ---');
    console.log('Item:', itemName);
    console.log('Product family:', JSON.stringify(productFamily));
    console.log('Required attrs:', requirements.required);
    console.log('Preferred attrs:', requirements.preferred);
    console.log('Price basis:', template?.priceBasis ?? 'each');
    evaluated.slice(0, 20).forEach((e, i) => {
      const r = e.rejection ? `REJECTED: ${e.rejection.code} - ${e.rejection.detail}` : e.confidenceBand;
      const rowId = e.row.asin ?? e.row.product_id ?? '-';
      console.log(`  ${i + 1}. ${rowId} | $${e.candidate.price} | ${r}`);
      console.log('    title:', e.candidate.title.slice(0, 70) + (e.candidate.title.length > 70 ? '...' : ''));
      if (e.rejection) console.log('    ', e.rejection.code, e.rejection.detail);
      console.log('    scoreBreakdown:', e.scoreReasons, 'combined:', e.combinedScore.toFixed(2));
    });
  }

  const priceBasis = template?.priceBasis ?? 'each';

  const brandInference = inferBrandFromItemName(itemName);

  if (valid.length === 0) {
    if (returnDebugViews && evaluated.length > 0) {
      const debugViews = evaluated.slice(0, 20).map((e) => {
        const normPrice = computeNormalizedPrice(e.candidate.price, e.productAttrs, priceBasis);
        const brandInTitle = itemAttrs.brand
          ? e.candidate.title.toLowerCase().includes(itemAttrs.brand.toLowerCase())
          : false;
        const brandMatch = e.scoreReasons.brandMatch ?? 0;
        const brandMatchResult: 'positive' | 'negative' | 'neutral' =
          !itemAttrs.brand ? 'neutral' : brandMatch >= 0.8 ? 'positive' : brandMatch === 0 ? 'negative' : 'neutral';
        const brandDebug = {
          inferredBrand: brandInference.brand,
          inferenceSignals: brandInference.signals,
          productBrand: e.productAttrs.brand,
          brandInTitle,
          brandMatchResult,
        };
        return {
          asin: String(e.row.asin ?? e.row.product_id ?? '-'),
          title: e.candidate.title,
          price: e.candidate.price,
          normalizedUnitPrice: priceBasis !== 'each' ? normPrice : undefined,
          normalizedUnitType: priceBasis !== 'each' ? priceBasis : undefined,
          itemAttributes: e.itemAttrs,
          productAttributes: e.productAttrs,
          rejectionReason: e.rejection,
          scoreBreakdown: { ...e.scoreReasons, legacyScore: e.legacyScore },
          confidenceBand: e.confidenceBand,
          combinedScore: e.combinedScore,
          brandDebug,
          amazonDebug: buildAmazonDebug(e.row, e.productAttrs, e.rejection, itemName),
        };
      });
      return {
        bestRow: null as unknown as Record<string, unknown>,
        minPrice: 0,
        score: 0,
        validCount: 0,
        needsReview: true,
        debugViews,
      };
    }
    return null;
  }

  const priceBasisUsed = priceBasis;
  const normalizedUnitType = priceBasisUsed;
  valid.sort((a, b) => {
    const normA = computeNormalizedPrice(a.candidate.price, a.productAttrs, priceBasisUsed);
    const normB = computeNormalizedPrice(b.candidate.price, b.productAttrs, priceBasisUsed);
    const priceDiff = normA - normB;
    if (priceDiff !== 0) return priceDiff;
    const tieA = getRankingTieBreakerScore(a.row);
    const tieB = getRankingTieBreakerScore(b.row);
    return tieB - tieA;
  });
  const best = valid[0];
  const normalizedUnitPrice = computeNormalizedPrice(best.candidate.price, best.productAttrs, priceBasisUsed);
  const debugViews = (AMAZON_DISCOVERY_DEBUG || returnDebugViews)
    ? evaluated.slice(0, 20).map((e) => {
        const normPrice = computeNormalizedPrice(e.candidate.price, e.productAttrs, priceBasis);
        const brandInTitle = itemAttrs.brand
          ? e.candidate.title.toLowerCase().includes(itemAttrs.brand.toLowerCase())
          : false;
        const brandMatch = e.scoreReasons.brandMatch ?? 0;
        const brandMatchResult: 'positive' | 'negative' | 'neutral' =
          !itemAttrs.brand ? 'neutral' : brandMatch >= 0.8 ? 'positive' : brandMatch === 0 ? 'negative' : 'neutral';
        const brandDebug = {
          inferredBrand: brandInference.brand,
          inferenceSignals: brandInference.signals,
          productBrand: e.productAttrs.brand,
          brandInTitle,
          brandMatchResult,
        };
        return {
          asin: String(e.row.asin ?? e.row.product_id ?? '-'),
          title: e.candidate.title,
          price: e.candidate.price,
          normalizedUnitPrice: priceBasis !== 'each' ? normPrice : undefined,
          normalizedUnitType: priceBasis !== 'each' ? priceBasis : undefined,
          itemAttributes: e.itemAttrs,
          productAttributes: e.productAttrs,
          rejectionReason: e.rejection,
          scoreBreakdown: { ...e.scoreReasons, legacyScore: e.legacyScore },
          confidenceBand: e.confidenceBand,
          combinedScore: e.combinedScore,
          brandDebug,
          amazonDebug: buildAmazonDebug(e.row, e.productAttrs, e.rejection, itemName),
        };
      })
    : undefined;

  if (AMAZON_DISCOVERY_DEBUG && needsReview) {
    console.log('  [Match] NEEDS_REVIEW: no high-confidence candidate; selected from medium-confidence');
  }

  return {
    bestRow: best.row,
    minPrice: best.candidate.price,
    normalizedUnitPrice: priceBasisUsed !== 'each' ? normalizedUnitPrice : undefined,
    normalizedUnitType: priceBasisUsed !== 'each' ? normalizedUnitType : undefined,
    score: best.combinedScore,
    validCount: valid.length,
    needsReview,
    debugViews,
  };
}

/** Calls `selectCheapestValidDiscoveryCandidate` with `{ candidateRetailer: 'Amazon' }`. */
export function selectCheapestValidAmazonCandidate(
  itemName: string,
  rows: Record<string, unknown>[],
  fallbackUrl: string,
  lastPaidPrice?: number,
  returnDebugViews?: boolean,
  maxDepth: number = getAmazonMatchSearchDepths().defaultDepth
): ReturnType<typeof selectCheapestValidDiscoveryCandidate> {
  return selectCheapestValidDiscoveryCandidate(
    itemName,
    rows,
    fallbackUrl,
    lastPaidPrice,
    returnDebugViews,
    maxDepth,
    { candidateRetailer: 'Amazon' }
  );
}

type MatcherDebugParsed = {
  bestRow: Record<string, unknown> | null;
  debugViews?: CandidateDebugView[];
};

/**
 * When no quote is selected, summarize the most common rejection among evaluated rows.
 */
export function summarizeTopAmazonRejection(
  itemName: string,
  rows: Record<string, unknown>[],
  lastPaidPrice: number | undefined,
  fallbackUrl: string
): { code: string; detail?: string } | null {
  if (rows.length === 0) return null;
  const { defaultDepth, escalationDepth } = getAmazonMatchSearchDepths();

  const run = (depth: number) =>
    selectCheapestValidAmazonCandidate(itemName, rows, fallbackUrl, lastPaidPrice, true, depth) as MatcherDebugParsed | null;

  let parsed = run(defaultDepth);
  if (parsed?.bestRow) return null;

  let views = parsed?.debugViews;
  if (!views?.length) {
    parsed = run(escalationDepth);
    views = parsed?.debugViews;
  }

  if (!views?.length) {
    return {
      code: 'no_evaluated_candidates',
      detail: 'No priced candidates were evaluated.',
    };
  }

  const counts = new Map<string, { n: number; detail?: string }>();
  for (const v of views) {
    const code = v.rejectionReason?.code ?? 'no_rejection_recorded';
    const cur = counts.get(code);
    if (cur) cur.n += 1;
    else counts.set(code, { n: 1, detail: v.rejectionReason?.detail });
  }

  let topCode = '';
  let topN = 0;
  let topDetail: string | undefined;
  for (const [code, { n, detail }] of counts) {
    if (n > topN) {
      topCode = code;
      topN = n;
      topDetail = detail;
    }
  }
  return { code: topCode, detail: topDetail };
}

export interface AmazonCandidatePreview {
  asin: string;
  title: string;
  price: number;
  combinedScore: number;
  confidenceBand: string;
  rejectionCode?: string;
}

/** Top-N scored candidates (including rejected) for human review / Test Admin. */
export function getAmazonCandidatePreviews(
  itemName: string,
  rows: Record<string, unknown>[],
  lastPaidPrice: number | undefined,
  fallbackUrl: string,
  limit: number = 3
): AmazonCandidatePreview[] {
  if (rows.length === 0) return [];
  const { escalationDepth } = getAmazonMatchSearchDepths();
  const parsed = selectCheapestValidAmazonCandidate(
    itemName,
    rows,
    fallbackUrl,
    lastPaidPrice,
    true,
    escalationDepth
  ) as MatcherDebugParsed | null;
  const views = parsed?.debugViews;
  if (!views?.length) return [];
  const sorted = [...views].sort((a, b) => b.combinedScore - a.combinedScore);
  return sorted.slice(0, limit).map((v) => ({
    asin: v.asin,
    title: v.title.slice(0, 200),
    price: v.price,
    combinedScore: v.combinedScore,
    confidenceBand: v.confidenceBand,
    rejectionCode: v.rejectionReason?.code,
  }));
}
