/**
 * Generic attribute-based product matching.
 * Extracts structured attributes from item names and retailer product rows,
 * supports hard filtering and attribute-based scoring across industries.
 */

import type { ConfidenceBand, RejectionReason } from './types';
import { dimensionsMatchCanonical, inferDimensionKind } from './unitConversion';
import { categoriesMatch, extractCategoryFromSynonyms, resolveCategory } from './synonyms';
import { inferBrandFromItemName } from './brandInference';

/** @deprecated Use inferBrandFromItemName. Kept for backward compatibility if any stale reference exists. */
export function extractBrandFromText(text: string): string | undefined {
  return inferBrandFromItemName(text).brand;
}

/** Numeric value with unit for dimensions, weight, volume. */
export interface DimensionValue {
  value: number;
  unit: string;
}

export interface ProductAttributes {
  brand?: string;
  category?: string;
  /** Raw categories array/path from row (e.g. ["Electronics","Monitors"]). */
  categories?: string[];
  /** Department from row. */
  department?: string;
  size?: string;
  length?: DimensionValue;
  width?: DimensionValue;
  height?: DimensionValue;
  diameter?: DimensionValue;
  count?: number;
  weight?: DimensionValue;
  volume?: DimensionValue;
  packSize?: string;
  material?: string;
  coating?: string;
  finish?: string;
  color?: string;
  model?: string;
  type?: string;
  /** Pack count (e.g. 12 pack). */
  packCount?: number;
  /** Unit count (e.g. 75 count). */
  unitCount?: number;
  /** Sheets per pad (notes). */
  sheetsPerPad?: number;
  /** Total sheets (paper). */
  totalSheets?: number;
  /** Case count. */
  caseCount?: number;
  /** Raw variations_values from row (for variant/size/count confirmation). */
  variationsValues?: Record<string, string> | string[];
  /** True when monitor length was set from screen size in title (not product_dimensions). */
  screenSizeFromTitle?: boolean;
}

/** Default tolerance for dimension comparison (e.g. 24" ≈ 23.8"). */
const DIMENSION_TOLERANCE_PCT = 0.05;

/** Common category keywords (generic, not exhaustive). */
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\bmonitor\b/i, category: 'monitor' },
  { pattern: /\bdisplay\b/i, category: 'monitor' },
  { pattern: /\bpaper\b/i, category: 'paper' },
  { pattern: /\bnails?\b/i, category: 'nails' },
  { pattern: /\bscrews?\b/i, category: 'screws' },
  { pattern: /\blumber\b/i, category: 'lumber' },
  { pattern: /\bplywood\b/i, category: 'plywood' },
  { pattern: /\bnotes?\b/i, category: 'notes' },
  { pattern: /\bwipes?\b/i, category: 'wipes' },
  { pattern: /\bdisinfecting\s*wipes?\b/i, category: 'wipes' },
  { pattern: /\bmarkers?\b/i, category: 'markers' },
  { pattern: /\bpens?\b/i, category: 'pens' },
  { pattern: /\btape\b/i, category: 'tape' },
  { pattern: /\bgloves?\b/i, category: 'gloves' },
  { pattern: /\btrash\s*bags?\b/i, category: 'trash bags' },
  { pattern: /\bgarbage\s*bags?\b/i, category: 'trash bags' },
  { pattern: /\bcleaning\b/i, category: 'cleaning' },
  { pattern: /\bcleaner\b/i, category: 'cleaning' },
  { pattern: /\bdisinfecting\b/i, category: 'disinfecting' },
  { pattern: /\bprinter\b/i, category: 'printer' },
  { pattern: /\bink\b/i, category: 'ink' },
  { pattern: /\btowels?\b/i, category: 'towels' },
  { pattern: /\bsoap\b/i, category: 'soap' },
  { pattern: /\bdrill\b/i, category: 'drill' },
  { pattern: /\bsaw\b/i, category: 'saw' },
  { pattern: /\bhammer\b/i, category: 'hammer' },
  { pattern: /\bwrench\b/i, category: 'wrench' },
  { pattern: /\bsander\b/i, category: 'sander' },
  { pattern: /\bgrill\b/i, category: 'grill' },
  { pattern: /\bpan\b/i, category: 'pan' },
  { pattern: /\bpot\b/i, category: 'pot' },
  { pattern: /\bknife\b/i, category: 'knife' },
  { pattern: /\bcutting\s*board\b/i, category: 'cutting board' },
  { pattern: /\bfoil\b/i, category: 'foil' },
  { pattern: /\bwrap\b/i, category: 'wrap' },
  { pattern: /\bcontainers?\b/i, category: 'containers' },
  { pattern: /\bbags?\b/i, category: 'bags' },
  { pattern: /\bpack\b/i, category: 'pack' },
  { pattern: /\bwax\b/i, category: 'wax' },
  { pattern: /\bpolish\b/i, category: 'polish' },
  { pattern: /\bdetailing\b/i, category: 'detailing' },
  { pattern: /\bcar\s*wash\b/i, category: 'car wash' },
  { pattern: /\bmicrowave\b/i, category: 'microwave' },
  { pattern: /\brefrigerator\b/i, category: 'refrigerator' },
  { pattern: /\bfreezer\b/i, category: 'freezer' },
  { pattern: /\boven\b/i, category: 'oven' },
  { pattern: /\bstove\b/i, category: 'stove' },
  { pattern: /\bconcrete\b/i, category: 'concrete' },
  { pattern: /\bdrywall\b/i, category: 'drywall' },
  { pattern: /\binsulation\b/i, category: 'insulation' },
  { pattern: /\bpaint\b/i, category: 'paint' },
  { pattern: /\bcaulk\b/i, category: 'caulk' },
  { pattern: /\badhesive\b/i, category: 'adhesive' },
];

function parseDimension(str: string): DimensionValue | undefined {
  let m = str.match(/(\d+\.?\d*)\s*(in|inch|inches|ft|foot|feet|cm|mm|oz|lb|g|kg|ml|l|gal|sheet|sheets|pack|ct|count)/i);
  if (!m) {
    m = str.match(/(\d+)\s*x\s*(\d+)/i);
    if (m) return { value: parseFloat(m[1]), unit: 'in' };
    return undefined;
  }
  const value = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const unitNorm = unit.replace(/inches?/i, 'in').replace(/feet|foot/i, 'ft').replace(/ounces?/i, 'oz').replace(/pounds?/i, 'lb');
  return { value, unit: unitNorm };
}

function extractDimension(text: string, patterns: RegExp[]): DimensionValue | undefined {
  const lower = text.toLowerCase();
  for (const p of patterns) {
    const m = lower.match(p);
    if (m) return parseDimension(m[0]);
  }
  return undefined;
}

/** Normalized quantity: value + unit for comparison. */
export interface NormalizedQuantity {
  value: number;
  unit: 'each' | 'ct' | 'pack' | 'box' | 'case' | 'ream' | 'sheets' | 'oz' | 'lb' | 'g' | 'ml' | 'l' | 'gal';
}

/** Ream = 500 sheets for paper. */
const REAM_SHEETS = 500;

/**
 * Parse and normalize quantity/count from text.
 * Handles: each, ct, count, pack, box, case, ream, sheets, oz, lb, g, ml, l, gal.
 */
export function normalizeQuantity(text: string): NormalizedQuantity | undefined {
  const lower = text.toLowerCase();
  const patterns: Array<{ regex: RegExp; unit: NormalizedQuantity['unit']; mult?: number }> = [
    { regex: /(\d+)\s*reams?/i, unit: 'sheets', mult: REAM_SHEETS },
    { regex: /(\d+)\s*sheets?/i, unit: 'sheets' },
    { regex: /(\d+)\s*ct\b/i, unit: 'ct' },
    { regex: /(\d+)\s*count\b/i, unit: 'ct' },
    { regex: /(\d+)\s*pack/i, unit: 'pack' },
    { regex: /pack\s+of\s+(\d+)/i, unit: 'pack' },
    { regex: /(\d+)\s*pk\b/i, unit: 'pack' },
    { regex: /(\d+)\s*box/i, unit: 'box' },
    { regex: /(\d+)\s*case/i, unit: 'case' },
    { regex: /(\d+)\s*piece/i, unit: 'each' },
    { regex: /(\d+)\s*pc\b/i, unit: 'each' },
    { regex: /(\d+)\s*ea\b/i, unit: 'each' },
    { regex: /(\d+)\s*each\b/i, unit: 'each' },
    { regex: /\beach\b/i, unit: 'each', mult: 1 },
    { regex: /(\d+\.?\d*)\s*oz\b/i, unit: 'oz' },
    { regex: /(\d+\.?\d*)\s*lb\b/i, unit: 'lb' },
    { regex: /(\d+\.?\d*)\s*g\b/i, unit: 'g' },
    { regex: /(\d+\.?\d*)\s*ml\b/i, unit: 'ml' },
    { regex: /(\d+\.?\d*)\s*l\b/i, unit: 'l' },
    { regex: /(\d+\.?\d*)\s*gal\b/i, unit: 'gal' },
  ];
  for (const { regex, unit, mult = 1 } of patterns) {
    const m = lower.match(regex);
    if (m) {
      const val = m[1] ? parseFloat(m[1]) * mult : mult;
      return { value: Math.round(val), unit };
    }
  }
  return undefined;
}

/** Bright Data / scrapers may return numbers or nested values in variations_values; always stringify before regex. */
function variationEntryToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Extract pack/count from variations_values (e.g. {"Pack Size":"12 Pack"} or ["12 Pack"]). */
function extractCountFromVariations(vv: Record<string, string> | string[] | Record<string, unknown>): number | undefined {
  const strs: string[] = Array.isArray(vv)
    ? vv.map(variationEntryToString)
    : Object.values(vv as Record<string, unknown>).map(variationEntryToString);
  for (const s of strs) {
    if (!s) continue;
    const m = s.match(/(\d+)\s*pack/i) ?? s.match(/pack\s+of\s+(\d+)/i) ?? s.match(/(\d+)\s*pads?/i) ?? s.match(/(\d+)\s*ct\b/i);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}

function extractCount(text: string): number | undefined {
  const nq = normalizeQuantity(text);
  if (nq) return nq.value;
  const reamMatch = text.match(/(\d+)\s*reams?/i);
  if (reamMatch) return parseInt(reamMatch[1], 10) * REAM_SHEETS;
  const patterns = [
    /(\d+)\s*pack/i, /pack\s+of\s+(\d+)/i, /(\d+)\s*pads?\b/i,
    /(\d+)\s*ct\b/i, /(\d+)\s*count\b/i, /(\d+)\s*sheets?\b/i,
    /(\d+)\s*pk\b/i, /(\d+)\s*piece/i, /(\d+)\s*pc\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}

/** Extract quantity semantics: packCount, unitCount, sheetsPerPad, totalSheets. */
function extractQuantitySemantics(text: string): {
  packCount?: number;
  unitCount?: number;
  sheetsPerPad?: number;
  totalSheets?: number;
  caseCount?: number;
} {
  const out: { packCount?: number; unitCount?: number; sheetsPerPad?: number; totalSheets?: number; caseCount?: number } = {};
  const mPack = text.match(/(\d+)\s*pack/i) ?? text.match(/pack\s+of\s+(\d+)/i);
  if (mPack) out.packCount = parseInt(mPack[1], 10);

  const mPads = text.match(/(\d+)\s*pads?/i);
  if (mPads) out.packCount = out.packCount ?? parseInt(mPads[1], 10);

  const mCount = text.match(/(\d+)\s*count\b/i) ?? text.match(/(\d+)\s*ct\b/i);
  if (mCount) out.unitCount = parseInt(mCount[1], 10);

  const mSheets = text.match(/(\d+)\s*sheets?\b/i);
  if (mSheets) out.totalSheets = parseInt(mSheets[1], 10);

  const mPad = text.match(/(\d+)\s*(?:sheet|sheets)\s*per\s*pad/i) ?? text.match(/(\d+)\s*(?:sheet|sheets)\s*\/\s*pad/i);
  if (mPad) out.sheetsPerPad = parseInt(mPad[1], 10);

  const mCase = text.match(/(\d+)\s*case/i);
  if (mCase) out.caseCount = parseInt(mCase[1], 10);

  return out;
}

function extractCategory(text: string): string | undefined {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  // Try synonym resolution for terms like "display", "garbage bag", "disinfecting wipes"
  return extractCategoryFromSynonyms(text) ?? undefined;
}

/** Extract category from Amazon row.categories or row.department. */
function extractCategoryFromRow(categories: unknown, department: unknown): string | undefined {
  const parts: string[] = [];
  if (Array.isArray(categories)) {
    parts.push(...categories.map((c) => String(c).toLowerCase()));
  } else if (typeof categories === 'string') {
    parts.push(categories.toLowerCase());
  }
  if (typeof department === 'string' && department.trim()) {
    parts.push(department.toLowerCase());
  }
  for (const p of parts) {
    const canonical = resolveCategory(p) ?? extractCategoryFromSynonyms(p);
    if (canonical) return canonical;
  }
  for (const { category } of CATEGORY_PATTERNS) {
    if (parts.some((p) => p.includes(category))) return category;
  }
  return undefined;
}

function extractMaterialCoatingFinishColor(text: string): { material?: string; coating?: string; finish?: string; color?: string } {
  const out: { material?: string; coating?: string; finish?: string; color?: string } = {};
  if (/\bgalvanized\b/i.test(text)) out.coating = 'galvanized';
  if (/\bstainless\b/i.test(text)) out.material = 'stainless';
  if (/\bvinyl\b/i.test(text)) out.material = 'vinyl';
  if (/\bplastic\b/i.test(text)) out.material = 'plastic';
  if (/\bmetal\b/i.test(text)) out.material = 'metal';
  if (/\bwood\b/i.test(text)) out.material = 'wood';
  if (/\bpaper\b/i.test(text)) out.material = 'paper';
  if (/\bfoam\b/i.test(text)) out.material = 'foam';
  if (/\bmatte\b/i.test(text)) out.finish = 'matte';
  if (/\bglossy\b/i.test(text)) out.finish = 'glossy';
  const colorMatch = text.match(/\b(black|white|yellow|red|blue|green|gray|grey|brown|orange)\b/i);
  if (colorMatch) out.color = colorMatch[1].toLowerCase();
  return out;
}

function extractType(text: string): string | undefined {
  const types = ['framing', 'finishing', 'drywall', 'deck', 'roofing', 'concrete', 'wood', 'sheet', 'copy', 'printer', 'bond', 'recycled'];
  const lower = text.toLowerCase();
  for (const t of types) {
    if (lower.includes(t)) return t;
  }
  return undefined;
}

function extractModel(text: string): string | undefined {
  const m = text.match(/\b([A-Z0-9]{4,}[-_]?[A-Z0-9]*)\b/i);
  if (m && /[A-Z]/i.test(m[1]) && /\d/.test(m[1])) return m[1].toUpperCase();
  return undefined;
}

/**
 * Extract attributes from QuickBooks item name.
 */
export function extractItemAttributes(itemName: string): ProductAttributes {
  const text = itemName.trim();
  const attrs: ProductAttributes = {};

  const brandInference = inferBrandFromItemName(text);
  attrs.brand = brandInference.brand;
  attrs.category = extractCategory(text);

  const qty = extractQuantitySemantics(text);
  if (qty.packCount != null) attrs.packCount = qty.packCount;
  if (qty.unitCount != null) attrs.unitCount = qty.unitCount;
  if (qty.sheetsPerPad != null) attrs.sheetsPerPad = qty.sheetsPerPad;
  if (qty.totalSheets != null) attrs.totalSheets = qty.totalSheets;
  if (qty.caseCount != null) attrs.caseCount = qty.caseCount;

  attrs.count = extractCount(text);
  const { material, coating, finish, color } = extractMaterialCoatingFinishColor(text);
  if (material) attrs.material = material;
  if (coating) attrs.coating = coating;
  if (finish) attrs.finish = finish;
  if (color) attrs.color = color;
  attrs.type = extractType(text);
  attrs.model = extractModel(text);

  // Lumber 2x4x8: width=2in, height=4in, length=8ft (check first, before generic 2x)
  const lumber2x4x8 = text.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\s*(?:ft|foot|feet)?/i);
  if (lumber2x4x8) {
    attrs.width = { value: parseInt(lumber2x4x8[1], 10), unit: 'in' };
    attrs.height = { value: parseInt(lumber2x4x8[2], 10), unit: 'in' };
    attrs.length = { value: parseInt(lumber2x4x8[3], 10), unit: 'ft' };
  }

  // 2x4 lumber (without length): width=2, height=4
  if (!attrs.width) {
    const lumber2x4 = text.match(/(\d+)\s*x\s*(\d+)\s+(?:lumber|board|stud|ft|foot|feet)/i);
    if (lumber2x4) {
      attrs.width = { value: parseInt(lumber2x4[1], 10), unit: 'in' };
      attrs.height = { value: parseInt(lumber2x4[2], 10), unit: 'in' };
    }
  }

  // Paper dimensions 8.5 x 11 (decimal support) - only when paper/copy category
  const paperDim = text.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*(?:in|inch|inches)?\b/i);
  if (paperDim && (/\bpaper\b/i.test(text) || /\bcopy\b/i.test(text) || /\bprinter\b/i.test(text))) {
    attrs.width = { value: parseFloat(paperDim[1]), unit: 'in' };
    attrs.height = { value: parseFloat(paperDim[2]), unit: 'in' };
  }

  // Notes 3x3: width x height in inches
  if (!attrs.width && /\bnotes?\b/i.test(text)) {
    const notesDim = text.match(/(\d+)\s*x\s*(\d+)\s*(?:in|inch)?/i);
    if (notesDim) {
      attrs.width = { value: parseInt(notesDim[1], 10), unit: 'in' };
      attrs.height = { value: parseInt(notesDim[2], 10), unit: 'in' };
    }
  }

  // Generic dimensions: length (ft, in), then width/height from 2x4 if not set
  attrs.length = attrs.length ?? extractDimension(text, [
    /(\d+\.?\d*)\s*(?:ft|foot|feet)\b/i,
    /(\d+\.?\d*)\s*(?:in|inch|inches)\b/i,
    /(\d+\.?\d*)\s*mm\b/i,
    /(\d+\.?\d*)\s*cm\b/i,
  ]);
  if (!attrs.width) {
    attrs.width = extractDimension(text, [/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i]) ?? extractDimension(text, [/(\d+)\s*in\b/i]);
  }
  if (!attrs.height && text.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i)) {
    attrs.height = extractDimension(text, [/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i]);
  }
  attrs.diameter = extractDimension(text, [/(\d+\.?\d*)\s*(?:in|inch|mm)\s*(?:diameter|dia)/i]);

  // Monitor size: 24 inch, 27 in
  if (/\bmonitor\b/i.test(text) || /\bdisplay\b/i.test(text)) {
    const monSize = text.match(/(\d+\.?\d*)\s*(?:in|inch|inches)\b/i);
    if (monSize) attrs.size = `${monSize[1]} in`;
  }
  if (!attrs.size) {
    attrs.size = text.match(/(\d+\.?\d*)\s*(?:in|inch|oz|lb|g|sheet)/i)?.[0];
  }

  attrs.weight = extractDimension(text, [/(\d+\.?\d*)\s*(?:oz|lb|g|kg)\b/i]);
  attrs.volume = extractDimension(text, [/(\d+\.?\d*)\s*(?:oz|ml|l|gal)\b/i]);
  attrs.packSize = text.match(/(\d+)\s*pack/i)?.[0];

  return attrs;
}

/** Extract monitor screen size (inches) from title. Prefer display size over physical dimensions. */
function extractMonitorScreenSize(text: string): number | undefined {
  if (!text || !/\b(monitor|display|screen|lcd|led|fhd|uhd|inch)\b/i.test(text)) return undefined;
  const m =
    text.match(/(\d+\.?\d*)\s*[-]?\s*(?:inch|in)(?:\s|$|,|\)|")/i) ??
    text.match(/(\d+\.?\d*)\s*[-]\s*(?:inch|in)/i) ??
    text.match(/(\d+\.?\d*)\s+(?:inch\s+)?(?:monitor|display)/i);
  if (m) {
    const v = parseFloat(m[1]);
    if (v > 10 && v < 100) return v;
  }
  return undefined;
}

/** Flatten Amazon row field to searchable string. */
function flattenField(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(String).join(' ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/**
 * Extract attributes from retailer product row (title, brand, product_details, specs).
 * Uses Amazon schema fields: brand, model_number, categories, department, product_details,
 * variations, variations_values, product_dimensions, item_weight, features.
 */
export function extractProductAttributes(row: Record<string, unknown>): ProductAttributes {
  const title = String(row.title ?? row.name ?? row.product_title ?? row.product_name ?? '').trim();
  const brandFromRow = row.brand ?? row.Brand ?? row.brand_name ?? row.brandName;
  const brandStr = typeof brandFromRow === 'string' ? brandFromRow.trim() : '';

  const details = row.product_details ?? row.productDetails ?? row.specs ?? row.specifications;
  const detailsStr = flattenField(details);

  const variations = row.variations ?? row.variants;
  const variationsStr = flattenField(variations);

  const variationsValues = row.variations_values ?? row.variationsValues;
  const variationsValuesStr = flattenField(variationsValues);

  const categories = row.categories;
  const categoriesStr = flattenField(categories);

  const department = row.department;
  const departmentStr = typeof department === 'string' ? department : '';

  const productDimensions = row.product_dimensions ?? row.productDimensions;
  const dimensionsStr = flattenField(productDimensions);

  const itemWeight = row.item_weight ?? row.itemWeight;
  const weightStr = flattenField(itemWeight);

  const features = row.features;
  const featuresStr = flattenField(features);

  const modelNumber = row.model_number ?? row.modelNumber;
  const modelNumberStr = typeof modelNumber === 'string' ? modelNumber.trim() : '';

  const combined = `${title} ${brandStr} ${detailsStr} ${variationsStr} ${variationsValuesStr} ${categoriesStr} ${departmentStr} ${dimensionsStr} ${weightStr} ${featuresStr} ${modelNumberStr}`.toLowerCase();

  const attrs: ProductAttributes = {};
  if (brandStr) attrs.brand = brandStr.toLowerCase();
  else {
    const inferred = inferBrandFromItemName(combined);
    attrs.brand = inferred.brand;
  }

  attrs.category = extractCategoryFromRow(categories, department) ?? extractCategory(combined);
  if (Array.isArray(categories) && categories.length > 0) {
    attrs.categories = categories.map((c) => String(c).toLowerCase());
  }
  if (departmentStr) attrs.department = departmentStr;
  const qtyProduct = extractQuantitySemantics(combined);
  if (qtyProduct.packCount != null) attrs.packCount = qtyProduct.packCount;
  if (qtyProduct.unitCount != null) attrs.unitCount = qtyProduct.unitCount;
  if (qtyProduct.sheetsPerPad != null) attrs.sheetsPerPad = qtyProduct.sheetsPerPad;
  if (qtyProduct.totalSheets != null) attrs.totalSheets = qtyProduct.totalSheets;
  if (qtyProduct.caseCount != null) attrs.caseCount = qtyProduct.caseCount;
  if (attrs.category === 'notes' && qtyProduct.packCount != null) {
    attrs.count = qtyProduct.packCount;
  } else {
    attrs.count = extractCount(combined);
  }
  const { material, coating, finish, color } = extractMaterialCoatingFinishColor(combined);
  if (material) attrs.material = material;
  if (coating) attrs.coating = coating;
  if (finish) attrs.finish = finish;
  if (color) attrs.color = color;
  attrs.type = extractType(combined);
  attrs.model = modelNumberStr || extractModel(combined);

  const screenSizeIn = extractMonitorScreenSize(title || combined);
  if (attrs.category === 'monitor' && screenSizeIn != null) {
    attrs.length = { value: screenSizeIn, unit: 'in' };
    attrs.size = `${screenSizeIn} in`;
    attrs.screenSizeFromTitle = true;
  }
  if (!attrs.length) {
    attrs.length = extractDimension(combined, [
      /(\d+\.?\d*)\s*(?:ft|foot|feet)\b/i,
      /(\d+\.?\d*)\s*(?:in|inch|inches)\b/i,
      /(\d+\.?\d*)\s*mm\b/i,
      /(\d+\.?\d*)\s*cm\b/i,
    ]);
  }
  const dim2x3Product = combined.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i);
  if (dim2x3Product && attrs.category !== 'monitor') {
    attrs.width = { value: parseFloat(dim2x3Product[1]), unit: 'in' };
    attrs.height = { value: parseFloat(dim2x3Product[2]), unit: 'in' };
    if (!attrs.length) attrs.length = { value: parseFloat(dim2x3Product[3]), unit: 'in' };
  } else if (attrs.category !== 'monitor') {
    const dim2xProduct = combined.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)(?:\s|$)/i);
    if (dim2xProduct) {
      attrs.width = { value: parseFloat(dim2xProduct[1]), unit: 'in' };
      attrs.height = { value: parseFloat(dim2xProduct[2]), unit: 'in' };
    } else {
      attrs.width = extractDimension(combined, [/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i]);
    }
  }
  attrs.diameter = extractDimension(combined, [/(\d+\.?\d*)\s*(?:in|inch|mm)\s*(?:diameter|dia)/i]);
  if (!attrs.size) attrs.size = combined.match(/(\d+\.?\d*)\s*(?:in|inch|oz|lb|g|sheet)/i)?.[0];
  attrs.weight = extractDimension(combined, [/(\d+\.?\d*)\s*(?:oz|lb|g|kg)\b/i]);
  attrs.volume = extractDimension(combined, [/(\d+\.?\d*)\s*(?:ml|l|gal)\b/i]);
  attrs.packSize = combined.match(/(\d+)\s*pack/i)?.[0];

  if (variationsValues && typeof variationsValues === 'object') {
    if (Array.isArray(variationsValues)) {
      attrs.variationsValues = (variationsValues as unknown[]).map((x) => variationEntryToString(x));
    } else {
      const rec = variationsValues as Record<string, unknown>;
      attrs.variationsValues = Object.fromEntries(
        Object.entries(rec).map(([k, v]) => [k, variationEntryToString(v)])
      ) as Record<string, string>;
    }
  }

  return attrs;
}

function countsEquivalent(a: number, b: number, _itemAttrs: ProductAttributes, _productAttrs: ProductAttributes): boolean {
  if (a === b) return true;
  const maxVal = Math.max(a, b, 1);
  const ratio = Math.min(a, b) / maxVal;
  return ratio >= 1 - DIMENSION_TOLERANCE_PCT;
}

function dimensionsMatch(a?: DimensionValue, b?: DimensionValue, tolerancePct: number = DIMENSION_TOLERANCE_PCT): boolean {
  if (!a || !b) return true;
  if (a.unit === b.unit) {
    const ratio = a.value / b.value;
    return ratio >= 1 - tolerancePct && ratio <= 1 + tolerancePct;
  }
  const kind = inferDimensionKind(a.unit);
  if (kind === 'other' || inferDimensionKind(b.unit) !== kind) return false;
  return dimensionsMatchCanonical(a, b, kind as 'length' | 'weight' | 'volume', tolerancePct);
}

/**
 * Hard filter: reject if required attributes mismatch.
 * Returns structured RejectionReason or null if valid.
 */
export function hardFilterReject(
  itemAttrs: ProductAttributes,
  productAttrs: ProductAttributes,
  productTitle?: string,
  requiredKeys?: Array<keyof ProductAttributes>
): RejectionReason | null {
  const required = requiredKeys ?? ['brand', 'category', 'model', 'count', 'length', 'width', 'height', 'diameter'];

  const checkRequired = (key: keyof ProductAttributes) =>
    !requiredKeys || requiredKeys.includes(key);

  if (itemAttrs.brand && checkRequired('brand')) {
    if (productAttrs.brand) {
      const ib = itemAttrs.brand.toLowerCase();
      const pb = productAttrs.brand.toLowerCase();
      if (!pb.includes(ib) && !ib.includes(pb)) {
        return { code: 'brand_mismatch', detail: `item="${itemAttrs.brand}" product="${productAttrs.brand}"` };
      }
    } else if (productTitle && !productTitle.toLowerCase().includes(itemAttrs.brand.toLowerCase())) {
      return { code: 'brand_mismatch', detail: `brand "${itemAttrs.brand}" not in product` };
    }
  }

  if (itemAttrs.category && checkRequired('category')) {
    const matches = categoriesMatch(
      itemAttrs.category,
      productAttrs.category,
      productTitle ?? '',
      productAttrs.categories
    );
    if (!matches) {
      return {
        code: 'category_mismatch',
        detail: `item="${itemAttrs.category}" product="${productAttrs.category ?? 'N/A'}" categories=${JSON.stringify(productAttrs.categories ?? [])}`,
      };
    }
  }

  if (itemAttrs.category === 'notes' && itemAttrs.packCount != null && checkRequired('count')) {
    const productPads = productAttrs.packCount ?? productAttrs.count;
    if (productPads != null && !countsEquivalent(itemAttrs.packCount, productPads, itemAttrs, productAttrs)) {
      return { code: 'count_mismatch', detail: `item pads=${itemAttrs.packCount} product pads=${productPads}` };
    }
  } else if (itemAttrs.count != null && productAttrs.count != null && checkRequired('count')) {
    if (!countsEquivalent(itemAttrs.count, productAttrs.count, itemAttrs, productAttrs)) {
      return { code: 'count_mismatch', detail: `item=${itemAttrs.count} product=${productAttrs.count}` };
    }
  }

  if (itemAttrs.packCount != null && productAttrs.variationsValues && checkRequired('count') && itemAttrs.category !== 'notes') {
    const vv = productAttrs.variationsValues;
    const variantCount = extractCountFromVariations(vv);
    if (variantCount != null && !countsEquivalent(itemAttrs.packCount, variantCount, itemAttrs, productAttrs)) {
      return { code: 'variation_mismatch', detail: `item packCount=${itemAttrs.packCount} product variant=${variantCount}` };
    }
  }

  const imNorm = itemAttrs.model?.toLowerCase().replace(/[-_\s]/g, '') ?? '';
  const pmNorm = (productAttrs.model ?? '').toLowerCase().replace(/[-_\s]/g, '');
  const modelMatchesExactly =
    imNorm &&
    pmNorm &&
    (imNorm === pmNorm || pmNorm.includes(imNorm) || imNorm.includes(pmNorm));

  const skipMonitorDimensions =
    itemAttrs.category === 'monitor' && modelMatchesExactly;

  if (
    !skipMonitorDimensions &&
    itemAttrs.length &&
    productAttrs.length &&
    checkRequired('length') &&
    !dimensionsMatch(itemAttrs.length, productAttrs.length)
  ) {
    return { code: 'dimension_mismatch', detail: `length: item=${itemAttrs.length.value}${itemAttrs.length.unit} product=${productAttrs.length.value}${productAttrs.length.unit}` };
  }
  if (
    !skipMonitorDimensions &&
    itemAttrs.width &&
    productAttrs.width &&
    checkRequired('width') &&
    !dimensionsMatch(itemAttrs.width, productAttrs.width)
  ) {
    return { code: 'dimension_mismatch', detail: `width: item=${itemAttrs.width.value}${itemAttrs.width.unit} product=${productAttrs.width.value}${productAttrs.width.unit}` };
  }
  if (
    !skipMonitorDimensions &&
    itemAttrs.height &&
    productAttrs.height &&
    checkRequired('height') &&
    !dimensionsMatch(itemAttrs.height, productAttrs.height)
  ) {
    return { code: 'dimension_mismatch', detail: 'height mismatch' };
  }
  if (
    itemAttrs.diameter &&
    productAttrs.diameter &&
    checkRequired('diameter') &&
    !dimensionsMatch(itemAttrs.diameter, productAttrs.diameter)
  ) {
    return { code: 'dimension_mismatch', detail: 'diameter mismatch' };
  }

  if (itemAttrs.model && checkRequired('model')) {
    const im = itemAttrs.model.toLowerCase().replace(/[-_\s]/g, '');
    const pm = (productAttrs.model ?? '').toLowerCase().replace(/[-_\s]/g, '');
    if (!pm) {
      return { code: 'model_mismatch', detail: `item has model "${itemAttrs.model}" but product has no model_number/product_details model` };
    }
    if (im !== pm && !pm.includes(im) && !im.includes(pm)) {
      return { code: 'model_mismatch', detail: `item="${itemAttrs.model}" product="${productAttrs.model}"` };
    }
  }

  return null;
}

/**
 * Score product by attribute matches (0-1).
 * Used after hard filter passes.
 */
export function attributeScore(
  itemAttrs: ProductAttributes,
  productAttrs: ProductAttributes,
  productTitle: string,
  itemName?: string
): { score: number; reasons: Record<string, number> } {
  const reasons: Record<string, number> = {};
  let total = 0;
  let weight = 0;

  const titleLower = productTitle.toLowerCase();

  if (itemAttrs.brand) {
    const w = 0.3;
    weight += w;
    const ib = itemAttrs.brand.toLowerCase();
    if (productAttrs.brand && productAttrs.brand.toLowerCase().includes(ib)) {
      reasons.brandMatch = 1;
      total += w;
    } else if (titleLower.includes(ib)) {
      reasons.brandMatch = 0.8;
      total += w * 0.8;
    } else {
      reasons.brandMatch = 0;
    }
  }

  if (itemAttrs.category) {
    const w = 0.25;
    weight += w;
    const ic = itemAttrs.category.toLowerCase();
    if (productAttrs.category && productAttrs.category.toLowerCase().includes(ic)) {
      reasons.categoryMatch = 1;
      total += w;
    } else if (titleLower.includes(ic)) {
      reasons.categoryMatch = 0.7;
      total += w * 0.7;
    } else {
      reasons.categoryMatch = 0;
    }
  }

  if (itemAttrs.length || itemAttrs.width || itemAttrs.count) {
    const w = 0.25;
    weight += w;
    let dimScore = 0;
    if (itemAttrs.length && productAttrs.length && dimensionsMatch(itemAttrs.length, productAttrs.length)) dimScore = 1;
    else if (itemAttrs.width && productAttrs.width && dimensionsMatch(itemAttrs.width, productAttrs.width)) dimScore = 1;
    else if (itemAttrs.count != null && productAttrs.count != null && itemAttrs.count === productAttrs.count) dimScore = 1;
    else if (itemAttrs.size && titleLower.includes(String(itemAttrs.size).toLowerCase())) dimScore = 0.5;
    reasons.dimensionMatch = dimScore;
    total += w * dimScore;
  }

  if (itemAttrs.material || itemAttrs.coating || itemAttrs.type || itemAttrs.color || itemAttrs.finish) {
    const w = 0.25;
    weight += w;
    let specScore = 0;
    if (itemAttrs.coating && (productAttrs.coating || titleLower.includes(itemAttrs.coating))) specScore += 0.3;
    if (itemAttrs.material && (productAttrs.material || titleLower.includes(itemAttrs.material))) specScore += 0.2;
    if (itemAttrs.type && (productAttrs.type || titleLower.includes(itemAttrs.type))) specScore += 0.2;
    if (itemAttrs.color && (productAttrs.color || titleLower.includes(itemAttrs.color))) specScore += 0.15;
    if (itemAttrs.finish && (productAttrs.finish || titleLower.includes(itemAttrs.finish))) specScore += 0.15;
    reasons.specMatch = Math.min(1, specScore);
    total += w * reasons.specMatch;
  }

  let score = weight > 0 ? total / weight : 0.5;

  // Notes: penalize pop-up/dispenser variants when item does not imply them
  if (itemAttrs.category === 'notes') {
    const productIsPopUpOrDispenser =
      titleLower.includes('pop-up') || titleLower.includes('pop up') || titleLower.includes('dispenser');
    const itemImpliesVariant =
      itemName &&
      (itemName.toLowerCase().includes('pop-up') ||
        itemName.toLowerCase().includes('pop up') ||
        itemName.toLowerCase().includes('dispenser'));
    if (productIsPopUpOrDispenser && !itemImpliesVariant) {
      reasons.notesVariantPenalty = 0.3;
      score *= 0.7;
    }
  }

  return { score: Math.min(1, Math.max(0, score)), reasons };
}

/** Confidence band thresholds. */
const HIGH_CONFIDENCE_MIN = 0.75;
const MEDIUM_CONFIDENCE_MIN = 0.5;

/**
 * Determine confidence band from score and rejection.
 */
export function getConfidenceBand(
  combinedScore: number,
  rejection: RejectionReason | null
): ConfidenceBand {
  if (rejection) return 'rejected';
  if (combinedScore >= HIGH_CONFIDENCE_MIN) return 'high_confidence';
  if (combinedScore >= MEDIUM_CONFIDENCE_MIN) return 'medium_confidence';
  return 'low_confidence';
}

/**
 * Check if product is within item's product family.
 */
export function isInProductFamily(
  itemAttrs: ProductAttributes,
  productAttrs: ProductAttributes,
  productTitle: string
): boolean {
  if (itemAttrs.brand) {
    const ib = itemAttrs.brand.toLowerCase();
    const pb = (productAttrs.brand ?? '').toLowerCase();
    const titleLower = productTitle.toLowerCase();
    if (!pb.includes(ib) && !titleLower.includes(ib)) return false;
  }
  if (itemAttrs.category) {
    if (!categoriesMatch(itemAttrs.category, productAttrs.category, productTitle, productAttrs.categories)) return false;
  }
  return true;
}
