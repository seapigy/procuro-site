import {
  mergeDiscoveryRouting,
  orderRetailDiscoveryProviders,
  buildDiscoveryProfileKey,
} from '../src/services/discoveryProfile';
import { getRetailerVisibility } from '../src/services/retailerSearchPolicy';

describe('discoveryProfile', () => {
  it('mergeDiscoveryRouting keeps regex prefersHomeDepotFirst without profile', () => {
    const v = getRetailerVisibility({ name: 'PEX elbow 1/2', category: 'Plumbing' });
    const m = mergeDiscoveryRouting(v, null, false);
    expect(m.prefersHomeDepotFirst).toBe(true);
    expect(m.amazonKeywordOverride).toBeNull();
  });

  it('mergeDiscoveryRouting applies global HD bias when evidence strong enough', () => {
    const v = getRetailerVisibility({ name: 'DEWALT 20V Drill', category: 'Tools' });
    const m = mergeDiscoveryRouting(
      v,
      {
        hdWinCount: 3,
        amazonWinCount: 0,
        homeDepotSearchHint: 'dewalt drill 20v',
        amazonSearchHint: null,
      },
      true
    );
    expect(m.prefersHomeDepotFirst).toBe(true);
    expect(m.homeDepotKeywordOverride).toBe('dewalt drill 20v');
  });

  it('mergeDiscoveryRouting applies Amazon-first when wins favor Amazon', () => {
    const v = getRetailerVisibility({ name: 'PEX elbow 1/2', category: 'Plumbing' });
    const m = mergeDiscoveryRouting(
      v,
      {
        hdWinCount: 0,
        amazonWinCount: 4,
        homeDepotSearchHint: null,
        amazonSearchHint: 'pex elbow',
      },
      true
    );
    expect(m.prefersHomeDepotFirst).toBe(false);
    expect(m.amazonKeywordOverride).toBe('pex elbow');
  });

  it('orderRetailDiscoveryProviders moves Home Depot before Amazon', () => {
    const providers = [{ name: 'Amazon' }, { name: 'Home Depot' }] as const;
    const ordered = orderRetailDiscoveryProviders(providers, true);
    expect(ordered.map((p) => p.name)).toEqual(['Home Depot', 'Amazon']);
  });

  it('buildDiscoveryProfileKey returns null for short generic names', () => {
    expect(buildDiscoveryProfileKey({ name: 'short' })).toBeNull();
  });
});
