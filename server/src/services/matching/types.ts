/**
 * Commerce matching types: confidence bands, rejection reasons, debug view.
 */

import type { ProductAttributes } from './attributes';

/** Confidence band for a candidate. */
export type ConfidenceBand = 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'rejected';

/** Structured rejection reason. */
export type RejectionReasonCode =
  | 'brand_mismatch'
  | 'category_mismatch'
  | 'count_mismatch'
  | 'dimension_mismatch'
  | 'model_mismatch'
  | 'variation_mismatch'
  | 'price_sanity_mismatch'
  | 'outside_product_family'
  | 'score_too_low'
  | 'negative_keyword'
  | 'bundle_replacement_renewed';

export interface RejectionReason {
  code: RejectionReasonCode;
  detail: string;
}

/** Which attributes are required vs preferred for this item. */
export interface MatchRequirements {
  required: Array<keyof ProductAttributes>;
  preferred: Array<keyof ProductAttributes>;
}

/** Product family: intended product definition for filtering. */
export interface ProductFamily {
  brand?: string;
  category?: string;
  model?: string;
  /** Critical dimensions that define the product (e.g. 24" for monitor). */
  criticalDimensions?: Partial<Record<'length' | 'width' | 'height' | 'diameter' | 'count', unknown>>;
}

/** Normalized debug view for a candidate. */
export interface CandidateDebugView {
  asin: string;
  title: string;
  price: number;
  normalizedUnitPrice?: number;
  normalizedUnitType?: string;
  itemAttributes: ProductAttributes;
  productAttributes: ProductAttributes;
  rejectionReason: RejectionReason | null;
  scoreBreakdown: Record<string, number>;
  confidenceBand: ConfidenceBand;
  combinedScore: number;
  /** Brand/entity inference and match visibility. */
  brandDebug?: {
    inferredBrand: string | undefined;
    inferenceSignals: string[];
    productBrand: string | undefined;
    brandInTitle: boolean;
    brandMatchResult: 'positive' | 'negative' | 'neutral';
  };
  /** Amazon schema fields for debug. */
  amazonDebug?: {
    brand?: string;
    model_number?: string;
    categoriesDeptSummary?: string;
    chosenPriceField?: string;
    availability?: string | boolean;
    amazon_prime?: boolean;
    bundleReplacementRenewedDetected?: string | null;
    matchOrRejectReason?: string;
    /** For monitors: which field was used for size validation (screen_size_from_title | product_dimensions). */
    monitorSizeSource?: string;
    /** For monitors: screen size value used (e.g. "24 in"). */
    monitorScreenSize?: string;
  };
}

