/**
 * Bright Data Datasets API config.
 * Uses BRIGHTDATA_API_KEY, BRIGHTDATA_DATASET_ID (or BRIGHTDATA_AMAZON_DATASET_ID).
 * Optional: BRIGHTDATA_API_HOST, BRIGHTDATA_ENABLED.
 */
export interface BrightDataConfig {
  enabled: boolean;
  apiKey: string;
  amazonDatasetId: string;
  amazonSearchDatasetId: string;
  /** Home Depot dataset (search URL scrape). Env: BRIGHTDATA_HOMEDEPOT_DATASET_ID */
  homeDepotDatasetId: string;
}

export function getBrightDataConfig(): BrightDataConfig {
  const apiKey = (process.env.BRIGHTDATA_API_KEY || '').trim();
  const datasetId =
    (process.env.BRIGHTDATA_DATASET_ID || '').trim() ||
    (process.env.BRIGHTDATA_AMAZON_DATASET_ID || '').trim();
  const amazonSearchDatasetId = (process.env.BRIGHTDATA_AMAZON_SEARCH_DATASET_ID || '').trim();
  const homeDepotDatasetId = (process.env.BRIGHTDATA_HOMEDEPOT_DATASET_ID || '').trim();
  const explicitEnabled = process.env.BRIGHTDATA_ENABLED;
  const inferredEnabled = !!(apiKey && (datasetId || amazonSearchDatasetId));

  const enabled =
    explicitEnabled !== undefined && explicitEnabled !== ''
      ? String(explicitEnabled).trim().toLowerCase() === 'true'
      : inferredEnabled;

  return {
    enabled,
    apiKey,
    amazonDatasetId: datasetId,
    amazonSearchDatasetId,
    homeDepotDatasetId,
  };
}

/** Default 120000. Env: BRIGHTDATA_HOMEDEPOT_DISCOVERY_TIMEOUT_MS */
export function getHomeDepotDiscoveryTimeoutMs(): number {
  const v = process.env.BRIGHTDATA_HOMEDEPOT_DISCOVERY_TIMEOUT_MS;
  if (!v) return 120_000;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}

/** Default 3. Env: BRIGHTDATA_HOMEDEPOT_MAX_RETRIES */
export function getHomeDepotMaxRetries(): number {
  const v = process.env.BRIGHTDATA_HOMEDEPOT_MAX_RETRIES;
  const fallback = 3;
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}

/** Clamp Bright Data "how many SERP rows per keyword" (default 30). Env: BRIGHTDATA_LIMIT_PER_INPUT */
export function getLimitPerInput(): number {
  const v = process.env.BRIGHTDATA_LIMIT_PER_INPUT;
  const fallback = 30;
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, n));
}

export interface AmazonMatchSearchDepths {
  /** First-pass: max normalized rows scored (default 20). Env: BRIGHTDATA_AMAZON_MATCH_DEPTH */
  defaultDepth: number;
  /** Escalation pass when no strong winner (default 50). Env: BRIGHTDATA_AMAZON_MATCH_DEPTH_ESCALATION */
  escalationDepth: number;
}

/**
 * How many Amazon discovery rows we run through the matcher (after Bright Data returns data).
 * Escalation depth is never below default depth.
 */
export function getAmazonMatchSearchDepths(): AmazonMatchSearchDepths {
  const defRaw = process.env.BRIGHTDATA_AMAZON_MATCH_DEPTH;
  const escRaw = process.env.BRIGHTDATA_AMAZON_MATCH_DEPTH_ESCALATION;
  let defaultDepth = defRaw ? parseInt(defRaw, 10) : 20;
  if (!Number.isFinite(defaultDepth)) defaultDepth = 20;
  defaultDepth = Math.min(100, Math.max(1, defaultDepth));

  let escalationDepth = escRaw ? parseInt(escRaw, 10) : 50;
  if (!Number.isFinite(escalationDepth)) escalationDepth = 50;
  escalationDepth = Math.min(100, Math.max(1, escalationDepth));
  if (escalationDepth < defaultDepth) escalationDepth = defaultDepth;

  return { defaultDepth, escalationDepth };
}

/**
 * Call at startup when Bright Data is required.
 * Throws if BRIGHTDATA_ENABLED=true but API_KEY or DATASET_ID is missing.
 */
export function assertBrightDataConfigWhenEnabled(): void {
  const enabled = String(process.env.BRIGHTDATA_ENABLED || '').trim().toLowerCase() === 'true';
  if (!enabled) return;

  const apiKey = (process.env.BRIGHTDATA_API_KEY || '').trim();
  const datasetId =
    (process.env.BRIGHTDATA_DATASET_ID || '').trim() ||
    (process.env.BRIGHTDATA_AMAZON_DATASET_ID || '').trim();

  const missing: string[] = [];
  if (!apiKey) missing.push('BRIGHTDATA_API_KEY');
  if (!datasetId) missing.push('BRIGHTDATA_DATASET_ID or BRIGHTDATA_AMAZON_DATASET_ID');

  if (missing.length > 0) {
    throw new Error(
      `Bright Data is enabled (BRIGHTDATA_ENABLED=true) but required env vars are missing: ${missing.join(', ')}. Set them in server/.env`
    );
  }
}
