/**
 * Candidate Scoring Service
 * Scores candidate matches based on multiple weighted factors
 */

import { NormalizedItem } from './normalize';

export interface Candidate {
  title: string;
  price: number;
  url: string;
  retailer: string;
}

export interface ScoreResult {
  score: number;
  reasons: {
    tokenOverlap: number;
    editSimilarity: number;
    brandMatch: number;
    sizeMatch: number;
    priceRatio: number;
  };
}

/**
 * Calculate Jaccard similarity (intersection over union) of token sets
 */
function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Calculate Levenshtein distance-based similarity
 * Returns a score between 0 and 1 (1 being perfect match)
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Quick exact match check
  if (s1 === s2) return 1;

  // Check for substring matches
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return shorter.length / longer.length * 0.95; // High score but not perfect
  }

  // Levenshtein distance
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  return maxLength === 0 ? 1 : 1 - costs[s2.length] / maxLength;
}

/**
 * Score a candidate match against normalized item metadata
 */
export function scoreCandidate(
  itemMeta: NormalizedItem,
  candidate: Candidate,
  lastPaidPrice?: number
): ScoreResult {
  // Normalize candidate title for comparison
  const candidateNormalized = candidate.title.toLowerCase().trim().replace(/\s+/g, ' ');
  const candidateTokens = candidateNormalized
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);

  // 1. Token overlap (Jaccard similarity) - 40% weight
  const tokenOverlap = jaccardSimilarity(itemMeta.tokens, candidateTokens);

  // 2. Edit similarity (Levenshtein) - 25% weight
  const editSimilarity = levenshteinSimilarity(
    itemMeta.normalized,
    candidateNormalized
  );

  // 3. Brand match boost - 15% weight (only if brand extracted)
  let brandMatch = 0;
  if (itemMeta.brand) {
    const brandLower = itemMeta.brand.toLowerCase();
    if (candidateNormalized.includes(brandLower)) {
      brandMatch = 1.0;
    } else {
      // Partial brand match (check if brand tokens appear)
      const brandTokens = brandLower.split(/\s+/);
      const allBrandTokensMatch = brandTokens.every(token => 
        candidateTokens.some(t => t.includes(token) || token.includes(t))
      );
      if (allBrandTokensMatch && brandTokens.length > 0) {
        brandMatch = 0.5;
      }
    }
  }

  // 4. Size/count match boost - 15% weight
  let sizeMatch = 0;
  if (itemMeta.size || itemMeta.count) {
    const extractedValue = itemMeta.size || itemMeta.count;
    if (extractedValue) {
      // Extract numeric part
      const numMatch = extractedValue.match(/\d+/);
      if (numMatch) {
        const value = numMatch[0];
        // Check if this value appears in candidate title
        if (candidateNormalized.includes(value)) {
          // Also check if unit matches
          const unitMatch = extractedValue.match(/(oz|lb|g|kg|ml|l|sheet|pack|ct|count)/i);
          if (unitMatch) {
            const unit = unitMatch[1].toLowerCase();
            if (candidateNormalized.includes(unit)) {
              sizeMatch = 1.0;
            } else {
              sizeMatch = 0.5; // Value matches but unit unclear
            }
          } else {
            sizeMatch = 0.5; // Value matches
          }
        }
      }
    }
  }

  // 5. Price sanity - 5% weight (penalize if price is >3x or <0.33x lastPaidPrice)
  let priceRatio = 1.0;
  if (lastPaidPrice && lastPaidPrice > 0) {
    const ratio = candidate.price / lastPaidPrice;
    if (ratio > 3.0 || ratio < 0.33) {
      // Heavy penalty for unreasonable prices
      priceRatio = 0.0;
    } else {
      // Prefer prices closer to lastPaidPrice
      // Score decreases as ratio deviates from 1.0
      const deviation = Math.abs(ratio - 1.0);
      priceRatio = Math.max(0, 1.0 - deviation * 0.5); // Linear penalty up to 50% reduction
    }
  }

  // Calculate weighted score
  const score =
    tokenOverlap * 0.4 +
    editSimilarity * 0.25 +
    brandMatch * 0.15 +
    sizeMatch * 0.15 +
    priceRatio * 0.05;

  return {
    score: Math.min(1.0, Math.max(0.0, score)), // Clamp to [0, 1]
    reasons: {
      tokenOverlap,
      editSimilarity,
      brandMatch,
      sizeMatch,
      priceRatio,
    },
  };
}



