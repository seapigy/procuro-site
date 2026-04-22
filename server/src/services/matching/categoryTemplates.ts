/**
 * Category-specific matching rules layered on top of generic extractor.
 * Each template defines required vs preferred attributes, brand strictness, price basis.
 */

import type { ProductAttributes } from './attributes';
import type { MatchRequirements, ProductFamily } from './types';

type AttrKey = keyof ProductAttributes;

/** Brand strictness: strict=reject mismatch, preferred=boost score only, ignore=don't check. */
export type BrandStrictness = 'strict' | 'preferred' | 'ignore';

/** Per-unit price basis for comparing candidates. */
export type PriceBasis =
  | 'each'
  | 'per_sheet'
  | 'per_wipe'
  | 'per_nail'
  | 'per_screw'
  | 'per_foot'
  | 'per_board'
  | 'per_oz'
  | 'per_ml';

export interface CategoryTemplate {
  category: string;
  requiredWhenPresent: AttrKey[];
  criticalForCategory: AttrKey[];
  countEssential: boolean;
  preferred: AttrKey[];
  /** Brand matching behavior. */
  brandStrictness?: BrandStrictness;
  /** Normalized price comparison basis. */
  priceBasis?: PriceBasis;
}

const TEMPLATES: CategoryTemplate[] = [
  {
    category: 'monitor',
    requiredWhenPresent: ['brand', 'category', 'model'],
    criticalForCategory: ['length', 'size'],
    countEssential: false,
    preferred: ['model'],
    brandStrictness: 'strict',
    priceBasis: 'each',
  },
  {
    category: 'paper',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count', 'size'],
    countEssential: true,
    preferred: ['type', 'material'],
    brandStrictness: 'preferred',
    priceBasis: 'per_sheet',
  },
  {
    category: 'nails',
    requiredWhenPresent: ['category', 'type'],
    criticalForCategory: ['length', 'count'],
    countEssential: true,
    preferred: ['coating', 'material'],
    brandStrictness: 'ignore',
    priceBasis: 'per_nail',
  },
  {
    category: 'screws',
    requiredWhenPresent: ['category', 'type'],
    criticalForCategory: ['length', 'count'],
    countEssential: true,
    preferred: ['coating', 'material'],
    brandStrictness: 'ignore',
    priceBasis: 'per_screw',
  },
  {
    category: 'lumber',
    requiredWhenPresent: ['category'],
    criticalForCategory: ['width', 'height', 'length'],
    countEssential: false,
    preferred: ['material', 'type'],
    brandStrictness: 'ignore',
    priceBasis: 'per_foot',
  },
  {
    category: 'plywood',
    requiredWhenPresent: ['category'],
    criticalForCategory: ['width', 'height', 'length'],
    countEssential: false,
    preferred: ['material'],
  },
  {
    category: 'notes',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count', 'size'],
    countEssential: true,
    preferred: ['type'],
    brandStrictness: 'strict',
    priceBasis: 'each',
  },
  {
    category: 'wipes',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count'],
    countEssential: true,
    preferred: ['type', 'material'],
    brandStrictness: 'strict',
    priceBasis: 'per_wipe',
  },
  {
    category: 'cleaning',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count', 'volume'],
    countEssential: false,
    preferred: ['type', 'material'],
  },
  {
    category: 'disinfecting',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count', 'volume'],
    countEssential: true,
    preferred: ['type'],
  },
  {
    category: 'markers',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count'],
    countEssential: true,
    preferred: ['type'],
  },
  {
    category: 'pens',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count'],
    countEssential: true,
    preferred: ['type'],
  },
  {
    category: 'tape',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['length', 'count'],
    countEssential: false,
    preferred: ['type', 'material'],
  },
  {
    category: 'containers',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count', 'volume'],
    countEssential: false,
    preferred: ['material'],
  },
  {
    category: 'trash bags',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['count', 'volume'],
    countEssential: true,
    preferred: ['type'],
  },
  {
    category: 'drill',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: [],
    countEssential: false,
    preferred: ['model', 'type'],
  },
  {
    category: 'saw',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: [],
    countEssential: false,
    preferred: ['model', 'type'],
  },
  {
    category: 'sander',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: [],
    countEssential: false,
    preferred: ['model', 'type'],
  },
  {
    category: 'cutting board',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['length', 'width'],
    countEssential: false,
    preferred: ['material'],
  },
  {
    category: 'foil',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['length', 'count'],
    countEssential: false,
    preferred: ['type'],
  },
  {
    category: 'wrap',
    requiredWhenPresent: ['brand', 'category'],
    criticalForCategory: ['length', 'count'],
    countEssential: false,
    preferred: ['type'],
  },
];

/** Get template for category, or default generic template. */
export function getCategoryTemplate(category: string | undefined): CategoryTemplate | null {
  if (!category) return null;
  const c = category.toLowerCase();
  return TEMPLATES.find((t) => t.category === c || c.includes(t.category)) ?? null;
}

/** Derive match requirements from item attributes and category template. */
export function getMatchRequirements(
  itemAttrs: ProductAttributes,
  template: CategoryTemplate | null
): MatchRequirements {
  const required: AttrKey[] = [];
  const preferred: AttrKey[] = [];

  const addRequired = (key: AttrKey) => {
    if (itemAttrs[key] != null && !required.includes(key)) required.push(key);
  };
  const addPreferred = (key: AttrKey) => {
    if (!preferred.includes(key)) preferred.push(key);
  };

  if (template) {
    const brandMode = template.brandStrictness ?? 'preferred';
    for (const key of template.requiredWhenPresent) {
      if (key === 'brand') {
        if (brandMode === 'ignore') continue;
        if (brandMode === 'preferred') { addPreferred('brand'); continue; }
      }
      addRequired(key);
    }
    for (const key of template.criticalForCategory) {
      if (itemAttrs[key] != null) addRequired(key);
    }
    if (template.countEssential && itemAttrs.count != null) {
      addRequired('count');
    }
    for (const key of template.preferred) {
      addPreferred(key);
    }
  } else {
    // Generic: brand, category, model when present on item
    if (itemAttrs.brand) addRequired('brand');
    if (itemAttrs.category) addRequired('category');
    if (itemAttrs.model) addRequired('model');
    if (itemAttrs.count != null) addRequired('count');
    if (itemAttrs.length) addRequired('length');
    if (itemAttrs.width) addRequired('width');
  addPreferred('material');
  addPreferred('coating');
  addPreferred('finish');
  addPreferred('color');
  addPreferred('type');
  addPreferred('size');
  }

  return { required, preferred };
}

/**
 * Compute normalized price for comparison based on category price basis.
 * Returns price per unit (sheet, wipe, nail, foot, oz, etc.) or raw price when each.
 */
export function computeNormalizedPrice(
  price: number,
  productAttrs: ProductAttributes,
  priceBasis: PriceBasis | undefined
): number {
  if (!priceBasis || priceBasis === 'each') return price;
  const count = productAttrs.count ?? 1;
  const length = productAttrs.length;
  const volume = productAttrs.volume;
  const weight = productAttrs.weight;

  switch (priceBasis) {
    case 'per_sheet':
      return count > 0 ? price / count : price;
    case 'per_wipe':
      return count > 0 ? price / count : price;
    case 'per_nail':
    case 'per_screw':
      return count > 0 ? price / count : price;
    case 'per_foot':
      if (length && (length.unit === 'ft' || length.unit === 'in')) {
        const ft = length.unit === 'ft' ? length.value : length.value / 12;
        return ft > 0 ? price / ft : price;
      }
      return price;
    case 'per_board':
      return price;
    case 'per_oz':
      if (volume && (volume.unit === 'oz' || volume.unit === 'ml')) {
        const oz = volume.unit === 'oz' ? volume.value : volume.value / 29.57;
        return oz > 0 ? price / oz : price;
      }
      if (weight && (weight.unit === 'oz' || weight.unit === 'lb')) {
        const oz = weight.unit === 'oz' ? weight.value : weight.value * 16;
        return oz > 0 ? price / oz : price;
      }
      return price;
    case 'per_ml':
      if (volume && (volume.unit === 'ml' || volume.unit === 'l')) {
        const ml = volume.unit === 'ml' ? volume.value : volume.value * 1000;
        return ml > 0 ? price / ml : price;
      }
      return price;
    default:
      return price;
  }
}

/** Build product family from item attributes. */
export function buildProductFamily(itemAttrs: ProductAttributes): ProductFamily {
  const family: ProductFamily = {};
  if (itemAttrs.brand) family.brand = itemAttrs.brand;
  if (itemAttrs.category) family.category = itemAttrs.category;
  if (itemAttrs.model) family.model = itemAttrs.model;
  if (itemAttrs.length || itemAttrs.width || itemAttrs.height || itemAttrs.diameter || itemAttrs.count != null) {
    family.criticalDimensions = {};
    if (itemAttrs.length) family.criticalDimensions.length = itemAttrs.length;
    if (itemAttrs.width) family.criticalDimensions.width = itemAttrs.width;
    if (itemAttrs.height) family.criticalDimensions.height = itemAttrs.height;
    if (itemAttrs.diameter) family.criticalDimensions.diameter = itemAttrs.diameter;
    if (itemAttrs.count != null) family.criticalDimensions.count = itemAttrs.count;
  }
  return family;
}
