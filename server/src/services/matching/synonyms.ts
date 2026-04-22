/**
 * Synonym dictionary for category and product type matching.
 * Maps alternative terms to canonical categories for better discovery.
 */

/** Canonical category -> list of synonym terms (including self). */
export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  monitor: ['monitor', 'display', 'screen', 'lcd', 'led monitor'],
  paper: ['paper', 'copy paper', 'printer paper', 'copy'],
  wipes: ['wipes', 'disinfecting wipes', 'disinfectant wipes', 'cleaning wipes', 'sanitizing wipes'],
  'trash bags': ['trash bags', 'garbage bags', 'bin liners', 'waste bags'],
  notes: ['notes', 'sticky notes', 'post-it', 'post it', 'stickies'],
  tape: ['tape', 'adhesive tape', 'packing tape', 'scotch tape'],
  markers: ['markers', 'marker', 'sharpie', 'highlighters'],
  pens: ['pens', 'pen', 'ballpoint', 'rollerball'],
  cleaning: ['cleaning', 'cleanser', 'cleaner', 'cleaning supplies'],
  disinfecting: ['disinfecting', 'disinfectant', 'sanitizer', 'sanitizing'],
  nails: ['nails', 'nail', 'fasteners'],
  screws: ['screws', 'screw', 'fasteners'],
  lumber: ['lumber', 'lumber board', 'wood', 'timber'],
  plywood: ['plywood', 'ply wood', 'sheet wood'],
  containers: ['containers', 'container', 'storage', 'storage container'],
  foil: ['foil', 'aluminum foil', 'aluminium foil'],
  wrap: ['wrap', 'plastic wrap', 'cling wrap', 'food wrap'],
  drill: ['drill', 'power drill', 'cordless drill'],
  saw: ['saw', 'power saw', 'circular saw', 'hand saw'],
  sander: ['sander', 'power sander', 'orbital sander'],
  'cutting board': ['cutting board', 'cutting boards', 'chopping board'],
};

/** All negative keywords that should reject a candidate (product title). */
export const NEGATIVE_KEYWORDS = [
  'refill',
  'accessory',
  'accessories',
  'mount',
  'mounting',
  'cable',
  'cables',
  'stand',
  'stands',
  'replacement',
  'replacements',
  'sample',
  'samples',
  'adapter',
  'adapters',
];

/**
 * Resolve a term to its canonical category using synonyms.
 */
export function resolveCategory(term: string | undefined): string | undefined {
  if (!term || !term.trim()) return undefined;
  const lower = term.toLowerCase().trim();
  for (const [canonical, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.some((s) => s === lower || lower.includes(s) || s.includes(lower))) {
      return canonical;
    }
  }
  return undefined;
}

/**
 * Extract canonical category from full text using synonym patterns.
 */
export function extractCategoryFromSynonyms(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [canonical, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const syn of synonyms) {
      if (syn.length >= 3 && lower.includes(syn)) return canonical;
    }
  }
  return undefined;
}

/**
 * Check if item category matches product category (including synonyms).
 * Also accepts productCategories array (e.g. from row.categories) for path confirmation.
 */
export function categoriesMatch(
  itemCategory: string | undefined,
  productCategory: string | undefined,
  productTitle: string,
  productCategories?: unknown
): boolean {
  if (!itemCategory) return true;
  const itemCanonical = resolveCategory(itemCategory) ?? itemCategory.toLowerCase();
  const productCanonical = resolveCategory(productCategory);
  const titleLower = productTitle.toLowerCase();

  if (productCanonical && productCanonical === itemCanonical) return true;

  const synonyms = CATEGORY_SYNONYMS[itemCanonical];
  if (synonyms) {
    for (const syn of synonyms) {
      if (titleLower.includes(syn)) return true;
    }
  }
  if (productCategory && titleLower.includes(productCategory.toLowerCase())) return true;
  if (titleLower.includes(itemCategory.toLowerCase())) return true;

  if (productCategories) {
    const parts: string[] = Array.isArray(productCategories)
      ? productCategories.map((c) => String(c).toLowerCase())
      : typeof productCategories === 'string'
        ? [productCategories.toLowerCase()]
        : [];
    for (const p of parts) {
      const pc = resolveCategory(p) ?? extractCategoryFromSynonyms(p);
      if (pc === itemCanonical) return true;
      if (synonyms && synonyms.some((s) => p.includes(s))) return true;
    }
  }

  return false;
}

/**
 * Check if product title contains any negative keyword (reject candidate).
 * For monitors: cable/cables (included), mount (VESA mount), stand (with stand) are often product features - do not reject.
 * Replacement/refill/accessory still reject.
 */
export function hasNegativeKeyword(title: string, category?: string): boolean {
  const lower = title.toLowerCase();
  const isMonitor = category === 'monitor' || /\b(monitor|display)\b/i.test(title);
  const monitorAllowlist = ['cable', 'cables', 'mount', 'mounting', 'stand', 'stands'];
  for (const kw of NEGATIVE_KEYWORDS) {
    if (lower.includes(kw)) {
      if (isMonitor && monitorAllowlist.includes(kw)) continue;
      return true;
    }
  }
  return false;
}

/** Keywords indicating bundle/replacement/renewed - reject when not implied by item. */
const BUNDLE_REPLACEMENT_RENEWED_PATTERNS = [
  /\bbundle\b/i,
  /\bkit\b/i,
  /\brefill\b/i,
  /\brefills?\b/i,
  /\brenewed\b/i,
  /\brefurbished\b/i,
  /\bopen\s*box\b/i,
  /\bused\s*-\s*like\s*new\b/i,
  /\bused\s*-\s*good\b/i,
  /\bwarehouse\s*deal\b/i,
];

/**
 * Detect if product text (title, description, product_details, features) indicates
 * bundle, replacement, refill, renewed, refurbished, or open box.
 * Returns the matched keyword or null.
 */
export function detectBundleReplacementRenewed(text: string): string | null {
  if (!text || !text.trim()) return null;
  const lower = text.toLowerCase();
  for (const p of BUNDLE_REPLACEMENT_RENEWED_PATTERNS) {
    if (p.test(lower)) {
      const m = lower.match(p);
      return m ? m[0].trim() : null;
    }
  }
  return null;
}

/**
 * Check if item name implies bundle/replacement/renewed (e.g. "Replacement Cartridge").
 */
export function itemImpliesBundleReplacementRenewed(itemName: string): boolean {
  const lower = itemName.toLowerCase();
  return (
    lower.includes('bundle') ||
    lower.includes('kit') ||
    lower.includes('refill') ||
    lower.includes('renewed') ||
    lower.includes('refurbished') ||
    lower.includes('open box') ||
    lower.includes('replacement')
  );
}
