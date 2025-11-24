import { WalmartProvider } from '../../../providers/walmart';
import { TargetProvider } from '../../../providers/target';
// import { AmazonProvider } from '../../../providers/amazon'; // Once PA-API unlocks

interface RetailerMatch {
  retailer: string;
  title: string;
  price: number;
  url: string;
  score: number;
}

interface MatchResult {
  retailer: string;
  title: string;
  price: number;
  url: string;
}

/**
 * Normalize item name for better searching
 */
function normalizeItemName(itemName: string): string {
  // Lowercase
  let normalized = itemName.toLowerCase();

  // Remove punctuation
  normalized = normalized.replace(/[^\w\s]/g, ' ');

  // Remove stopwords
  const stopwords = ['the', 'pack', 'box', 'case', 'count', 'ct', 'of', 'a', 'an'];
  const words = normalized.split(/\s+/).filter(word => {
    return word.length > 0 && !stopwords.includes(word);
  });

  // Rejoin
  normalized = words.join(' ');

  return normalized.trim();
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 and 1 (1 being perfect match)
 */
function calculateSimilarity(str1: string, str2: string): number {
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
 * Check if price is reasonable compared to reference price
 */
function isPriceReasonable(price: number, referencePrice: number): boolean {
  if (referencePrice === 0) return true;
  
  const ratio = price / referencePrice;
  // Reject prices that are 4x higher or 0.25x lower
  return ratio >= 0.25 && ratio <= 4.0;
}

/**
 * Extract number from string (e.g., "500 sheets" -> 500)
 */
function extractPackagingSize(text: string): number | null {
  const match = text.match(/(\d+)\s*(sheet|count|ct|pack|oz|lb|g|kg|ml|l)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Score a result based on multiple factors
 */
function scoreResult(
  result: { title: string; price: number; url: string },
  normalizedQuery: string,
  referencePrice: number
): number {
  let score = 0;

  // 1. Title similarity (weight: 60%)
  const normalizedTitle = normalizeItemName(result.title);
  const titleSimilarity = calculateSimilarity(normalizedQuery, normalizedTitle);
  score += titleSimilarity * 0.6;

  // 2. Price reasonableness (weight: 20%)
  if (isPriceReasonable(result.price, referencePrice)) {
    // Closer to reference price = better score
    const priceDiff = Math.abs(result.price - referencePrice) / referencePrice;
    const priceScore = Math.max(0, 1 - priceDiff);
    score += priceScore * 0.2;
  } else {
    // Unreasonable price = heavy penalty
    score *= 0.3;
  }

  // 3. Packaging size stability (weight: 20%)
  const querySize = extractPackagingSize(normalizedQuery);
  const resultSize = extractPackagingSize(result.title);
  
  if (querySize && resultSize) {
    // Prefer similar packaging sizes
    const sizeRatio = Math.min(querySize, resultSize) / Math.max(querySize, resultSize);
    score += sizeRatio * 0.2;
  } else {
    // No size info, give neutral score
    score += 0.1;
  }

  return score;
}

/**
 * Match an item to the best retailer product
 */
export async function matchItemToRetailers(
  itemName: string,
  lastPaidPrice: number = 0
): Promise<MatchResult | null> {
  console.log(`\n🔍 Matching item: "${itemName}"`);

  // Normalize the search query
  const normalizedName = normalizeItemName(itemName);
  console.log(`   Normalized: "${normalizedName}"`);

  try {
    // Call all providers in parallel
    const [walmartResult, targetResult] = await Promise.all([
      WalmartProvider.getPriceByName(itemName).catch(err => {
        console.error('Walmart search error:', err.message);
        return null;
      }),
      TargetProvider.getPriceByName(itemName).catch(err => {
        console.error('Target search error:', err.message);
        return null;
      }),
      // AmazonProvider.getPriceByName(itemName) // Once PA-API unlocks
    ]);

    // Collect valid results
    const candidates: RetailerMatch[] = [];

    if (walmartResult && walmartResult.price !== null && walmartResult.url !== null) {
      const score = scoreResult(
        { title: itemName, price: walmartResult.price, url: walmartResult.url },
        normalizedName,
        lastPaidPrice
      );
      candidates.push({
        retailer: 'Walmart',
        title: itemName, // Walmart API doesn't return title in current implementation
        price: walmartResult.price,
        url: walmartResult.url,
        score,
      });
    }

    if (targetResult && targetResult.price !== null && targetResult.url !== null) {
      const score = scoreResult(
        { title: itemName, price: targetResult.price, url: targetResult.url },
        normalizedName,
        lastPaidPrice
      );
      candidates.push({
        retailer: 'Target',
        title: itemName, // Target API doesn't return title in current implementation
        price: targetResult.price,
        url: targetResult.url,
        score,
      });
    }

    if (candidates.length === 0) {
      console.log('❌ No matches found');
      return null;
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);

    const bestMatch = candidates[0];
    console.log(`✅ Best match: ${bestMatch.retailer}`);
    console.log(`   Price: $${bestMatch.price.toFixed(2)}`);
    console.log(`   Score: ${(bestMatch.score * 100).toFixed(1)}%`);
    console.log(`   URL: ${bestMatch.url}`);

    return {
      retailer: bestMatch.retailer,
      title: bestMatch.title,
      price: bestMatch.price,
      url: bestMatch.url,
    };
  } catch (error) {
    console.error('Error matching item to retailers:', error);
    return null;
  }
}

// Test function (run standalone)
if (require.main === module) {
  (async () => {
    console.log('🧪 Testing Item Matcher...\n');

    const testItems = [
      { name: 'HP Printer Paper 500 Sheets', price: 29.99 },
      { name: 'Scotch Tape 12-Pack', price: 15.99 },
    ];

    for (const item of testItems) {
      const match = await matchItemToRetailers(item.name, item.price);
      if (match) {
        console.log('\n📦 Match Result:');
        console.log(JSON.stringify(match, null, 2));
      }
      console.log('\n---\n');
    }
  })();
}







