import axios from 'axios';
import type { RetailerProvider, RetailerQuote } from '../types/retailer';
import { getBrightDataConfig, getLimitPerInput, getAmazonMatchSearchDepths } from '../config/brightData';
import {
  selectCheapestValidAmazonCandidate,
  extractPrice,
  extractUrl,
  summarizeTopAmazonRejection,
  getAmazonCandidatePreviews,
  type AmazonCandidatePreview,
} from './brightDataAmazonParse';
import { buildAmazonDiscoveryKeyword, broadenAmazonDiscoveryKeyword } from '../services/amazonDiscoveryKeyword';
import { buildCanonicalProductUrl } from '../utils/amazonIdentity';
import { getCachedDiscoveryRows, setCachedDiscoveryRows } from '../services/discoveryCache';
import { waitForSnapshot, getSnapshotRows } from '../services/brightData';

const BRIGHTDATA_BASE = 'https://api.brightdata.com';
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_RETRIES = Math.max(
  1,
  Math.min(5, parseInt(process.env.BRIGHTDATA_AMAZON_MAX_RETRIES || '3', 10) || 3)
);
const RETRY_BACKOFF_MS = [2_000, 4_000];

function getAmazonDiscoveryTimeoutMs(): number {
  const v = process.env.BRIGHTDATA_AMAZON_DISCOVERY_TIMEOUT_MS;
  if (!v) return DEFAULT_TIMEOUT_MS;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function isTimeoutOrTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string }).code;
  return (
    msg.toLowerCase().includes('timeout') ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND'
  );
}

/** When true, log discovery request/response details for debugging. */
const DISCOVERY_DEBUG = process.env.DISCOVERY_DEBUG === 'true';
/** When true, log detailed Amazon candidate scores, rejection reasons, and selection. */
const AMAZON_DISCOVERY_DEBUG = process.env.AMAZON_DISCOVERY_DEBUG === 'true';

/**
 * Normalize a raw row from Amazon search dataset to standard format for scoring.
 */
function normalizeAmazonSearchRow(raw: Record<string, unknown>): Record<string, unknown> | null {
  const asin =
    (raw.asin as string) ??
    (raw.product_id as string) ??
    (typeof raw.url === 'string' && raw.url.match(/\/dp\/([A-Z0-9]{10})/i)?.[1]) ??
    null;
  if (!asin || typeof asin !== 'string' || !asin.trim()) return null;

  const price = extractPrice(raw);
  if (price == null || price <= 0) return null;

  const title = (raw.title as string) ?? (raw.name as string) ?? (raw.product_title as string) ?? '';
  const productUrl = buildCanonicalProductUrl(asin.trim());

  return {
    ...raw,
    retailer: 'Amazon',
    retailerProductId: asin.trim(),
    productUrl,
    title,
    price,
    asin: asin.trim(),
    url: productUrl,
    final_price: price,
    name: title,
  };
}

function extractRowsFromResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const r = obj.rows ?? obj.data;
    return Array.isArray(r) ? r : [];
  }
  return [];
}

/** When true, log detailed discovery pipeline steps (request, response shape, normalization). */
const DISCOVERY_PIPELINE_DEBUG = process.env.DISCOVERY_PIPELINE_DEBUG === 'true';

export interface AmazonDiscoveryRowsResult {
  rows: Record<string, unknown>[];
  cacheHit: boolean;
  rawCount: number;
  rowsAfterProductFilter: number;
  rowsAfterNormalize: number;
  emptyReason?: string;
  debug?: {
    normalizedQuery: string;
    payload: unknown;
    cacheHit: boolean;
    responseShape: string;
    rowsBeforeFilter: number;
    rowsAfterFilter: number;
    rowsAfterNormalize: number;
    emptyReason?: string;
  };
}

/**
 * Fetch Amazon discovery rows for a keyword (cache or API).
 * Used by validation scripts and the provider.
 * @param options.bypassCache When true, skip read/write of in-memory discovery cache (live test / no cache pollution).
 */
export async function fetchAmazonDiscoveryRows(
  keyword: string,
  options?: { bypassCache?: boolean }
): Promise<AmazonDiscoveryRowsResult> {
  const bypassCache = options?.bypassCache === true;
  const config = getBrightDataConfig();
  const normalizedQuery = keyword.toLowerCase().trim().replace(/\s+/g, ' ');
  const cacheKey = normalizedQuery;
  let normalized: Record<string, unknown>[] | null = null;
  if (!bypassCache) {
    normalized = getCachedDiscoveryRows(cacheKey) as Record<string, unknown>[] | null;
  }

  if (DISCOVERY_PIPELINE_DEBUG) {
    console.log('\n--- [Discovery Pipeline] ---');
    console.log('  normalized search query:', JSON.stringify(keyword));
    console.log('  cache key:', JSON.stringify(cacheKey));
    console.log('  bypassCache:', bypassCache);
  }

  if (normalized !== null) {
    if (DISCOVERY_PIPELINE_DEBUG) {
      console.log('  cache: HIT');
      console.log('  cached rows:', normalized.length);
      console.log('  emptyReason:', normalized.length === 0 ? 'cache stored empty array' : undefined);
    }
    const n = normalized.length;
    return {
      rows: normalized,
      cacheHit: true,
      rawCount: n,
      rowsAfterProductFilter: n,
      rowsAfterNormalize: n,
      emptyReason: normalized.length === 0 ? 'cache stored empty array' : undefined,
      debug: DISCOVERY_PIPELINE_DEBUG
        ? {
            normalizedQuery: keyword,
            payload: null,
            cacheHit: true,
            responseShape: 'N/A (cache)',
            rowsBeforeFilter: n,
            rowsAfterFilter: n,
            rowsAfterNormalize: n,
            emptyReason: normalized.length === 0 ? 'cache stored empty array' : undefined,
          }
        : undefined,
    };
  }

  if (!config.enabled || !config.apiKey || !config.amazonDatasetId) {
    const emptyReason = !config.enabled
      ? 'Bright Data disabled or missing config'
      : !config.apiKey
        ? 'BRIGHTDATA_API_KEY missing'
        : 'BRIGHTDATA_AMAZON_DATASET_ID missing';
    if (DISCOVERY_PIPELINE_DEBUG) {
      console.log('  cache: MISS');
      console.log('  emptyReason:', emptyReason);
    }
    return {
      rows: [],
      cacheHit: false,
      rawCount: 0,
      rowsAfterProductFilter: 0,
      rowsAfterNormalize: 0,
      emptyReason,
      debug: DISCOVERY_PIPELINE_DEBUG
        ? {
            normalizedQuery: keyword,
            payload: { input: [{ keyword, zipcode: '' }] },
            cacheHit: false,
            responseShape: 'N/A',
            rowsBeforeFilter: 0,
            rowsAfterFilter: 0,
            rowsAfterNormalize: 0,
            emptyReason,
          }
        : undefined,
    };
  }

  const payload = { input: [{ keyword, zipcode: '' }] };
  const timeoutMs = getAmazonDiscoveryTimeoutMs();
  const limitPerInput = getLimitPerInput();
  console.log(`  [Amazon Discovery] limit_per_input=${limitPerInput}`);
  if (DISCOVERY_PIPELINE_DEBUG) {
    console.log('  cache: MISS');
    console.log('  Bright Data request payload:', JSON.stringify(payload));
    console.log('  dataset_id:', config.amazonDatasetId);
    console.log('  timeout_ms:', timeoutMs);
  }

  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const start = Date.now();
    if (attempt > 0) {
      const backoffMs = RETRY_BACKOFF_MS[attempt - 1] ?? 0;
      console.log(`  [Amazon Discovery] RETRY attempt ${attempt}/${MAX_RETRIES} after ${backoffMs}ms backoff (previous: timeout/transient)`);
      await new Promise((r) => setTimeout(r, backoffMs));
    } else {
      console.log(`  [Amazon Discovery] request start keyword=${JSON.stringify(keyword)} timeout=${timeoutMs}ms`);
    }

    try {
      const scrapeUrl = `${BRIGHTDATA_BASE}/datasets/v3/scrape?dataset_id=${encodeURIComponent(config.amazonDatasetId)}&format=json&notify=false&include_errors=true&type=discover_new&discover_by=keyword&limit_per_input=${limitPerInput}`;
      const res = await axios.post(
        scrapeUrl,
        payload,
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: timeoutMs,
          validateStatus: () => true,
        }
      );

      const elapsed = Date.now() - start;
      console.log(`  [Amazon Discovery] request complete elapsed=${elapsed}ms timeout=${timeoutMs}ms success=true`);

      let responseShape =
        res.data == null
          ? 'null'
          : Array.isArray(res.data)
            ? `array[${res.data.length}]`
            : typeof res.data === 'object'
              ? `object keys: ${Object.keys(res.data).join(', ')}`
              : typeof res.data;

    if (DISCOVERY_PIPELINE_DEBUG) {
      console.log('  response status:', res.status);
      console.log('  response shape:', responseShape);
      if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
        const k = Object.keys(res.data);
        k.forEach((key) => {
          const v = res.data[key];
          const preview = Array.isArray(v) ? `array[${v.length}]` : typeof v;
          console.log(`    res.data.${key}:`, preview);
        });
      }
    }

    const data = res.data as Record<string, unknown> | null;
    const hasSnapshotId =
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      (typeof (data.snapshot_id ?? data.snapshotId) === 'string');
    const snapshotId = hasSnapshotId
      ? ((data!.snapshot_id ?? data!.snapshotId) as string)
      : undefined;

    if (hasSnapshotId && snapshotId) {
      console.log(`  [Amazon Discovery] HTTP 202 snapshot flow engaged: ${snapshotId}`);
    }

    if (res.status !== 200 && res.status !== 202) {
      if (DISCOVERY_PIPELINE_DEBUG) {
        console.log('  emptyReason: HTTP', res.status);
      }
      return {
        rows: [],
        cacheHit: false,
        rawCount: 0,
        rowsAfterProductFilter: 0,
        rowsAfterNormalize: 0,
        emptyReason: `HTTP ${res.status}`,
        debug: DISCOVERY_PIPELINE_DEBUG
          ? {
              normalizedQuery: keyword,
              payload,
              cacheHit: false,
              responseShape,
              rowsBeforeFilter: 0,
              rowsAfterFilter: 0,
              rowsAfterNormalize: 0,
              emptyReason: `HTTP ${res.status}`,
            }
          : undefined,
      };
    }

    let rows: unknown[];

    if ((res.status === 202 || hasSnapshotId) && snapshotId) {
      console.log('  [Amazon Discovery] received HTTP 202 (or 200 with snapshot_id), snapshot_id:', snapshotId);
      console.log('  [Amazon Discovery] snapshot_id:', snapshotId);
      console.log('  [Amazon Discovery] polling started');

      try {
        await waitForSnapshot(snapshotId);
        console.log('  [Amazon Discovery] polling completed');
        rows = await getSnapshotRows(snapshotId);
        console.log('  [Amazon Discovery] snapshot rows downloaded:', rows.length);
        responseShape = 'HTTP 202 (async snapshot completed)';
      } catch (snapErr) {
        const msg = snapErr instanceof Error ? snapErr.message : String(snapErr);
        console.log('  [Amazon Discovery] async snapshot failed:', msg);
        return {
          rows: [],
          cacheHit: false,
          rawCount: 0,
          rowsAfterProductFilter: 0,
          rowsAfterNormalize: 0,
          emptyReason: `async snapshot failed: ${msg}`,
          debug: DISCOVERY_PIPELINE_DEBUG
            ? {
                normalizedQuery: keyword,
                payload,
                cacheHit: false,
                responseShape: 'HTTP 202 (async snapshot)',
                rowsBeforeFilter: 0,
                rowsAfterFilter: 0,
                rowsAfterNormalize: 0,
                emptyReason: `async snapshot failed: ${msg}`,
              }
            : undefined,
        };
      }
    } else {
      rows = extractRowsFromResponse(res.data);
      if (DISCOVERY_PIPELINE_DEBUG) {
        console.log('  [Amazon Discovery] sync path: rows from response, count=', rows.length);
      }
    }
    const rowsBeforeFilter = rows.length;

    const productRows = rows.filter((r) => {
      if (!r || typeof r !== 'object') return false;
      const row = r as Record<string, unknown>;
      if (row.input && !row.price && !row.final_price && !row.product_url && !row.asin) return false;
      return true;
    });
    const rowsAfterFilter = productRows.length;

    normalized = productRows
      .map((r) => (r && typeof r === 'object' ? normalizeAmazonSearchRow(r as Record<string, unknown>) : null))
      .filter((r): r is Record<string, unknown> => r != null);
    const rowsAfterNormalize = normalized.length;

    if (DISCOVERY_PIPELINE_DEBUG) {
      console.log('  rows before filter (extractRowsFromResponse):', rowsBeforeFilter);
      console.log('  rows after product filter:', rowsAfterFilter);
      console.log('  rows after normalizeAmazonSearchRow:', rowsAfterNormalize);
      if (rowsAfterNormalize === 0 && rowsBeforeFilter > 0) {
        const sample = rows[0] as Record<string, unknown>;
        console.log('  sample raw row keys:', sample ? Object.keys(sample).join(', ') : 'N/A');
        console.log('  sample asin:', sample?.asin ?? sample?.product_id ?? 'N/A');
        console.log('  sample price:', sample?.price ?? sample?.final_price ?? 'N/A');
      }
    }

    let emptyReason: string | undefined;
    if (rowsBeforeFilter === 0) {
      emptyReason =
        res.status === 202 || hasSnapshotId
          ? 'async snapshot completed: 0 rows'
          : 'Bright Data returned no rows';
    } else if (rowsAfterFilter === 0) {
      emptyReason = 'product filter dropped all rows (input-only rows)';
    } else if (rowsAfterNormalize === 0) {
      emptyReason = 'normalizeAmazonSearchRow dropped all (missing asin/price)';
    }

    if (normalized.length > 0 && !bypassCache) setCachedDiscoveryRows(cacheKey, normalized);

    return {
      rows: normalized,
      cacheHit: false,
      rawCount: rows.length,
      rowsAfterProductFilter: rowsAfterFilter,
      rowsAfterNormalize,
      emptyReason,
      debug: DISCOVERY_PIPELINE_DEBUG
        ? {
            normalizedQuery: keyword,
            payload,
            cacheHit: false,
            responseShape,
            rowsBeforeFilter,
            rowsAfterFilter,
            rowsAfterNormalize,
            emptyReason,
          }
        : undefined,
    };
    } catch (err) {
      const elapsed = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.toLowerCase().includes('timeout') || (err as { code?: string }).code === 'ECONNABORTED';
      const isRetryable = isTimeoutOrTransientError(err);

      console.log(
        `  [Amazon Discovery] request failed elapsed=${elapsed}ms timeout=${timeoutMs}ms ` +
          `timeout=${isTimeout} retryable=${isRetryable} attempt=${attempt}/${MAX_RETRIES} error=${msg.slice(0, 80)}`
      );

      if (isRetryable && attempt < MAX_RETRIES) {
        attempt++;
        continue;
      }

      const emptyReason = isTimeout
        ? `timeout: ${msg}`
        : `request failure: ${msg}`;
      if (DISCOVERY_PIPELINE_DEBUG) {
        console.log('  emptyReason:', emptyReason);
      }
      return {
        rows: [],
        cacheHit: false,
        rawCount: 0,
        rowsAfterProductFilter: 0,
        rowsAfterNormalize: 0,
        emptyReason,
        debug: DISCOVERY_PIPELINE_DEBUG
          ? {
              normalizedQuery: keyword,
              payload,
              cacheHit: false,
              responseShape: 'N/A',
              rowsBeforeFilter: 0,
              rowsAfterFilter: 0,
              rowsAfterNormalize: 0,
              emptyReason,
            }
          : undefined,
      };
    }
  }
  return {
    rows: [],
    cacheHit: false,
    rawCount: 0,
    rowsAfterProductFilter: 0,
    rowsAfterNormalize: 0,
    emptyReason: 'max retries exceeded',
    debug: DISCOVERY_PIPELINE_DEBUG
      ? { normalizedQuery: keyword, payload, cacheHit: false, responseShape: 'N/A', rowsBeforeFilter: 0, rowsAfterFilter: 0, rowsAfterNormalize: 0, emptyReason: 'max retries exceeded' }
      : undefined,
  };
}

/**
 * Run matcher/escalation on normalized discovery rows (shared by provider and test batch).
 */
function matchNormalizedAmazonRowsToQuotes(
  itemName: string,
  lastPaidPrice: number | null | undefined,
  normalized: Record<string, unknown>[],
  fallbackSearchKeyword?: string
): RetailerQuote[] {
  if (normalized.length === 0) {
    if (AMAZON_DISCOVERY_DEBUG) console.log('  [Amazon] No valid product rows - skipping');
    return [];
  }

  if (AMAZON_DISCOVERY_DEBUG) console.log('  Top candidates (score, price, asin, status):');

  const urlKey = (fallbackSearchKeyword ?? itemName).trim() || itemName;
  const fallbackUrl = `https://www.amazon.com/s?k=${encodeURIComponent(urlKey)}`;
  const lastPaid = lastPaidPrice ?? undefined;
  const { defaultDepth, escalationDepth } = getAmazonMatchSearchDepths();

  let parsed = selectCheapestValidAmazonCandidate(
    itemName,
    normalized,
    fallbackUrl,
    lastPaid,
    false,
    defaultDepth
  );

  const recordsProcessedPass1 = Math.min(normalized.length, defaultDepth);

  if (parsed && parsed.bestRow && !parsed.needsReview) {
    if (AMAZON_DISCOVERY_DEBUG || DISCOVERY_DEBUG) {
      console.log(`  [Amazon Discovery] records processed: ${recordsProcessedPass1}`);
      console.log(`  [Amazon Discovery] escalation: no (early exit: strong winner in top ${defaultDepth})`);
    }
  } else {
    const shouldEscalate = !parsed || !parsed.bestRow || parsed.needsReview;

    if (shouldEscalate && normalized.length > defaultDepth) {
      const escalationReason =
        !parsed || !parsed.bestRow
          ? 'all candidates rejected'
          : 'only medium-confidence candidates in top 20';

      parsed = selectCheapestValidAmazonCandidate(
        itemName,
        normalized,
        fallbackUrl,
        lastPaid,
        false,
        escalationDepth
      );

      const recordsProcessedPass2 = Math.min(normalized.length, escalationDepth);
      if (AMAZON_DISCOVERY_DEBUG || DISCOVERY_DEBUG) {
        console.log(`  [Amazon Discovery] records processed: ${recordsProcessedPass1} -> ${recordsProcessedPass2} (escalation)`);
        console.log(`  [Amazon Discovery] escalation: yes (reason: ${escalationReason})`);
      }
    } else {
      if (AMAZON_DISCOVERY_DEBUG || DISCOVERY_DEBUG) {
        console.log(`  [Amazon Discovery] records processed: ${recordsProcessedPass1}`);
        console.log(`  [Amazon Discovery] escalation: no (${!parsed || !parsed.bestRow ? 'no valid candidates' : 'insufficient data to escalate'})`);
      }
    }
  }

  if (!parsed || !parsed.bestRow) return [];

  const { bestRow, minPrice } = parsed;
  const url = extractUrl(bestRow, fallbackUrl);
  const capturedAt = new Date();

  if (AMAZON_DISCOVERY_DEBUG || DISCOVERY_DEBUG) {
    console.log(`  [Amazon] SELECTED (cheapest valid):`);
    console.log(`    title: ${(bestRow.title ?? bestRow.name ?? '').toString().slice(0, 80)}`);
    console.log(`    asin: ${bestRow.asin ?? '-'}`);
    console.log(`    price: $${minPrice.toFixed(2)}`);
    if (parsed.normalizedUnitPrice != null) {
      console.log(`    normalizedUnitPrice: $${parsed.normalizedUnitPrice.toFixed(4)} (${parsed.normalizedUnitType})`);
    }
    console.log(`    score: ${parsed.score.toFixed(2)} | validCount: ${parsed.validCount}`);
    if (parsed.needsReview) console.log(`    NEEDS_REVIEW: true (medium-confidence fallback)`);
  }

  return [
    {
      retailer: 'Amazon',
      url,
      unitPrice: minPrice,
      currency: 'USD',
      capturedAt,
      rawJson: bestRow,
    },
  ];
}

export interface AmazonDiscoveryQuotesWithStatsResult {
  quotes: RetailerQuote[];
  rawRowsReturned: number;
  rowsAfterProductFilter: number;
  normalizedRows: number;
  cacheHit: boolean;
  emptyReason?: string;
  discoveryKeyword: string;
  matcherTopRejection?: { code: string; detail?: string } | null;
  topCandidates?: AmazonCandidatePreview[];
  usedFallbackKeyword?: boolean;
  fallbackDiscoveryKeyword?: string;
}

/**
 * Single Bright Data fetch + matcher; optional cache bypass for live TEST_MODE batch.
 */
export async function getAmazonDiscoveryQuotesWithStats(
  input: {
    name: string;
    lastPaidPrice?: number | null;
    productBrand?: string | null;
    amazonSearchHint?: string | null;
    amazonAsin?: string | null;
    /** When set (e.g. global discovery profile), skip building keyword from item fields. */
    discoveryKeywordOverride?: string | null;
  },
  options?: { bypassCache?: boolean; allowFallbackSecondQuery?: boolean }
): Promise<AmazonDiscoveryQuotesWithStatsResult> {
  const discoveryKeyword =
    input.discoveryKeywordOverride?.trim() ||
    buildAmazonDiscoveryKeyword({
      name: input.name,
      productBrand: input.productBrand,
      amazonSearchHint: input.amazonSearchHint,
      amazonAsin: input.amazonAsin,
    });

  let fetched = await fetchAmazonDiscoveryRows(discoveryKeyword, options);
  let rawRowsReturned = fetched.rawCount;
  let quotes = matchNormalizedAmazonRowsToQuotes(
    input.name,
    input.lastPaidPrice,
    fetched.rows,
    discoveryKeyword
  );
  let usedFallbackKeyword = false;
  let fallbackDiscoveryKeyword: string | undefined;

  const tryFallback =
    options?.allowFallbackSecondQuery === true &&
    quotes.length === 0 &&
    fetched.rows.length > 0 &&
    !fetched.emptyReason?.toLowerCase().includes('timeout');

  if (tryFallback) {
    const k2 = broadenAmazonDiscoveryKeyword(discoveryKeyword);
    if (k2.length >= 3 && k2 !== discoveryKeyword) {
      const f2 = await fetchAmazonDiscoveryRows(k2, options);
      rawRowsReturned += f2.rawCount;
      usedFallbackKeyword = true;
      fallbackDiscoveryKeyword = k2;
      const q2 = matchNormalizedAmazonRowsToQuotes(input.name, input.lastPaidPrice, f2.rows, k2);
      if (q2.length > 0) {
        quotes = q2;
        fetched = { ...f2, rawCount: rawRowsReturned };
      }
    }
  }

  const rowsForDiagnostics = fetched.rows;
  const urlKey = (usedFallbackKeyword && fallbackDiscoveryKeyword) || discoveryKeyword;
  const fallbackUrl = `https://www.amazon.com/s?k=${encodeURIComponent(urlKey)}`;

  let matcherTopRejection: { code: string; detail?: string } | null | undefined;
  let topCandidates: AmazonCandidatePreview[] | undefined;

  if (quotes.length === 0 && rowsForDiagnostics.length > 0) {
    matcherTopRejection = summarizeTopAmazonRejection(
      input.name,
      rowsForDiagnostics,
      input.lastPaidPrice ?? undefined,
      fallbackUrl
    );
    topCandidates = getAmazonCandidatePreviews(
      input.name,
      rowsForDiagnostics,
      input.lastPaidPrice ?? undefined,
      fallbackUrl,
      3
    );
  }

  return {
    quotes,
    rawRowsReturned,
    rowsAfterProductFilter: fetched.rowsAfterProductFilter,
    normalizedRows: fetched.rowsAfterNormalize,
    cacheHit: fetched.cacheHit,
    emptyReason: fetched.emptyReason,
    discoveryKeyword,
    matcherTopRejection: matcherTopRejection ?? undefined,
    topCandidates,
    usedFallbackKeyword: usedFallbackKeyword || undefined,
    fallbackDiscoveryKeyword,
  };
}

/**
 * Amazon provider: daily re-discovery via Bright Data keyword sync scrape.
 * Always runs live search; does not use saved product URL for pricing.
 */
export const amazonBrightDataProvider: RetailerProvider = {
  name: 'Amazon',

  async getQuotesForItem(input: {
    companyId: number;
    itemId: number;
    name: string;
    matchItemName?: string;
    lastPaidPrice?: number | null;
  }): Promise<RetailerQuote[]> {
    const config = getBrightDataConfig();
    if (!config.enabled || !config.apiKey || !config.amazonDatasetId) return [];

    const matchName = (input.matchItemName ?? input.name).trim() || input.name;
    const { rows: normalized, cacheHit, rawCount } = await fetchAmazonDiscoveryRows(input.name);

    const rawRecordsReturned = rawCount;
    const normalizedCount = normalized.length;
    if (AMAZON_DISCOVERY_DEBUG || DISCOVERY_DEBUG) {
      if (cacheHit) {
        console.log('\n--- [Amazon] Cache HIT ---');
        console.log(`  item: "${input.name}"`);
        console.log(`  cached rows: ${normalized.length}`);
      } else {
        console.log('\n--- [Amazon] Daily re-discovery ---');
        console.log(`  item: "${input.name}"`);
        console.log(`  keyword: "${input.name}"`);
        console.log(`  dataset_id: ${config.amazonDatasetId}`);
        console.log(`  candidate rows returned: ${rawCount} (normalized: ${normalized.length})`);
      }
      console.log(`  [Amazon Discovery] raw records returned: ${rawRecordsReturned}, normalized: ${normalizedCount}`);
    }

    return matchNormalizedAmazonRowsToQuotes(matchName, input.lastPaidPrice, normalized, input.name);
  },
};
