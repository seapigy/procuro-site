/**
 * Home Depot product URLs: /p/{slug}/{numericId} or /p/{numericId}
 */
const HOMEDEPOT_BASE = 'https://www.homedepot.com';

/**
 * Extract numeric product id from a homedepot.com product URL when present.
 */
export function extractHomeDepotProductIdFromUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = url.trim();
    if (!u.includes('homedepot.com')) return null;
    const path = new URL(u.startsWith('http') ? u : `https:${u}`).pathname;
    const parts = path.split('/').filter(Boolean);
    const pIdx = parts.indexOf('p');
    if (pIdx < 0) return null;
    const afterP = parts.slice(pIdx + 1);
    for (let i = afterP.length - 1; i >= 0; i--) {
      const seg = afterP[i];
      if (/^\d{6,12}$/.test(seg)) return seg;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildCanonicalHomeDepotProductUrl(productId: string | null | undefined): string | null {
  if (!productId || typeof productId !== 'string' || !/^\d{6,12}$/.test(productId.trim())) return null;
  return `${HOMEDEPOT_BASE}/p/${productId.trim()}`;
}
