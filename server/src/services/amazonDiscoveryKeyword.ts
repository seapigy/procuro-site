import { normalizeSearchQuery } from './matching/normalize';

export type ItemAmazonDiscoveryFields = {
  name: string;
  productBrand?: string | null;
  amazonSearchHint?: string | null;
  amazonAsin?: string | null;
};

/**
 * Keyword sent to Bright Data Amazon search: ASIN (if any) + optional brand + optional hint + item name, then normalized.
 */
export function buildAmazonDiscoveryKeyword(item: ItemAmazonDiscoveryFields): string {
  const parts: string[] = [];
  const asin = item.amazonAsin?.trim();
  if (asin) parts.push(asin);
  const brand = item.productBrand?.trim();
  if (brand) parts.push(brand);
  const hint = item.amazonSearchHint?.trim();
  if (hint) parts.push(hint);
  parts.push(item.name || '');
  return normalizeSearchQuery(parts.join(' '));
}

/** Broaden keyword for a second discovery attempt (drops trailing pack/count tokens). */
export function broadenAmazonDiscoveryKeyword(normalizedKeyword: string): string {
  let s = normalizedKeyword.replace(/\s+\d+\s*pack\b/gi, ' ').replace(/\bpack\s+of\s+\d+\b/gi, ' ');
  s = s.replace(/\s+\d+\s*ct\b/gi, ' ').replace(/\s+\d+\s*count\b/gi, ' ');
  return normalizeSearchQuery(s);
}

/**
 * Single keyword for aggregate provider HTTP checks (Office Depot, etc.).
 * Omits ASIN so non-Amazon retailers still get a text query.
 */
export function buildAggregateProviderKeyword(item: ItemAmazonDiscoveryFields): string {
  const parts: string[] = [];
  const brand = item.productBrand?.trim();
  if (brand) parts.push(brand);
  const hint = item.amazonSearchHint?.trim();
  if (hint) parts.push(hint);
  parts.push(item.name || '');
  return normalizeSearchQuery(parts.join(' '));
}
