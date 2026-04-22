export type DealState = 'deal' | 'no_deal' | 'no_price' | 'no_baseline';

/**
 * Sticky QB baseline when set; otherwise legacy baselinePrice (same fallback as Fix Match UI).
 */
export function effectiveBaselineForSavings(item: {
  baselineUnitPrice: number | null;
  baselinePrice?: number | null;
}): number | null {
  if (item.baselineUnitPrice != null && item.baselineUnitPrice > 0) return item.baselineUnitPrice;
  if (item.baselinePrice != null && item.baselinePrice > 0) return item.baselinePrice;
  return null;
}

/**
 * Best observed retail price: from price-check quotes when present, else catalog matched price.
 */
export function effectiveBestRetailUnitPrice(item: {
  bestDealUnitPrice: number | null;
  matchedPrice?: number | null;
}): number | null {
  if (item.bestDealUnitPrice != null && item.bestDealUnitPrice > 0) return item.bestDealUnitPrice;
  if (item.matchedPrice != null && item.matchedPrice > 0) return item.matchedPrice;
  return null;
}

export interface ComputeDealStateInput {
  baselineUnitPrice: number | null;
  bestDealUnitPrice: number | null;
}

export interface ComputeDealStateOutput {
  dealState: DealState;
  bestPriceToday: number | null;
  baselineUnitPrice: number | null;
  savingsAmount: number | null;
  savingsPct: number | null;
  /** Alias for savingsAmount (per-unit savings). */
  estimatedSavings: number | null;
  /** Alias for savingsPct (percentage). */
  savingsPercent: number | null;
}

/**
 * Compute deal state per Procuro rules:
 * - no_baseline: baselineUnitPrice is null
 * - no_price: bestDealUnitPrice is null (no price today)
 * - deal: bestDealUnitPrice < baselineUnitPrice → compute savings
 * - no_deal: bestDealUnitPrice >= baselineUnitPrice
 */
export function computeDealState(input: ComputeDealStateInput): ComputeDealStateOutput {
  const { baselineUnitPrice, bestDealUnitPrice } = input;

  if (baselineUnitPrice == null) {
    return {
      dealState: 'no_baseline',
      bestPriceToday: bestDealUnitPrice,
      baselineUnitPrice: null,
      savingsAmount: null,
      savingsPct: null,
      estimatedSavings: null,
      savingsPercent: null,
    };
  }

  if (bestDealUnitPrice == null) {
    return {
      dealState: 'no_price',
      bestPriceToday: null,
      baselineUnitPrice,
      savingsAmount: null,
      savingsPct: null,
      estimatedSavings: null,
      savingsPercent: null,
    };
  }

  if (bestDealUnitPrice < baselineUnitPrice) {
    const savingsAmount = baselineUnitPrice - bestDealUnitPrice;
    const savingsPct = baselineUnitPrice > 0
      ? ((baselineUnitPrice - bestDealUnitPrice) / baselineUnitPrice) * 100
      : 0;
    return {
      dealState: 'deal',
      bestPriceToday: bestDealUnitPrice,
      baselineUnitPrice,
      savingsAmount,
      savingsPct,
      estimatedSavings: savingsAmount,
      savingsPercent: savingsPct,
    };
  }

  return {
    dealState: 'no_deal',
    bestPriceToday: bestDealUnitPrice,
    baselineUnitPrice,
    savingsAmount: null,
    savingsPct: null,
    estimatedSavings: null,
    savingsPercent: null,
  };
}
