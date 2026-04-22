/**
 * Client-side heuristics for match-quality UX (nudges, not authoritative matching).
 */

export type MatchQualityLevel = 'low' | 'medium' | 'high';

export interface MatchQualityContext {
  name: string;
  productBrand: string;
  vendorName?: string | null;
  amazonSearchHint?: string | null;
  needsClarification?: boolean;
  isVagueName?: boolean;
  matchStatus?: string | null;
  matchConfidence?: number | null;
  /** From localStorage: consecutive price checks with no retailer prices */
  noPriceCheckStreak?: number;
}

export interface MatchEvidenceContext {
  itemName: string;
  matchProvider?: string | null;
  matchedRetailer?: string | null;
  matchUrl?: string | null;
  matchedUrl?: string | null;
  matchTitle?: string | null;
  manualMatchTitle?: string | null;
  matchedPrice?: number | null;
  matchConfidence?: number | null;
}

const GENERIC_ONE_WORD = new Set([
  'paper',
  'nails',
  'tape',
  'screws',
  'bolts',
  'wipes',
  'cleaner',
  'soap',
  'gloves',
  'masks',
  'filters',
  'batteries',
  'ink',
  'toner',
  'cable',
]);

/**
 * Rough client-side vague signal when server flags are unavailable (e.g. add-item form).
 */
export function heuristicVagueName(name: string): boolean {
  const t = name.trim().toLowerCase();
  if (!t) return true;
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length <= 1) {
    return t.length < 20 || GENERIC_ONE_WORD.has(words[0] || '');
  }
  if (words.length === 2 && t.length < 28) return true;
  return false;
}

export function computeMatchQuality(ctx: MatchQualityContext): {
  level: MatchQualityLevel;
  label: string;
} {
  let score = 55;
  const brand = ctx.productBrand?.trim() ?? '';
  const name = ctx.name?.trim() ?? '';

  if (brand) score += 22;
  else score -= 18;

  if (ctx.needsClarification || ctx.isVagueName) score -= 28;
  else if (heuristicVagueName(name)) score -= 12;

  const status = ctx.matchStatus ?? '';
  if (status === 'unmatched' || status === 'needs_review') score -= 18;
  if (ctx.matchConfidence != null && ctx.matchConfidence < 0.5) score -= 14;

  if (ctx.amazonSearchHint?.trim()) score += 8;

  const streak = ctx.noPriceCheckStreak ?? 0;
  if (streak >= 2) score -= 22;

  let level: MatchQualityLevel;
  let label: string;
  if (score >= 68) {
    level = 'high';
    label = 'High';
  } else if (score >= 42) {
    level = 'medium';
    label = 'Medium';
  } else {
    level = 'low';
    label = 'Low';
  }

  // Retailer match confidence from the server (Fix Match / list row %) is separate from "form
  // looks complete." If the backend says <50%, never show High/Medium — aligns orange ! and Fix
  // Match % with this badge.
  if (ctx.matchConfidence != null && ctx.matchConfidence < 0.5) {
    return {
      level: 'low',
      label: level === 'low' ? 'Low' : 'Low (verify retailer match)',
    };
  }

  return { level, label };
}

export function hasConcreteMatchEvidence(ctx: MatchEvidenceContext): boolean {
  const normalizedItemTitle = (ctx.itemName || '').trim().toLowerCase();
  const normalizedMatchTitle = (ctx.matchTitle || ctx.manualMatchTitle || '').trim().toLowerCase();
  const hasDistinctMatchedTitle =
    normalizedMatchTitle.length > 0 && normalizedMatchTitle !== normalizedItemTitle;
  const hasProvider =
    (ctx.matchProvider || '').trim().length > 0 || (ctx.matchedRetailer || '').trim().length > 0;
  const hasUrl = (ctx.matchUrl || '').trim().length > 0 || (ctx.matchedUrl || '').trim().length > 0;
  const hasPrice = typeof ctx.matchedPrice === 'number' && Number.isFinite(ctx.matchedPrice);
  const hasConfidence = typeof ctx.matchConfidence === 'number' && Number.isFinite(ctx.matchConfidence) && ctx.matchConfidence > 0;

  return hasProvider || hasUrl || hasPrice || hasDistinctMatchedTitle || hasConfidence;
}

/** True when we should show an extra confirmation before persisting a save. */
export function isHighRiskForSaveNudge(ctx: MatchQualityContext): boolean {
  const brand = ctx.productBrand?.trim() ?? '';
  const name = ctx.name?.trim() ?? '';
  const status = ctx.matchStatus ?? '';

  if (!brand) {
    return (
      ctx.needsClarification ||
      ctx.isVagueName ||
      heuristicVagueName(name) ||
      status === 'unmatched' ||
      status === 'needs_review' ||
      (ctx.matchConfidence != null && ctx.matchConfidence < 0.5) ||
      (ctx.noPriceCheckStreak ?? 0) >= 2
    );
  }

  return (
    ctx.needsClarification ||
    ctx.isVagueName ||
    heuristicVagueName(name) ||
    status === 'unmatched' ||
    status === 'needs_review' ||
    (ctx.matchConfidence != null && ctx.matchConfidence < 0.5) ||
    (ctx.noPriceCheckStreak ?? 0) >= 2
  );
}

const NO_PRICE_PREFIX = 'procuro:no-price-streak:';

export function getNoPriceCheckStreak(itemId: number): number {
  try {
    const v = localStorage.getItem(NO_PRICE_PREFIX + itemId);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function recordNoPriceCheckResult(itemId: number, hadAnyRetailerPrice: boolean): void {
  try {
    const key = NO_PRICE_PREFIX + itemId;
    if (hadAnyRetailerPrice) {
      localStorage.removeItem(key);
    } else {
      const prev = getNoPriceCheckStreak(itemId);
      localStorage.setItem(key, String(prev + 1));
    }
  } catch {
    /* ignore */
  }
}

export function qualityLevelBadgeClass(level: MatchQualityLevel): string {
  switch (level) {
    case 'high':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'medium':
      return 'text-amber-700 dark:text-amber-400';
    default:
      return 'text-red-700 dark:text-red-400';
  }
}
