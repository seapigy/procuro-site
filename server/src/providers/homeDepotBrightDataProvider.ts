/**
 * Home Depot via Bright Data Datasets API.
 *
 * - **PDP**: full `https://www.homedepot.com/...` product URL in `name` → `{ input: [{ url, zipcode }] }`.
 * - **Keyword**: same discovery string as aggregate/Amazon (**brand + hint + name**, normalized) from
 *   `priceCheck`; optional **broadened** second pass (like Amazon) if the first returns no priced rows.
 *   Row selection uses **homeDepotDiscoveryMatch** (shared `scoreCandidate` + last-paid sanity, like Amazon’s
 *   legacy match leg). Bright Data: `{ input: [{ keyword }] }` (no `zipcode`); then `/s/...` URL scrape if needed.
 */
import axios from 'axios';
import type { RetailerProvider, RetailerQuote } from '../types/retailer';
import { broadenAmazonDiscoveryKeyword } from '../services/amazonDiscoveryKeyword';
import {
  getBrightDataConfig,
  getLimitPerInput,
  getHomeDepotDiscoveryTimeoutMs,
  getHomeDepotMaxRetries,
} from '../config/brightData';
import { waitForSnapshot, getSnapshotRows } from '../services/brightData';
import { matchHomeDepotRowsToQuotes, type HomeDepotMatchContext } from './homeDepotDiscoveryMatch';

const BRIGHTDATA_BASE = 'https://api.brightdata.com';
const HOMEDEPOT_BASE = 'https://www.homedepot.com';

const DISCOVERY_DEBUG = process.env.DISCOVERY_DEBUG === 'true';
const RETRY_BACKOFF_MS = [2_000, 4_000];

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

function extractRowsFromResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const r = obj.rows ?? obj.data ?? obj.results ?? obj.products;
    if (Array.isArray(r)) return r;
    if (r && typeof r === 'object' && Array.isArray((r as Record<string, unknown>).items)) {
      return (r as Record<string, unknown>).items as unknown[];
    }
  }
  return [];
}

async function fetchRowsFromScrape(
  apiUrl: string,
  requestBody: { input: Array<Record<string, string>> },
  apiKey: string,
  timeoutMs: number,
  maxRetries: number
): Promise<{ rows: unknown[]; httpStatus: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = RETRY_BACKOFF_MS[attempt - 1] ?? 2_000;
      console.log(`[HomeDepotDiscovery] retry ${attempt}/${maxRetries} after ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }

    try {
      const res = await axios.post(apiUrl, requestBody, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: timeoutMs,
        validateStatus: () => true,
      });

      const httpStatus = res.status;
      const data = res.data as Record<string, unknown> | null;
      const hasSnapshotId =
        data &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        typeof (data.snapshot_id ?? data.snapshotId) === 'string';
      const snapshotId = hasSnapshotId ? String(data!.snapshot_id ?? data!.snapshotId) : '';

      let rows: unknown[] = [];

      if ((res.status === 202 || hasSnapshotId) && snapshotId) {
        if (DISCOVERY_DEBUG) {
          console.log('[HomeDepotDiscovery] snapshot flow snapshot_id=', snapshotId);
        }
        try {
          await waitForSnapshot(snapshotId);
          rows = await getSnapshotRows(snapshotId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('[HomeDepotDiscovery] snapshot failed:', msg);
          if (isTimeoutOrTransientError(e) && attempt < maxRetries) {
            continue;
          }
          return { rows: [], httpStatus };
        }
      } else if (res.status === 200) {
        let body: unknown = res.data;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch {
            return { rows: [], httpStatus };
          }
        }
        rows = extractRowsFromResponse(body);

        if (DISCOVERY_DEBUG) {
          console.log('[HomeDepotDiscovery] rows=', rows.length, 'httpStatus=', httpStatus);
          if (rows.length === 0 && typeof body === 'object' && body !== null) {
            console.log(
              '[HomeDepotDiscovery] empty rows; response keys=',
              Object.keys(body as object).slice(0, 20)
            );
          }
        }
      } else {
        if (DISCOVERY_DEBUG) {
          console.log('[HomeDepotDiscovery] Bright Data status=', res.status);
          if (res.data && typeof res.data === 'object') {
            console.log('[HomeDepotDiscovery] error body snippet=', JSON.stringify(res.data).slice(0, 500));
          }
        }
        if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
          continue;
        }
        return { rows: [], httpStatus };
      }

      return { rows, httpStatus };
    } catch (err) {
      if (DISCOVERY_DEBUG) {
        console.log('[HomeDepotDiscovery] error:', err instanceof Error ? err.message : err);
      }
      if (isTimeoutOrTransientError(err) && attempt < maxRetries) {
        continue;
      }
      return { rows: [], httpStatus: 0 };
    }
  }

  return { rows: [], httpStatus: 0 };
}

async function keywordDiscoverThenSearchUrl(
  raw: string,
  scrapeBase: string,
  apiKey: string,
  timeoutMs: number,
  maxRetries: number,
  matchCtx: HomeDepotMatchContext
): Promise<RetailerQuote[]> {
  if (DISCOVERY_DEBUG) {
    console.log('[HomeDepotDiscovery] keyword=', raw);
  }

  const discoverUrl = `${scrapeBase}&type=discover_new&discover_by=keyword`;
  const { rows: rowsDiscover, httpStatus: stDiscover } = await fetchRowsFromScrape(
    discoverUrl,
    { input: [{ keyword: raw }] },
    apiKey,
    timeoutMs,
    maxRetries
  );

  const ctxForStep = { ...matchCtx, discoveryQuery: raw };
  let quotes = matchHomeDepotRowsToQuotes(rowsDiscover, ctxForStep);
  if (quotes.length > 0) return quotes;

  if (stDiscover === 400 && DISCOVERY_DEBUG) {
    console.log(
      '[HomeDepotDiscovery] discover_by=keyword not accepted for this dataset (HTTP 400); falling back to search results URL'
    );
  } else if (quotes.length === 0 && DISCOVERY_DEBUG) {
    console.log('[HomeDepotDiscovery] discover_by=keyword returned no quotes; trying search results URL');
  }

  const searchPageUrl = `${HOMEDEPOT_BASE}/s/${encodeURIComponent(raw)}`;
  const { rows: rowsSearch } = await fetchRowsFromScrape(
    scrapeBase,
    { input: [{ url: searchPageUrl, zipcode: '' }] },
    apiKey,
    timeoutMs,
    maxRetries
  );

  return matchHomeDepotRowsToQuotes(rowsSearch, ctxForStep);
}

export const homeDepotBrightDataProvider: RetailerProvider = {
  name: 'Home Depot',

  async getQuotesForItem(input: {
    companyId: number;
    itemId: number;
    name: string;
    matchItemName?: string;
    lastPaidPrice?: number | null;
  }): Promise<RetailerQuote[]> {
    const config = getBrightDataConfig();
    if (!config.apiKey || !config.homeDepotDatasetId) return [];

    const raw = input.name.trim() || 'drill';
    const matchCtx: HomeDepotMatchContext = {
      matchItemName: input.matchItemName,
      discoveryQuery: raw,
      lastPaidPrice: input.lastPaidPrice,
    };
    const isPdpUrl = raw.startsWith('http://') || raw.startsWith('https://');
    const limitPerInput = getLimitPerInput();
    const timeoutMs = getHomeDepotDiscoveryTimeoutMs();
    const maxRetries = getHomeDepotMaxRetries();

    const baseQs =
      `dataset_id=${encodeURIComponent(config.homeDepotDatasetId)}` +
      `&format=json&notify=false&include_errors=true&limit_per_input=${limitPerInput}`;

    const scrapeBase = `${BRIGHTDATA_BASE}/datasets/v3/scrape?${baseQs}`;

    if (isPdpUrl) {
      if (DISCOVERY_DEBUG) {
        console.log('[HomeDepotDiscovery] mode=pdp_url');
      }
      const { rows } = await fetchRowsFromScrape(
        scrapeBase,
        { input: [{ url: raw, zipcode: '' }] },
        config.apiKey,
        timeoutMs,
        maxRetries
      );
      return matchHomeDepotRowsToQuotes(rows, matchCtx);
    }

    if (DISCOVERY_DEBUG) {
      console.log('[HomeDepotDiscovery] mode=keyword try discover_by=keyword then search URL fallback');
    }

    let quotes = await keywordDiscoverThenSearchUrl(
      raw,
      scrapeBase,
      config.apiKey,
      timeoutMs,
      maxRetries,
      matchCtx
    );
    if (quotes.length > 0) return quotes;

    const k2 = broadenAmazonDiscoveryKeyword(raw);
    if (k2.length >= 3 && k2 !== raw) {
      if (DISCOVERY_DEBUG) {
        console.log('[HomeDepotDiscovery] no quotes; broadened keyword retry=', k2);
      }
      quotes = await keywordDiscoverThenSearchUrl(
        k2,
        scrapeBase,
        config.apiKey,
        timeoutMs,
        maxRetries,
        { ...matchCtx, discoveryQuery: k2 }
      );
    }

    return quotes;
  },
};
