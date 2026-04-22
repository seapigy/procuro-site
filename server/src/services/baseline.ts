/**
 * Baseline price computation for items.
 * Baseline is sticky (P90 or max of valid unit prices from QB history).
 * Used for savings calculations; never use $0 or invalid prices.
 */

const MAX_VALID_UNIT_PRICE = 100_000;

/**
 * Check if a unit price from QuickBooks is valid for baseline computation.
 * Valid: unitPrice != null, > 0, and (optional) < 100000 to avoid garbage.
 */
export function isValidUnitPrice(unitPrice: number | null | undefined, quantity?: number): boolean {
  if (unitPrice == null || typeof unitPrice !== 'number' || !Number.isFinite(unitPrice)) return false;
  if (unitPrice <= 0) return false;
  if (quantity != null && quantity <= 0) return false;
  if (unitPrice >= MAX_VALID_UNIT_PRICE) return false;
  return true;
}

/**
 * Compute the 90th percentile of an array of numbers (ascending order, then index at 90%).
 * Returns the value at P90; if array is empty returns 0.
 */
export function computeP90(prices: number[]): number {
  const sorted = [...prices].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * 0.9) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Compute baseline and source from valid historical unit prices.
 * - P90 if >= 5 valid prices
 * - max(validPrices) if < 5 valid prices
 * Returns { baseline, source }; baseline is 0 if no valid prices.
 */
export function computeBaseline(prices: number[]): { baseline: number; source: string } {
  const valid = prices.filter((p) => p != null && Number.isFinite(p) && p > 0 && p < MAX_VALID_UNIT_PRICE);
  if (valid.length === 0) return { baseline: 0, source: 'none' };
  if (valid.length < 5) {
    const maxPrice = Math.max(...valid);
    return { baseline: maxPrice, source: 'qb_max_fallback' };
  }
  const p90 = computeP90(valid);
  return { baseline: p90, source: 'qb_p90' };
}
