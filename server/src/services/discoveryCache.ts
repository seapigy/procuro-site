/**
 * In-memory cache for Amazon discovery results.
 * TTL 24 hours. Reuses results across companies when normalized item name matches.
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function makeKey(normalizedItemName: string): string {
  return normalizedItemName.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get cached discovery rows for a normalized item name.
 * Returns null if miss or expired.
 */
export function getCachedDiscoveryRows(normalizedItemName: string): unknown[] | null {
  const key = makeKey(normalizedItemName);
  const entry = cache.get(key) as CacheEntry<unknown[]> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Store discovery rows for a normalized item name.
 */
export function setCachedDiscoveryRows(normalizedItemName: string, rows: unknown[]): void {
  const key = makeKey(normalizedItemName);
  cache.set(key, {
    value: rows,
    expiresAt: Date.now() + TTL_MS,
  });
}

/**
 * Clear cache (for testing).
 */
export function clearDiscoveryCache(): void {
  cache.clear();
}
