/**
 * Unit conversion for comparable dimension/quantity matching.
 * Converts to canonical base units for hard-filter comparison.
 */

import type { DimensionValue } from './attributes';

/** Canonical base units. */
export const CANONICAL = {
  length: 'in',
  weight: 'g',
  volume: 'ml',
  sheets: 'sheets',
} as const;

/** Ream = 500 sheets. */
const REAM_SHEETS = 500;

/** oz per lb. */
const OZ_PER_LB = 16;

/** g per oz (approx). */
const G_PER_OZ = 28.35;

/** ml per fl oz (US). */
const ML_PER_OZ = 29.57;

/** ml per L. */
const ML_PER_L = 1000;

/** ml per gal (US). */
const ML_PER_GAL = 3785;

/** in per ft. */
const IN_PER_FT = 12;

/** mm per in. */
const MM_PER_IN = 25.4;

/** cm per in. */
const CM_PER_IN = 2.54;

/**
 * Convert length to canonical (inches).
 */
export function toCanonicalLength(d: DimensionValue): number | null {
  const u = d.unit.toLowerCase();
  const v = d.value;
  if (u === 'in' || u === 'inch' || u === 'inches') return v;
  if (u === 'ft' || u === 'foot' || u === 'feet') return v * IN_PER_FT;
  if (u === 'mm') return v / MM_PER_IN;
  if (u === 'cm') return v / CM_PER_IN;
  return null;
}

/**
 * Convert weight to canonical (grams).
 */
export function toCanonicalWeight(d: DimensionValue): number | null {
  const u = d.unit.toLowerCase();
  const v = d.value;
  if (u === 'g') return v;
  if (u === 'kg') return v * 1000;
  if (u === 'oz') return v * G_PER_OZ;
  if (u === 'lb') return v * OZ_PER_LB * G_PER_OZ;
  return null;
}

/**
 * Convert volume to canonical (ml).
 */
export function toCanonicalVolume(d: DimensionValue): number | null {
  const u = d.unit.toLowerCase();
  const v = d.value;
  if (u === 'ml') return v;
  if (u === 'l') return v * ML_PER_L;
  if (u === 'oz') return v * ML_PER_OZ;
  if (u === 'gal') return v * ML_PER_GAL;
  return null;
}

/**
 * Convert count/quantity to canonical sheets (for paper) or raw count.
 */
export function toCanonicalCount(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === 'sheets' || u === 'sheet') return value;
  if (u === 'ream' || u === 'reams') return value * REAM_SHEETS;
  if (u === 'ct' || u === 'count' || u === 'pack' || u === 'each') return value;
  return value;
}

/**
 * Check if two dimension values match after conversion to canonical.
 * tolerancePct: e.g. 0.05 for 5%.
 */
export function dimensionsMatchCanonical(
  a?: DimensionValue,
  b?: DimensionValue,
  kind: 'length' | 'weight' | 'volume' = 'length',
  tolerancePct = 0.05
): boolean {
  if (!a || !b) return true;
  let va: number | null = null;
  let vb: number | null = null;
  if (kind === 'length') {
    va = toCanonicalLength(a);
    vb = toCanonicalLength(b);
  } else if (kind === 'weight') {
    va = toCanonicalWeight(a);
    vb = toCanonicalWeight(b);
  } else if (kind === 'volume') {
    va = toCanonicalVolume(a);
    vb = toCanonicalVolume(b);
  }
  if (va == null || vb == null) {
    if (a.unit === b.unit) {
      const ratio = a.value / b.value;
      return ratio >= 1 - tolerancePct && ratio <= 1 + tolerancePct;
    }
    return false;
  }
  const ratio = va / vb;
  return ratio >= 1 - tolerancePct && ratio <= 1 + tolerancePct;
}

/**
 * Infer dimension kind from unit.
 */
export function inferDimensionKind(unit: string): 'length' | 'weight' | 'volume' | 'other' {
  const u = unit.toLowerCase();
  if (['in', 'inch', 'ft', 'foot', 'mm', 'cm'].includes(u)) return 'length';
  if (['oz', 'lb', 'g', 'kg'].includes(u)) return 'weight';
  if (['ml', 'l', 'gal'].includes(u)) return 'volume';
  return 'other';
}
