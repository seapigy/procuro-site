/**
 * Generic brand/entity inference from item names.
 * Uses multiple signals (leading tokens, hyphenation, capitalization, known list)
 * to identify likely brand tokens without hardcoding specific products.
 */

/** Known brands for confirmation (one signal among many). */
const KNOWN_BRANDS = new Set([
  'hp', 'hewlett', 'packard', 'brother', 'canon', 'epson', 'dell', 'lenovo', 'alienware',
  'georgia', 'pacific', 'kirkland', 'scotch', '3m', 'simpson', 'strong', 'tie',
  'staples', 'bic', 'sharpie', 'pilot', 'uniball', 'pentel', 'hamilton', 'beach',
  'muji', 'zebra', 'fiskars', 'rockwell', 'worx', 'bosch', 'dewalt',
  'milwaukee', 'makita', 'ryobi', 'black', 'decker', 'craftsman', 'husky', 'kobalt',
  'hammermill', 'clorox', 'lysol', 'scotch-brite', 'scotchbrite', 'rubbermaid',
  'glad', 'hefty', 'reynolds', 'dixie', 'chinet', 'solo', 'sweetwater',
  'grainger', 'fastenal', 'menards', 'lowes', 'homedepot', 'sherwin', 'williams',
  'rustoleum', 'krylon', 'behr', 'benjamin', 'moore', 'duracell', 'energizer',
  'chemical', 'guys', 'meguiars', 'turtle', 'wax', 'armor', 'all', 'georgia-pacific',
  'post-it', 'postit',
]);

/** Common product/category words that are rarely brands. */
const COMMON_PRODUCT_WORDS = new Set([
  'paper', 'notes', 'pack', 'count', 'sheets', 'wipes', 'bags', 'markers', 'trash',
  'printer', 'copy', 'disinfecting', 'cleaning', 'all', 'purpose', 'cleaner',
  'aluminum', 'foil', 'wrap', 'lumber', 'nails', 'screws', 'monitor', 'led',
  'inch', 'inches', 'oz', 'lb', 'gal', 'ml', 'yellow', 'black', 'white', 'red',
  'blue', 'green', 'gray', 'grey', 'brown', 'orange', 'douglas', 'fir',
  'strong', 'tie', 'galvanized', 'multipurpose', 'letter', 'size', 'value',
  'original', 'premium', 'professional', 'everyday', 'business', 'recycled',
  'extra', 'bright', 'case', 'ream', 'reams', 'box', 'each', 'bulk',
]);

/** Stopwords and very common words. */
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'with', 'in', 'by']);

export interface BrandInferenceResult {
  brand?: string;
  confidence: number;
  signals: string[];
}

/**
 * Infer likely brand/entity token(s) from an item name using generic signals.
 * Returns the best candidate with confidence and which signals fired.
 */
export function inferBrandFromItemName(itemName: string): BrandInferenceResult {
  const trimmed = itemName.trim();
  if (!trimmed) return { confidence: 0, signals: [] };

  const signals: string[] = [];
  let bestBrand: string | undefined;
  let bestScore = 0;

  const tokens = trimmed.split(/\s+/);
  const lower = trimmed.toLowerCase();

  const scoreCandidate = (candidate: string, candidateLower: string): number => {
    if (candidate.length < 2 || candidate.length > 25) return 0;
    if (STOPWORDS.has(candidateLower)) return 0;
    if (/^\d+$/.test(candidate)) return 0;

    let score = 0;

    if (KNOWN_BRANDS.has(candidateLower)) {
      score += 0.4;
    }
    if (candidate.includes('-')) {
      score += 0.25;
    }
    if (/^[A-Z]/.test(candidate) || /[A-Z]/.test(candidate)) {
      score += 0.15;
    }
    if (!COMMON_PRODUCT_WORDS.has(candidateLower)) {
      score += 0.1;
    }

    return score;
  };

  const tryCandidate = (candidate: string, pos: string) => {
    const cLower = candidate.toLowerCase();
    const s = scoreCandidate(candidate, cLower);
    if (s > bestScore) {
      bestScore = s;
      bestBrand = cLower;
      signals.length = 0;
      signals.push(pos);
      if (KNOWN_BRANDS.has(cLower)) signals.push('known_brand');
      if (candidate.includes('-')) signals.push('hyphenated');
      if (/^[A-Z]/.test(candidate) || /[A-Z]/.test(candidate)) signals.push('capitalized');
    } else if (s === bestScore && s > 0 && bestBrand === cLower) {
      if (!signals.includes(pos)) signals.push(pos);
    }
  };

  if (tokens.length >= 1) {
    tryCandidate(tokens[0], 'leading_token');
  }
  if (tokens.length >= 2) {
    const two = `${tokens[0]} ${tokens[1]}`;
    const twoLower = two.toLowerCase();
    if (KNOWN_BRANDS.has(twoLower) || two.includes('-')) {
      const s = scoreCandidate(two, twoLower) + 0.2;
      if (s > bestScore) {
        bestScore = s;
        bestBrand = twoLower;
        signals.length = 0;
        signals.push('leading_two_tokens');
        if (KNOWN_BRANDS.has(twoLower)) signals.push('known_brand');
        if (two.includes('-')) signals.push('hyphenated');
      }
    }
    tryCandidate(tokens[1], 'second_token');
  }

  for (const token of tokens) {
    if (token.includes('-') && token.length >= 4) {
      tryCandidate(token, 'hyphenated_token');
    }
  }

  const wordBoundary = (s: string) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  for (const brand of KNOWN_BRANDS) {
    if (brand.length >= 4 && wordBoundary(brand).test(lower)) {
      const s = 0.35;
      if (s > bestScore || (s === bestScore && brand.length > (bestBrand?.length ?? 0))) {
        bestScore = s;
        bestBrand = brand;
        signals.length = 0;
        signals.push('known_brand_anywhere');
      }
    }
  }

  const confidence = Math.min(1, bestScore);
  if (bestBrand && confidence >= 0.25) {
    return { brand: bestBrand, confidence, signals };
  }
  return { confidence: 0, signals: [] };
}
