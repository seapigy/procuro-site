/**
 * Bright Data Datasets API v3 integration.
 * Uses env vars only: BRIGHTDATA_API_KEY, BRIGHTDATA_DATASET_ID, BRIGHTDATA_API_HOST (optional).
 */

import { getLimitPerInput } from '../config/brightData';

const API_BASE =
  (process.env.BRIGHTDATA_API_HOST || 'https://api.brightdata.com').replace(/\/$/, '');
const API_KEY = (process.env.BRIGHTDATA_API_KEY || '').trim();
const DATASET_ID = (
  process.env.BRIGHTDATA_DATASET_ID ||
  process.env.BRIGHTDATA_AMAZON_DATASET_ID ||
  ''
).trim();

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 180_000; // 3 minutes
const REQUEST_TIMEOUT_MS = 60_000;

function getAuthHeader(): string {
  if (!API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY is required');
  }
  return `Bearer ${API_KEY}`;
}

function getDatasetId(): string {
  if (!DATASET_ID) {
    throw new Error('BRIGHTDATA_DATASET_ID or BRIGHTDATA_AMAZON_DATASET_ID is required');
  }
  return DATASET_ID;
}

/**
 * Trigger a Bright Data dataset run.
 * POST /datasets/v3/trigger?dataset_id=...
 * Body: input array. Returns snapshot_id for polling.
 */
export async function triggerDataset(
  input: object | object[]
): Promise<{ snapshotId: string }> {
  const inputArr = Array.isArray(input) ? input : [input];
  const datasetId = getDatasetId();
  return triggerDatasetWithId(datasetId, inputArr);
}

/**
 * Trigger a Bright Data dataset run with a specific dataset ID.
 * POST /datasets/v3/trigger?dataset_id=...
 * Body: { input: [...] } for keyword scrapers, or raw array for URL-based. Returns snapshot_id for polling.
 */
export async function triggerDatasetWithId(
  datasetId: string,
  payload: { input: object[] } | object[]
): Promise<{ snapshotId: string }> {
  const bodyJson = JSON.stringify(payload);
  const limitPerInput = getLimitPerInput();
  console.log(`  [Amazon Discovery] limit_per_input=${limitPerInput}`);

  const res = await fetch(
    `${API_BASE}/datasets/v3/trigger?dataset_id=${encodeURIComponent(datasetId)}&limit_per_input=${limitPerInput}`,
    {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: bodyJson,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Bright Data trigger failed: HTTP ${res.status}, body (first 200 chars): ${text.slice(0, 200)}`
    );
  }

  if (!res.ok) {
    const errMsg =
      (data as Record<string, unknown>)?.error ??
      (data as Record<string, unknown>)?.message ??
      text.slice(0, 200);
    throw new Error(`Bright Data trigger failed: HTTP ${res.status}, ${String(errMsg)}`);
  }

  const obj = data as Record<string, unknown>;
  const results = obj?.results as Array<{ snapshot_id?: string }> | undefined;
  const snapshotId =
    obj?.snapshot_id ??
    obj?.snapshotId ??
    (Array.isArray(results) && results[0] ? results[0].snapshot_id : undefined);

  if (typeof snapshotId !== 'string' || !snapshotId) {
    throw new Error(
      `Bright Data trigger: no snapshot_id in response. Keys: ${Object.keys(data as object).join(', ')}`
    );
  }

  return { snapshotId };
}

/**
 * Fetch snapshot rows (JSON array).
 * Handles NDJSON/text: split lines and JSON.parse each.
 */
export async function getSnapshotRows(snapshotId: string): Promise<unknown[]> {
  const url = `${API_BASE}/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text();

  if (!res.ok) {
    const snippet = text.slice(0, 300);
    throw new Error(
      `Bright Data getSnapshot failed: HTTP ${res.status}, response snippet: ${snippet}`
    );
  }

  // Try parse as JSON (array or object with rows/data)
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    // NDJSON: one JSON object per line
    const lines = text.split('\n').filter((l) => l.trim());
    const rows: unknown[] = [];
    for (const line of lines) {
      try {
        rows.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
    return rows;
  }

  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const rows = obj.rows ?? obj.data ?? obj.results;
    if (Array.isArray(rows)) return rows;
  }

  return [];
}

/**
 * Poll snapshot status until ready or failed.
 * Uses /datasets/v3/progress/{snapshotId} for status.
 */
export async function waitForSnapshot(
  snapshotId: string,
  opts?: { pollIntervalMs?: number; timeoutMs?: number }
): Promise<void> {
  const pollInterval = opts?.pollIntervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = opts?.timeoutMs ?? POLL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const url = `${API_BASE}/datasets/v3/progress/${encodeURIComponent(snapshotId)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: getAuthHeader() },
      signal: AbortSignal.timeout(15_000),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      // Non-JSON response
    }

    if (res.status !== 200) {
      const snippet = text.slice(0, 200);
      throw new Error(
        `Bright Data progress check failed: HTTP ${res.status}, response: ${snippet}`
      );
    }

    const status = String(data?.status ?? '').toLowerCase();

    if (status === 'failed') {
      const msg = data?.message ?? data?.error ?? 'Bright Data reported failed';
      throw new Error(`Bright Data snapshot failed: ${String(msg)}`);
    }

    if (status === 'ready') {
      return;
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error(
    `Bright Data snapshot timeout after ${timeoutMs}ms. Last status check: snapshot_id=${snapshotId}`
  );
}

/**
 * Full flow: trigger -> wait -> get rows.
 */
export async function runDatasetAndGetRows(
  input: object | object[]
): Promise<{ snapshotId: string; rows: unknown[] }> {
  const { snapshotId } = await triggerDataset(input);
  await waitForSnapshot(snapshotId);
  const rows = await getSnapshotRows(snapshotId);
  return { snapshotId, rows };
}

export function isBrightDataConfigured(): boolean {
  return !!(API_KEY && DATASET_ID);
}

/**
 * Normalize price from a dataset row. Defensive: check common fields in order.
 * Returns null if not parseable.
 */
export function normalizePrice(row: unknown): number | null {
  if (row == null || typeof row !== 'object') return null;

  const obj = row as Record<string, unknown>;

  const fields = [
    'final_price',
    'price',
    'buybox_price',
    'current_price',
    'unit_price',
    'offer_price',
    'finalPrice',
    'unitPrice',
    'initial_price',
    'initialPrice',
    'price_amount',
    'priceAmount',
  ];

  for (const field of fields) {
    const val = obj[field];
    if (val == null) continue;
    if (typeof val === 'number') {
      if (!isNaN(val) && val > 0 && val < 100000) return val;
      continue;
    }
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0 && parsed < 100000) return parsed;
      continue;
    }
  }

  // Nested: row.pricing?.price, row.price?.value
  const pricing = obj.pricing as Record<string, unknown> | undefined;
  if (pricing && typeof pricing === 'object') {
    const v = pricing.price ?? pricing.value;
    if (typeof v === 'number' && v > 0 && v < 100000) return v;
    if (typeof v === 'string') {
      const p = parseFloat(v.replace(/[^0-9.]/g, ''));
      if (!isNaN(p) && p > 0 && p < 100000) return p;
    }
  }
  const priceObj = obj.price as Record<string, unknown> | undefined;
  if (priceObj && typeof priceObj === 'object') {
    const v = priceObj.value ?? priceObj.amount;
    if (typeof v === 'number' && v > 0 && v < 100000) return v;
    if (typeof v === 'string') {
      const p = parseFloat(v.replace(/[^0-9.]/g, ''));
      if (!isNaN(p) && p > 0 && p < 100000) return p;
    }
  }

  return null;
}

/**
 * Pick best row from rows: prefer one with valid numeric price (lowest).
 */
export function pickBestRow(rows: unknown[]): { row: Record<string, unknown>; unitPrice: number } | null {
  let best: { row: Record<string, unknown>; unitPrice: number } | null = null;
  for (const r of rows) {
    if (r && typeof r === 'object') {
      const price = normalizePrice(r);
      if (price != null && (best == null || price < best.unitPrice)) {
        best = { row: r as Record<string, unknown>, unitPrice: price };
      }
    }
  }
  return best;
}

function extractUrlFromRow(row: Record<string, unknown>, fallback: string): string {
  const fields = ['url', 'product_url', 'productUrl', 'link', 'href'];
  for (const f of fields) {
    const v = row[f];
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  return fallback;
}

export interface BrightDataQuote {
  retailer: string;
  url: string;
  unitPrice: number;
  currency: string;
  capturedAt: Date;
  rawJson: Record<string, unknown>;
}

/**
 * Run Bright Data dataset for a product URL, wait for snapshot, normalize, return quote.
 */
export async function runBrightDataForProductUrl(
  productUrl: string
): Promise<BrightDataQuote | null> {
  if (!isBrightDataConfigured()) return null;

  const { snapshotId, rows } = await runDatasetAndGetRows({ url: productUrl });

  const picked = pickBestRow(rows);
  if (!picked) return null;

  const { row, unitPrice } = picked;
  const url = extractUrlFromRow(row, productUrl);

  const rawJson: Record<string, unknown> = {
    ...row,
    _snapshotId: snapshotId,
    _dataset: getDatasetId(),
  };

  return {
    retailer: 'Amazon',
    url,
    unitPrice,
    currency: 'USD',
    capturedAt: new Date(),
    rawJson,
  };
}
