import { getBrightDataConfig } from '../config/brightData';
import { normalizePrice } from './brightData';
import { getAmazonDiscoveryQuotesWithStats } from '../providers/amazonBrightDataProvider';
import { homeDepotBrightDataProvider } from '../providers/homeDepotBrightDataProvider';
import type { RetailerQuote } from '../types/retailer';
import { buildAggregateProviderKeyword } from './amazonDiscoveryKeyword';
import { normalizeItemName } from './matching/normalize';
import { getRetailerVisibility, type RetailerVisibility } from './retailerSearchPolicy';
import {
  buildDiscoveryProfileKey,
  getDiscoveryProfile,
  mergeDiscoveryRouting,
  isGlobalDiscoveryProfilesEnabled,
  reinforceDiscoveryFromCatalogMatch,
} from './discoveryProfile';

interface RetailerMatch {
  retailer: string;
  title: string;
  price: number;
  url: string;
  score: number;
}

interface MatchResult {
  retailer: string;
  title: string;
  price: number;
  url: string;
  confidence: number; // 0.0 to 1.0 - confidence score
}

// Old normalizeItemName removed - now using matching/normalize.ts

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 and 1 (1 being perfect match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Quick exact match check
  if (s1 === s2) return 1;

  // Check for substring matches
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return shorter.length / longer.length * 0.95; // High score but not perfect
  }

  // Levenshtein distance
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  return maxLength === 0 ? 1 : 1 - costs[s2.length] / maxLength;
}

/**
 * Check if price is reasonable compared to reference price
 */
function isPriceReasonable(price: number, referencePrice: number): boolean {
  if (referencePrice === 0) return true;
  
  const ratio = price / referencePrice;
  // Reject prices that are 4x higher or 0.25x lower
  return ratio >= 0.25 && ratio <= 4.0;
}

/**
 * Extract number from string (e.g., "500 sheets" -> 500)
 */
function extractPackagingSize(text: string): number | null {
  const match = text.match(/(\d+)\s*(sheet|count|ct|pack|oz|lb|g|kg|ml|l)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Detect if an item name is too vague/generic
 * Returns true if the name needs more detail for accurate matching
 */
export function isVagueName(itemName: string): boolean {
  const name = itemName.trim().toLowerCase();
  
  // Very short names (1-2 words) are likely vague
  const words = name.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 2) {
    // Check if it's a common generic word
    const genericWords = [
      'nails', 'screws', 'bolts', 'nuts', 'washers',
      'paper', 'pens', 'pencils', 'markers', 'tape',
      'tools', 'supplies', 'materials', 'parts', 'items',
      'boxes', 'bags', 'containers', 'labels', 'tags',
      'cables', 'wires', 'tubes', 'pipes', 'hoses',
      'plates', 'sheets', 'panels', 'boards', 'blocks'
    ];
    
    if (genericWords.includes(name) || genericWords.some(word => name === word + 's')) {
      return true;
    }
    
    // Single word items are usually vague (unless it's a brand name)
    if (words.length === 1 && name.length < 10) {
      return true;
    }
  }
  
  // Check for lack of specific details
  // Good names usually have: brand, size, model, type, specifications
  const hasBrand = /^(simpson|hp|bic|scotch|3m|staple|office|dell|lenovo|canon|epson)/i.test(name);
  const hasSize = /\d+\s*(in|inch|ft|foot|cm|mm|oz|lb|g|kg|ml|l|pack|count|ct)/i.test(name);
  const hasModel = /(model|sku|part|#|no\.|number)\s*[a-z0-9]/i.test(name);
  const hasSpecs = /(galvanized|stainless|heavy|duty|premium|professional|commercial)/i.test(name);
  
  // If name is short and lacks any specific details, it's vague
  if (words.length <= 3 && !hasBrand && !hasSize && !hasModel && !hasSpecs) {
    return true;
  }
  
  return false;
}

/**
 * Determine if an item needs clarification from the user
 * Based on vague name detection and match confidence
 */
export function needsClarification(itemName: string, matchConfidence: number | null): boolean {
  // If name is vague, it needs clarification
  if (isVagueName(itemName)) {
    return true;
  }
  
  // If match confidence is low (< 0.5), it needs clarification
  if (matchConfidence !== null && matchConfidence < 0.5) {
    return true;
  }
  
  return false;
}

// Old scoreResult removed - now using matching/score.ts

/**
 * Enhanced match result with decision information
 */
export interface EnhancedMatchResult extends MatchResult {
  status: 'unmatched' | 'auto_matched' | 'needs_review' | 'verified' | 'overridden';
  alternatives?: Array<{
    retailer: string;
    title: string;
    price: number;
    url: string;
    confidence: number;
  }>;
  normalizedName?: string;
  matchReasons?: any;
}

/** Optional fields for Amazon (Bright Data) discovery keyword building. */
export type MatchItemAmazonContext = {
  productBrand?: string | null;
  amazonSearchHint?: string | null;
  amazonAsin?: string | null;
  /** Full keyword override (e.g. global ItemDiscoveryProfile). */
  discoveryKeywordOverride?: string | null;
};

/**
 * Whether Fix Match / rematch can call Amazon Bright Data discovery.
 * If false, `matchItemToRetailers` returns null without calling the network.
 */
export function amazonDiscoveryReady(): { ok: boolean; reason?: string } {
  const bd = getBrightDataConfig();
  if (!bd.enabled || !bd.apiKey || !bd.amazonDatasetId) {
    return {
      ok: false,
      reason:
        'Amazon product search is not configured. Set BRIGHTDATA_ENABLED=true, BRIGHTDATA_API_KEY, and BRIGHTDATA_AMAZON_DATASET_ID (or BRIGHTDATA_DATASET_ID) in server/.env, then restart the API.',
    };
  }
  return { ok: true };
}

/** Home Depot Bright Data dataset (same as price-check discovery). */
export function homeDepotDiscoveryReady(): { ok: boolean; reason?: string } {
  const bd = getBrightDataConfig();
  if (!bd.enabled || !bd.apiKey || !bd.homeDepotDatasetId) {
    return {
      ok: false,
      reason:
        'Home Depot product search is not configured. Set BRIGHTDATA_ENABLED=true, BRIGHTDATA_API_KEY, and BRIGHTDATA_HOMEDEPOT_DATASET_ID in server/.env, then restart the API.',
    };
  }
  return { ok: true };
}

/** Display name for Item.matchedRetailer (matchProvider is lowercase slug). */
export function formatMatchedRetailerDisplay(matchProvider: string): string {
  const p = matchProvider.toLowerCase();
  if (p === 'amazon') return 'Amazon';
  if (p === 'homedepot') return 'Home Depot';
  return matchProvider.charAt(0).toUpperCase() + matchProvider.slice(1);
}

function titleFromAmazonQuote(q: RetailerQuote, fallback: string): string {
  const r = q.rawJson;
  if (r && typeof r === 'object') {
    const o = r as Record<string, unknown>;
    const t = o.title ?? o.name ?? o.product_title;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return fallback;
}

function titleFromRetailerQuote(q: RetailerQuote, fallback: string): string {
  const r = q.rawJson;
  if (r && typeof r === 'object') {
    const o = r as Record<string, unknown>;
    const t = o.title ?? o.name ?? o.product_title ?? o.product_name;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return fallback;
}

/**
 * Match an item to a retailer product. **Amazon only** (Bright Data dataset search).
 * Does not call Office Depot or other legacy HTML retailers.
 */
export async function matchItemToRetailers(
  itemName: string,
  lastPaidPrice: number = 0,
  isManuallyMatched: boolean = false,
  ctx?: MatchItemAmazonContext
): Promise<EnhancedMatchResult | null> {
  console.log(`\n🔍 Matching item (Amazon only): "${itemName}"`);

  const itemMeta = normalizeItemName(itemName);
  console.log(`   Normalized: "${itemMeta.normalized}"`);
  if (itemMeta.brand) console.log(`   Brand: ${itemMeta.brand}`);
  if (itemMeta.size) console.log(`   Size: ${itemMeta.size}`);
  if (itemMeta.count) console.log(`   Count: ${itemMeta.count}`);
  if (itemMeta.model) console.log(`   Model: ${itemMeta.model}`);

  const bd = getBrightDataConfig();
  if (!bd.enabled || !bd.apiKey || !bd.amazonDatasetId) {
    console.log(
      '[matchItem] Amazon discovery skipped (Bright Data not configured). Rematch will not call Amazon until BRIGHTDATA_* env is set.'
    );
    return null;
  }

  try {
    const discovery = await getAmazonDiscoveryQuotesWithStats(
      {
        name: itemName,
        lastPaidPrice: lastPaidPrice || null,
        productBrand: ctx?.productBrand ?? null,
        amazonSearchHint: ctx?.amazonSearchHint ?? null,
        amazonAsin: ctx?.amazonAsin ?? null,
        discoveryKeywordOverride: ctx?.discoveryKeywordOverride ?? null,
      },
      { allowFallbackSecondQuery: true }
    );

    console.log(`   Amazon discovery keyword: "${discovery.discoveryKeyword}" (rows: ${discovery.rawRowsReturned}, quotes: ${discovery.quotes.length})`);

    if (discovery.quotes.length === 0) {
      console.log(`❌ No Amazon match: ${discovery.emptyReason || 'no quotes'}`);
      return null;
    }

    const q = discovery.quotes[0];
    const url = typeof q.url === 'string' ? q.url.trim() : '';
    const price = q.unitPrice;
    if (!url || price == null || !Number.isFinite(price) || price <= 0) {
      console.log('❌ Amazon quote missing URL or price');
      return null;
    }

    const title = titleFromAmazonQuote(q, itemName);
    const confidence = 0.72;
    const status: EnhancedMatchResult['status'] = isManuallyMatched ? 'overridden' : 'needs_review';

    console.log(`✅ Amazon match: ${title.slice(0, 80)}… $${price.toFixed(2)}`);

    return {
      retailer: 'amazon',
      title,
      price,
      url,
      confidence,
      status,
      alternatives: [],
      normalizedName: itemMeta.normalized,
      matchReasons: {
        source: 'amazon_bright_data',
        discoveryKeyword: discovery.discoveryKeyword,
        usedFallbackKeyword: discovery.usedFallbackKeyword,
        fallbackDiscoveryKeyword: discovery.fallbackDiscoveryKeyword,
        emptyReason: discovery.emptyReason,
        matcherTopRejection: discovery.matcherTopRejection,
      },
    };
  } catch (error) {
    console.error('Error matching item (Amazon):', error);
    return null;
  }
}

/**
 * Home Depot Bright Data catalog match (same pipeline as price-check discovery).
 */
export async function matchItemToHomeDepot(params: {
  itemName: string;
  lastPaidPrice: number;
  isManuallyMatched: boolean;
  companyId: number;
  itemId: number;
  productBrand?: string | null;
  amazonSearchHint?: string | null;
  amazonAsin?: string | null;
  /** Full keyword override (e.g. global ItemDiscoveryProfile). */
  homeDepotKeywordOverride?: string | null;
}): Promise<EnhancedMatchResult | null> {
  const ready = homeDepotDiscoveryReady();
  if (!ready.ok) {
    console.log('[matchItem] Home Depot discovery skipped:', ready.reason);
    return null;
  }

  console.log(`\n🔍 Matching item (Home Depot): "${params.itemName}"`);

  const itemMeta = normalizeItemName(params.itemName);
  const keyword =
    params.homeDepotKeywordOverride?.trim() ||
    buildAggregateProviderKeyword({
      name: params.itemName,
      productBrand: params.productBrand,
      amazonSearchHint: params.amazonSearchHint,
      amazonAsin: params.amazonAsin,
    });
  console.log(`   Home Depot discovery keyword: "${keyword}"`);

  try {
    const quotes = await homeDepotBrightDataProvider.getQuotesForItem({
      companyId: params.companyId,
      itemId: params.itemId,
      name: keyword,
      matchItemName: params.itemName,
      lastPaidPrice: params.lastPaidPrice ?? undefined,
    });

    if (quotes.length === 0) {
      console.log('❌ No Home Depot match: empty quotes');
      return null;
    }

    const q = quotes[0];
    const url = typeof q.url === 'string' ? q.url.trim() : '';
    let price: number | undefined = q.unitPrice;
    if (price == null || !Number.isFinite(price) || price <= 0) {
      const raw = q.rawJson;
      if (raw && typeof raw === 'object') {
        const np = normalizePrice(raw);
        if (np != null && np > 0 && np < 100000) price = np;
      }
    }
    if (!url || price == null || !Number.isFinite(price) || price <= 0) {
      console.log('❌ Home Depot quote missing URL or price');
      return null;
    }

    const title = titleFromRetailerQuote(q, params.itemName);
    const status: EnhancedMatchResult['status'] = params.isManuallyMatched ? 'overridden' : 'needs_review';

    console.log(`✅ Home Depot match: ${title.slice(0, 80)}… $${price.toFixed(2)}`);

    return {
      retailer: 'homedepot',
      title,
      price,
      url,
      confidence: 0.72,
      status,
      alternatives: [],
      normalizedName: itemMeta.normalized,
      matchReasons: {
        source: 'home_depot_bright_data',
        discoveryKeyword: keyword,
      },
    };
  } catch (error) {
    console.error('Error matching item (Home Depot):', error);
    return null;
  }
}

export type CatalogMatchDiagnostics = {
  visibility: RetailerVisibility;
  amazonAttempted: boolean;
  homeDepotAttempted: boolean;
};

/**
 * Catalog match for Fix Match / create-item: uses the same retailer visibility rules as price checks
 * (e.g. hardware → Home Depot only; office supplies → Amazon only when configured).
 */
export async function matchCatalogForItem(options: {
  name: string;
  category: string | null | undefined;
  lastPaidPrice: number;
  isManuallyMatched: boolean;
  companyId: number;
  itemId: number;
  productBrand?: string | null;
  amazonSearchHint?: string | null;
  amazonAsin?: string | null;
}): Promise<{ match: EnhancedMatchResult | null; diagnostics: CatalogMatchDiagnostics }> {
  const visibility = getRetailerVisibility({
    name: options.name,
    category: options.category,
  });

  const profileKey = buildDiscoveryProfileKey({
    name: options.name,
    productBrand: options.productBrand,
    amazonAsin: options.amazonAsin,
  });
  const profileRow =
    isGlobalDiscoveryProfilesEnabled() && profileKey
      ? await getDiscoveryProfile(profileKey)
      : null;

  const merged = mergeDiscoveryRouting(
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

  let amazonAttempted = false;
  let homeDepotAttempted = false;
  let match: EnhancedMatchResult | null = null;

  const amazonOk = amazonDiscoveryReady();
  const hdOk = homeDepotDiscoveryReady();

  const tryHdFirst =
    merged.prefersHomeDepotFirst &&
    merged.homeDepot &&
    merged.amazon &&
    hdOk.ok &&
    amazonOk.ok;

  const amazonCtx: MatchItemAmazonContext = {
    productBrand: options.productBrand,
    amazonSearchHint: options.amazonSearchHint,
    amazonAsin: options.amazonAsin,
    discoveryKeywordOverride: merged.amazonKeywordOverride,
  };

  const hdParamsBase = {
    itemName: options.name,
    lastPaidPrice: options.lastPaidPrice,
    isManuallyMatched: options.isManuallyMatched,
    companyId: options.companyId,
    itemId: options.itemId,
    productBrand: options.productBrand,
    amazonSearchHint: options.amazonSearchHint,
    amazonAsin: options.amazonAsin,
    homeDepotKeywordOverride: merged.homeDepotKeywordOverride,
  };

  if (tryHdFirst) {
    homeDepotAttempted = true;
    match = await matchItemToHomeDepot(hdParamsBase);
  }

  if (!match && merged.amazon && amazonOk.ok) {
    amazonAttempted = true;
    match = await matchItemToRetailers(
      options.name,
      options.lastPaidPrice,
      options.isManuallyMatched,
      amazonCtx
    );
  }

  if (!match && merged.homeDepot && hdOk.ok && !homeDepotAttempted) {
    homeDepotAttempted = true;
    match = await matchItemToHomeDepot(hdParamsBase);
  }

  if (process.env.DISCOVERY_DEBUG === 'true') {
    console.log(
      `[matchCatalog] policy amazon=${visibility.amazon} homeDepot=${visibility.homeDepot} prefersHdFirst=${merged.prefersHomeDepotFirst}` +
        (visibility.reason ? ` (${visibility.reason})` : '') +
        ` → amazonAttempted=${amazonAttempted} hdAttempted=${homeDepotAttempted} gotMatch=${!!match}`
    );
  }

  if (match && isGlobalDiscoveryProfilesEnabled() && profileKey) {
    const r = match.matchReasons;
    let dk = '';
    if (r && typeof r === 'object' && 'discoveryKeyword' in r) {
      const v = (r as { discoveryKeyword?: unknown }).discoveryKeyword;
      if (typeof v === 'string' && v.trim()) dk = v.trim();
    }
    if (dk) {
      await reinforceDiscoveryFromCatalogMatch({
        key: profileKey,
        retailer: match.retailer === 'homedepot' ? 'homedepot' : 'amazon',
        discoveryKeyword: dk,
      });
    }
  }

  return {
    match,
    diagnostics: {
      visibility,
      amazonAttempted,
      homeDepotAttempted,
    },
  };
}

// Test function (run standalone)
if (require.main === module) {
  (async () => {
    console.log('🧪 Testing Item Matcher...\n');

    const testItems = [
      { name: 'HP Printer Paper 500 Sheets', price: 29.99 },
      { name: 'Scotch Tape 12-Pack', price: 15.99 },
    ];

    for (const item of testItems) {
      const match = await matchItemToRetailers(item.name, item.price);
      if (match) {
        console.log('\n📦 Match Result:');
        console.log(JSON.stringify(match, null, 2));
      }
      console.log('\n---\n');
    }
  })();
}







