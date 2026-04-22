import { createHash } from 'crypto';
import prisma from '../lib/prisma';
import { normalizeItemName } from './matching/normalize';
import type { RetailerVisibility } from './retailerSearchPolicy';

/** Minimum normalized name length to use a global profile key (avoid ultra-generic keys). */
const MIN_NORMALIZED_LEN = 10;

export function isGlobalDiscoveryProfilesEnabled(): boolean {
  return process.env.GLOBAL_DISCOVERY_PROFILES_ENABLED?.trim().toLowerCase() === 'true';
}

/**
 * Stable cross-tenant key: kv1 + normalized name + brand + ASIN (product identity only).
 */
export function buildDiscoveryProfileKey(input: {
  name: string;
  productBrand?: string | null;
  amazonAsin?: string | null;
}): string | null {
  const normalized = normalizeItemName(input.name || '').normalized.trim();
  if (normalized.length < MIN_NORMALIZED_LEN) return null;
  const brand = (input.productBrand ?? '').trim().toLowerCase();
  const asin = (input.amazonAsin ?? '').trim().toUpperCase();
  const payload = `kv1|${normalized}|${brand}|${asin}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export type MergedDiscoveryRouting = {
  amazon: boolean;
  homeDepot: boolean;
  prefersHomeDepotFirst: boolean;
  amazonKeywordOverride: string | null;
  homeDepotKeywordOverride: string | null;
};

/** Require this many "wins" on one side before global profile can flip ordering vs regex-only. */
const MIN_WIN_BIAS = 2;

export function mergeDiscoveryRouting(
  visibility: RetailerVisibility,
  profile: {
    hdWinCount: number;
    amazonWinCount: number;
    homeDepotSearchHint: string | null;
    amazonSearchHint: string | null;
  } | null,
  profilesEnabled: boolean
): MergedDiscoveryRouting {
  let prefersHomeDepotFirst = !!visibility.prefersHomeDepotFirst;
  let amazonKeywordOverride: string | null = null;
  let homeDepotKeywordOverride: string | null = null;

  if (profilesEnabled && profile && visibility.amazon && visibility.homeDepot) {
    const { hdWinCount, amazonWinCount } = profile;
    if (hdWinCount >= MIN_WIN_BIAS && hdWinCount > amazonWinCount) {
      prefersHomeDepotFirst = true;
    } else if (amazonWinCount >= MIN_WIN_BIAS && amazonWinCount > hdWinCount) {
      prefersHomeDepotFirst = false;
    }

    const anyEvidence = hdWinCount + amazonWinCount >= 1;
    if (anyEvidence) {
      if (profile.homeDepotSearchHint?.trim()) {
        homeDepotKeywordOverride = profile.homeDepotSearchHint.trim().slice(0, 500);
      }
      if (profile.amazonSearchHint?.trim()) {
        amazonKeywordOverride = profile.amazonSearchHint.trim().slice(0, 500);
      }
    }
  }

  return {
    amazon: visibility.amazon,
    homeDepot: visibility.homeDepot,
    prefersHomeDepotFirst,
    amazonKeywordOverride,
    homeDepotKeywordOverride,
  };
}

export async function getDiscoveryProfile(key: string | null) {
  if (!key) return null;
  return prisma.itemDiscoveryProfile.findUnique({ where: { key } });
}

export async function reinforceDiscoveryFromPriceCheck(params: {
  key: string | null;
  hadHomeDepotQuotes: boolean;
  hadAmazonQuotes: boolean;
  homeDepotKeyword?: string;
  amazonKeyword?: string;
}): Promise<void> {
  if (!isGlobalDiscoveryProfilesEnabled() || !params.key) return;
  if (!params.hadHomeDepotQuotes && !params.hadAmazonQuotes) return;

  const now = new Date();
  const hdInc = params.hadHomeDepotQuotes ? 1 : 0;
  const amzInc = params.hadAmazonQuotes ? 1 : 0;

  const existing = await prisma.itemDiscoveryProfile.findUnique({
    where: { key: params.key },
  });

  const nextHd = (existing?.hdWinCount ?? 0) + hdInc;
  const nextAmz = (existing?.amazonWinCount ?? 0) + amzInc;

  let homeDepotSearchHint = existing?.homeDepotSearchHint ?? null;
  let amazonSearchHint = existing?.amazonSearchHint ?? null;
  if (params.hadHomeDepotQuotes && params.homeDepotKeyword?.trim()) {
    homeDepotSearchHint = params.homeDepotKeyword.trim().slice(0, 500);
  }
  if (params.hadAmazonQuotes && params.amazonKeyword?.trim()) {
    amazonSearchHint = params.amazonKeyword.trim().slice(0, 500);
  }

  await prisma.itemDiscoveryProfile.upsert({
    where: { key: params.key },
    create: {
      key: params.key,
      hdWinCount: hdInc,
      amazonWinCount: amzInc,
      homeDepotSearchHint,
      amazonSearchHint,
      lastReinforcedAt: now,
    },
    update: {
      hdWinCount: nextHd,
      amazonWinCount: nextAmz,
      ...(params.hadHomeDepotQuotes && params.homeDepotKeyword?.trim()
        ? { homeDepotSearchHint }
        : {}),
      ...(params.hadAmazonQuotes && params.amazonKeyword?.trim() ? { amazonSearchHint } : {}),
      lastReinforcedAt: now,
    },
  });
}

/** After a successful catalog match, reinforce global discovery bias for this product key. */
export async function reinforceDiscoveryFromCatalogMatch(params: {
  key: string | null;
  retailer: 'amazon' | 'homedepot';
  discoveryKeyword: string;
}): Promise<void> {
  await reinforceDiscoveryFromPriceCheck({
    key: params.key,
    hadHomeDepotQuotes: params.retailer === 'homedepot',
    hadAmazonQuotes: params.retailer === 'amazon',
    homeDepotKeyword: params.retailer === 'homedepot' ? params.discoveryKeyword : undefined,
    amazonKeyword: params.retailer === 'amazon' ? params.discoveryKeyword : undefined,
  });
}

export type RetailerProviderLike = { name: string };

/** Put Home Depot before Amazon in the provider list when policy/profile requests it. */
export function orderRetailDiscoveryProviders<T extends RetailerProviderLike>(
  providers: readonly T[],
  prefersHomeDepotFirst: boolean
): T[] {
  const list = [...providers];
  const hdIdx = list.findIndex((p) => p.name === 'Home Depot');
  const amzIdx = list.findIndex((p) => p.name === 'Amazon');
  if (!prefersHomeDepotFirst || hdIdx === -1 || amzIdx === -1 || hdIdx < amzIdx) {
    return list;
  }
  const [hd] = list.splice(hdIdx, 1);
  const insertBefore = list.findIndex((p) => p.name === 'Amazon');
  if (insertBefore >= 0) list.splice(insertBefore, 0, hd);
  return list;
}
