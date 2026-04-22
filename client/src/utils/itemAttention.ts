import { hasConcreteMatchEvidence } from './itemMatchQuality';

/**
 * Minimal item shape for attention predicates (Dashboard + Items).
 * Aligns with row badge logic in Items.tsx.
 */
export type AttentionItem = {
  name: string;
  needsClarification: boolean;
  isManuallyMatched?: boolean;
  matchStatus?: string | null;
  matchProvider?: string | null;
  matchedRetailer?: string | null;
  matchUrl?: string | null;
  matchedUrl?: string | null;
  matchTitle?: string | null;
  manualMatchTitle?: string | null;
  matchedPrice?: number | null;
  matchConfidence?: number | null;
};

export function needsClarificationAttention(item: AttentionItem): boolean {
  return item.needsClarification && !(item.isManuallyMatched && item.matchStatus === 'overridden');
}

export function needsMatchReviewAttention(item: AttentionItem): boolean {
  if (needsClarificationAttention(item)) return false;
  const ev = hasConcreteMatchEvidence({
    itemName: item.name,
    matchProvider: item.matchProvider,
    matchedRetailer: item.matchedRetailer,
    matchUrl: item.matchUrl,
    matchedUrl: item.matchedUrl,
    matchTitle: item.matchTitle,
    manualMatchTitle: item.manualMatchTitle,
    matchedPrice: item.matchedPrice,
    matchConfidence: item.matchConfidence,
  });
  return item.matchStatus === 'needs_review' || (item.matchStatus === 'unmatched' && ev);
}

export type AttentionFilterParam = 'clarification' | 'match_review';

export function parseAttentionParam(value: string | null): AttentionFilterParam | null {
  if (value === 'clarification' || value === 'match_review') return value;
  return null;
}
