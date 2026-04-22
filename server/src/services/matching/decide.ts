/**
 * Match Decision Service
 * Determines match status based on scores and item state
 */

import { ScoreResult, Candidate } from './score';

export type MatchStatus = 'unmatched' | 'auto_matched' | 'needs_review' | 'verified' | 'overridden';

export interface ScoredCandidate extends Candidate {
  scoreResult: ScoreResult;
}

export interface MatchDecision {
  status: MatchStatus;
  best: ScoredCandidate | null;
  alternatives: ScoredCandidate[];
  confidence: number;
  needsReviewReason?: string;
}

/**
 * Decide match status based on scored candidates and item state
 */
export function decideMatch(
  scoredCandidates: ScoredCandidate[],
  isManuallyMatched: boolean = false
): MatchDecision {
  // If manually matched, do not auto-change match
  if (isManuallyMatched) {
    // Return the best candidate but with overridden/verified status
    // The actual status should come from the item's matchStatus field
    // This function will be called to suggest, but the decision is preserved
    if (scoredCandidates.length > 0) {
      return {
        status: 'overridden', // Default to overridden, but should check item.matchStatus
        best: scoredCandidates[0],
        alternatives: scoredCandidates.slice(1, 4), // Top 3 alternatives
        confidence: scoredCandidates[0].scoreResult.score,
      };
    }
    return {
      status: 'overridden',
      best: null,
      alternatives: [],
      confidence: 0,
    };
  }

  // Sort candidates by score (highest first)
  const sorted = [...scoredCandidates].sort(
    (a, b) => b.scoreResult.score - a.scoreResult.score
  );

  if (sorted.length === 0) {
    return {
      status: 'unmatched',
      best: null,
      alternatives: [],
      confidence: 0,
    };
  }

  const best = sorted[0];
  const bestScore = best.scoreResult.score;
  const nextBest = sorted.length > 1 ? sorted[1] : null;
  const scoreGap = nextBest ? bestScore - nextBest.scoreResult.score : bestScore;

  // Decision logic:
  // - If best score >= 0.82 and gap >= 0.08 → auto_matched
  // - If best score between 0.65 and 0.82 → needs_review
  // - Else → unmatched

  if (bestScore >= 0.82 && scoreGap >= 0.08) {
    return {
      status: 'auto_matched',
      best,
      alternatives: sorted.slice(1, 4), // Top 3 alternatives
      confidence: bestScore,
    };
  }

  if (bestScore >= 0.65 && bestScore < 0.82) {
    let needsReviewReason = 'Match confidence is moderate';
    if (scoreGap < 0.08) {
      needsReviewReason += ' (multiple similar candidates)';
    } else if (bestScore < 0.75) {
      needsReviewReason += ' (below high confidence threshold)';
    }

    return {
      status: 'needs_review',
      best,
      alternatives: sorted.slice(1, 4),
      confidence: bestScore,
      needsReviewReason,
    };
  }

  // bestScore < 0.65 — still return the top candidate so discovery can show a product to verify
  return {
    status: 'needs_review',
    best,
    alternatives: sorted.slice(1, 4),
    confidence: bestScore,
    needsReviewReason:
      bestScore < 0.5
        ? 'Match confidence is low — verify this product or use Override'
        : 'Match confidence is moderate — confirm before relying on this product',
  };
}



