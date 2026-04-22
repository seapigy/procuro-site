/**
 * Decide which retailers to query for keyword discovery (price check).
 * Default: include both Amazon and Home Depot when unsure.
 * Fail-open: if rules would exclude both, include both.
 * prefersHomeDepotFirst: soft structural / hardware-ish — run Home Depot before Amazon when both enabled.
 */

export interface RetailerVisibility {
  amazon: boolean;
  homeDepot: boolean;
  /** When both retailers are enabled, prefer running Home Depot discovery before Amazon. */
  prefersHomeDepotFirst: boolean;
  /** Optional reason for DISCOVERY_DEBUG */
  reason?: string;
}

export interface RetailerSearchPolicyInput {
  name: string;
  category: string | null | undefined;
}

/** Structural / building materials — Amazon search is often noisy; exclude Amazon. */
const STRUCTURAL_NAME_PATTERNS: RegExp[] = [
  /\b2\s*x\s*4\b/i,
  /\b2x4\b/i,
  /\b2\s*x\s*6\b/i,
  /\b2x6\b/i,
  /\b2\s*x\s*8\b/i,
  /\b2x8\b/i,
  /\b2\s*x\s*10\b/i,
  /\b2x10\b/i,
  /\b2\s*x\s*12\b/i,
  /\b2x12\b/i,
  /\b1\s*x\s*4\b/i,
  /\b1x4\b/i,
  /\b1\s*x\s*6\b/i,
  /\b1x6\b/i,
  /\b4\s*x\s*4\b/i,
  /\b4x4\b/i,
  /\b6\s*x\s*6\b/i,
  /\b6x6\b/i,
  /\bpressure\s+treated\b/i,
  /\bpt\s+lumber\b/i,
  /\bdrywall\b/i,
  /\bsheetrock\b/i,
  /\bplywood\b/i,
  /\bosb\b/i,
  /\bstud\b/i,
  /\bconcrete\s+mix\b/i,
  /\bconcrete\s+bag\b/i,
  /\bquikrete\b/i,
  /\bmortar\s+mix\b/i,
  /\bgrout\b/i,
  /\brebar\b/i,
  /\bcinder\s+block\b/i,
  /\bconcrete\s+block\b/i,
  /\bpaver\b/i,
  /\blumber\b/i,
  /\bromex\b/i,
  /\bpvc\s+schedule\b/i,
  /\bpvc\s+pipe\b/i,
  /\babs\s+pipe\b/i,
  /\bdimensional\s+lumber\b/i,
  /\bframing\s+nails\b/i,
  /\bwire\s+strip\b/i,
  /\bcollated\s+nails\b/i,
  /\b28[-\s]?degree\b/i,
  /\bdrip\s+edge\b/i,
  /\broofing\s+nail\b/i,
  /\bashphalt\s+shingle\b/i,
  /\broof\s+felt\b/i,
  /\bice\s+and\s+water\b/i,
  /\bsubfloor\b/i,
  /\bsheathing\b/i,
  /\blvl\b/i,
  /\bjunction\s+box\b/i,
  /\bbreaker\b/i,
  /\bsubpanel\b/i,
  /\bemt\b/i,
  /\bnm[- ]?b\b/i,
  /\bfurring\b/i,
  /\bcedar\s+fence\b/i,
  /\bfence\s+picket\b/i,
];

const STRUCTURAL_CATEGORY_PATTERN =
  /building|lumber|construction|drywall|concrete|materials|framing|hardware|fasteners|roofing|masonry|decking|landscaping|electrical\s+rough|plumbing\s+rough/i;

/**
 * Borderline hardware / job-site SKUs — keep Amazon enabled but prefer Home Depot first.
 */
const SOFT_STRUCTURAL_NAME_PATTERNS: RegExp[] = [
  /\bpex\b/i,
  /\bpex\s+pipe\b/i,
  /\bsharkbite\b/i,
  /\bcopper\s+fitting\b/i,
  /\bsolder\b/i,
  /\bflux\b/i,
  /\bthinset\b/i,
  /\bfloor\s+leveler\b/i,
  /\bself[- ]leveler\b/i,
  /\bdeck\s+board\b/i,
  /\bcomposite\s+decking\b/i,
  /\bclear\s+cedar\b/i,
  /\bredwood\b/i,
  /\banchor\s+bolt\b/i,
  /\bwedge\s+anchor\b/i,
  /\btapcon\b/i,
  /\bjoist\s+hanger\b/i,
  /\bhurricane\s+tie\b/i,
  /\bpost\s+base\b/i,
  /\bbeam\s+clamp\b/i,
  /\bduct\s+strap\b/i,
  /\bcable\s+staple\b/i,
  /\bvcg\s+box\b/i,
  /\berosion\s+control\b/i,
  /\bdrainage\s+pipe\b/i,
  /\bcatch\s+basin\b/i,
  /\bfrench\s+drain\b/i,
  /\bsill\s+seal\b/i,
  /\bhouse\s+wrap\b/i,
  /\btyvek\b/i,
  /\bblue\s+skin\b/i,
  /\bbeam\b/i,
  /\blally\s+column\b/i,
];

const SOFT_STRUCTURAL_CATEGORY_PATTERN =
  /lumber|hardware|building\s+materials|electrical|plumbing|roofing|concrete|masonry|deck(ing)?|fence|paint\s+supplies/i;

/** Office / printer consumables — Home Depot search is a poor fit. */
const OFFICE_NAME_PATTERNS: RegExp[] = [
  /\btoner\s+cartridge\b/i,
  /\bink\s+cartridge\b/i,
  /\blaser\s+toner\b/i,
  /\bprinter\s+ribbon\b/i,
  /\binkjet\b/i,
  /\bcopy\s+paper\b/i,
  /\bprinter\s+paper\b/i,
  /\bphoto\s+paper\b/i,
];

const OFFICE_CATEGORY_PATTERN =
  /office\s*supplies|printing|ink|toner|stationery|copier|printer\s+consum/i;

function matchesAny(haystack: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(haystack));
}

export function getRetailerVisibility(input: RetailerSearchPolicyInput): RetailerVisibility {
  const name = (input.name || '').trim();
  const cat = (input.category || '').trim();
  const catLower = cat.toLowerCase();

  let amazon = true;
  let homeDepot = true;
  const notes: string[] = [];

  const structuralName = matchesAny(name, STRUCTURAL_NAME_PATTERNS);
  const structuralCat = cat.length > 0 && STRUCTURAL_CATEGORY_PATTERN.test(catLower);

  const officeName = matchesAny(name, OFFICE_NAME_PATTERNS);
  const officeCat = cat.length > 0 && OFFICE_CATEGORY_PATTERN.test(catLower);

  if (structuralName || structuralCat) {
    amazon = false;
    notes.push('exclude_amazon_structural');
  }
  if (officeName || officeCat) {
    homeDepot = false;
    notes.push('exclude_homedepot_office');
  }

  if (!amazon && !homeDepot) {
    return {
      amazon: true,
      homeDepot: true,
      prefersHomeDepotFirst: false,
      reason: 'policy_fail_open_both_would_exclude',
    };
  }

  const softStructuralName = matchesAny(name, SOFT_STRUCTURAL_NAME_PATTERNS);
  const softStructuralCat =
    cat.length > 0 && SOFT_STRUCTURAL_CATEGORY_PATTERN.test(catLower);

  const prefersHomeDepotFirst =
    !!((softStructuralName || softStructuralCat) && amazon && homeDepot);

  if (prefersHomeDepotFirst) {
    notes.push('prefer_hd_first_soft_structural');
  }

  return {
    amazon,
    homeDepot,
    prefersHomeDepotFirst,
    reason: notes.length ? notes.join(',') : undefined,
  };
}
