/**
 * Item Name Normalization Service
 * Normalizes and extracts metadata from item names for better matching
 */

export interface NormalizedItem {
  normalized: string;
  tokens: string[];
  brand?: string;
  size?: string;
  count?: string;
  model?: string;
}

/**
 * Minimal brand list for extraction
 */
const KNOWN_BRANDS = [
  'hp', 'hewlett', 'packard', 'brother', 'canon', 'epson', 'dell', 'lenovo',
  'georgia', 'pacific', 'kirkland', 'scotch', '3m', 'simpson', 'strong',
  'tie', 'staples', 'bic', 'sharpie', 'pilot', 'uniball', 'pentel',
  'office', 'depot', 'hamilton', 'beach', 'post', 'it', 'muji', 'zebra',
  'fiskars', 'rockwell', 'worx', 'bosch', 'dewalt', 'milwaukee', 'makita',
  'ryobi', 'black', 'decker', 'craftsman', 'husky', 'kobalt'
];

/**
 * Normalize item name and extract metadata
 */
export function normalizeItemName(raw: string): NormalizedItem {
  // Start with lowercase and trim
  let normalized = raw.toLowerCase().trim();

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ');

  // Preserve units and dimensions before removing punctuation
  // Keep: oz, lb, g, kg, ml, l, in, ft, cm, mm, ct, pack, sheets, etc.
  // We'll handle punctuation removal carefully

  // Extract metadata first
  const brand = extractBrand(normalized);
  const size = extractSize(normalized);
  const count = extractCount(normalized);
  const model = extractModel(normalized);

  // Remove punctuation except keep units (replace with space then clean)
  // Keep numeric patterns with units
  normalized = normalized
    // Preserve unit patterns: "500 sheets", "12 oz", "2 pack", "100ct"
    .replace(/(\d+)\s*(oz|lb|g|kg|ml|l|in|inch|ft|foot|cm|mm|sheet|sheets|pack|packs|ct|count|counts)/gi, '$1 $2')
    // Remove other punctuation
    .replace(/[^\w\s]/g, ' ')
    // Collapse whitespace again
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize common units
  normalized = normalized
    .replace(/\bounces\b/gi, 'oz')
    .replace(/\bpounds\b/gi, 'lb')
    .replace(/\bgrams\b/gi, 'g')
    .replace(/\bkilograms\b/gi, 'kg')
    .replace(/\bmilliliters\b/gi, 'ml')
    .replace(/\bliters\b/gi, 'l')
    .replace(/\binches\b/gi, 'in')
    .replace(/\bfeet\b/gi, 'ft');

  // Tokenize
  const tokens = normalized
    .split(/\s+/)
    .filter(token => token.length > 0)
    .filter(token => {
      // Filter out very short stopwords but keep important ones
      const stopwords = ['the', 'a', 'an', 'of', 'and', 'or', 'for'];
      return !stopwords.includes(token) || token.length > 2;
    });

  return {
    normalized: normalized,
    tokens,
    brand,
    size,
    count,
    model,
  };
}

/**
 * Extract brand from normalized name
 * Checks if first token or first few tokens match known brands
 */
function extractBrand(normalized: string): string | undefined {
  const tokens = normalized.split(/\s+/);
  
  // Check first token
  if (tokens.length > 0) {
    const firstToken = tokens[0];
    if (KNOWN_BRANDS.includes(firstToken)) {
      return firstToken;
    }
  }
  
  // Check first two tokens (for multi-word brands like "Georgia Pacific")
  if (tokens.length >= 2) {
    const twoWord = `${tokens[0]} ${tokens[1]}`;
    if (KNOWN_BRANDS.includes(twoWord)) {
      return twoWord;
    }
  }
  
  return undefined;
}

/**
 * Extract size from normalized name
 * Looks for patterns like "500 sheets", "12 oz", "3 in", etc.
 */
function extractSize(normalized: string): string | undefined {
  // Match size patterns: number + unit, or paper dimensions (8.5 x 11)
  const patterns = [
    /(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i, // e.g. "8.5 x 11" paper size
    /(\d+)\s*(oz|lb|g|kg|ml|l|in|inch|ft|foot|cm|mm)/i,
    /(\d+)\s*(sheet|sheets)/i,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return undefined;
}

/**
 * Extract count/pack from normalized name
 * Looks for patterns like "12-pack", "pack of 6", "6ct", etc.
 */
function extractCount(normalized: string): string | undefined {
  // Match count patterns
  const patterns = [
    /(\d+)\s*pack/i,
    /pack\s+of\s+(\d+)/i,
    /(\d+)\s*ct\b/i,
    /(\d+)\s*count\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return undefined;
}

/**
 * Normalize QuickBooks item name for discovery search.
 * Removes vendor codes, junk words, inventory terms to improve search quality.
 */
export function normalizeSearchQuery(raw: string): string {
  let s = raw.trim();
  if (!s) return s;

  // Remove common vendor/SKU patterns: [ABC-123], (SKU: xyz), #12345, -VND-001
  s = s
    .replace(/\s*\[[A-Z0-9\-_]+\]\s*/gi, ' ')
    .replace(/\s*\(SKU:\s*[^)]+\)\s*/gi, ' ')
    .replace(/\s*#\d{4,}\s*/g, ' ')
    .replace(/\s*-\s*[A-Z]{2,4}-\d+\s*$/gi, ' ')
    .replace(/\s*\|\s*[A-Z0-9\-]+\s*$/gi, ' ');

  // Remove inventory/accounting junk (preserve product terms like "case", "pack", "box")
  const junkWords = [
    'inventory',
    'stock',
    'reorder',
    're-order',
    'backorder',
    'back-order',
    'nla',
    'discontinued',
    'deprecated',
    'obsolete',
    'temp',
    'tmp',
    'test',
    'sample',
    'do not use',
    'do not order',
    'internal',
    'misc',
    'miscellaneous',
    'other',
    'various',
    'assorted',
  ];
  const lower = s.toLowerCase();
  for (const w of junkWords) {
    const re = new RegExp(`\\b${w}\\b`, 'gi');
    s = s.replace(re, ' ');
  }

  // Collapse whitespace and trim
  s = s.replace(/\s+/g, ' ').trim();
  return s || raw.trim();
}

/**
 * Extract model number from normalized name
 * Looks for alphanumeric tokens 5+ chars that look like model numbers
 */
function extractModel(normalized: string): string | undefined {
  const tokens = normalized.split(/\s+/);
  
  for (const token of tokens) {
    // Model numbers are typically alphanumeric, 5+ chars, may have dashes
    const cleaned = token.replace(/[^\w-]/g, '');
    if (cleaned.length >= 5 && /^[a-z0-9-]+$/i.test(cleaned)) {
      // Check if it looks like a model (has both letters and numbers, or is all caps-like pattern)
      if ((/[a-z]/i.test(cleaned) && /\d/.test(cleaned)) || /^[A-Z0-9-]+$/.test(cleaned)) {
        return cleaned.toUpperCase();
      }
    }
  }
  
  return undefined;
}



