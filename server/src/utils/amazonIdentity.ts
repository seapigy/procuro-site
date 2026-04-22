/**
 * Shared Amazon identity extraction and canonical URL helpers.
 * Used by priceCheck and brightDataJobs for auto-persist.
 */

const ASIN_REGEX = /\/dp\/([A-Z0-9]{10})/i;
const GP_PRODUCT_REGEX = /\/gp\/product\/([A-Z0-9]{10})/i;

/**
 * Extract ASIN in order: rawJson.asin, rawJson.url, quoteUrl.
 */
export function extractAsin(
  rawJson: Record<string, unknown> | null,
  quoteUrl: string | undefined
): string | null {
  if (rawJson?.asin && typeof rawJson.asin === 'string' && rawJson.asin.trim()) {
    return rawJson.asin.trim();
  }
  const rawUrl = rawJson?.url;
  if (typeof rawUrl === 'string') {
    const m = rawUrl.match(ASIN_REGEX) ?? rawUrl.match(GP_PRODUCT_REGEX);
    if (m) return m[1];
  }
  if (typeof quoteUrl === 'string') {
    const m = quoteUrl.match(ASIN_REGEX) ?? quoteUrl.match(GP_PRODUCT_REGEX);
    if (m) return m[1];
  }
  return null;
}

/**
 * Build canonical Amazon product URL. Returns null if no ASIN.
 */
export function buildCanonicalProductUrl(asin: string | null): string | null {
  if (!asin || !asin.trim()) return null;
  return `https://www.amazon.com/dp/${asin.trim()}`;
}
