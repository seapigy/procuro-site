import type { RetailerProvider } from '../types/retailer';
import { mockProvider } from './mockProvider';
import { amazonBrightDataProvider } from './amazonBrightDataProvider';
import { homeDepotBrightDataProvider } from './homeDepotBrightDataProvider';
import { discoverySimulateProvider } from './discoverySimulateProvider';
import { getBrightDataConfig } from '../config/brightData';

const explicit = process.env.USE_MOCK_PROVIDER?.trim().toLowerCase();
const USE_MOCK_PROVIDER =
  explicit === 'true' || (explicit !== 'false' && process.env.NODE_ENV !== 'production');

const DISCOVERY_SIMULATE = process.env.DISCOVERY_SIMULATE === 'true';

function getHomeDepotProviders(): RetailerProvider[] {
  const config = getBrightDataConfig();
  if (config.apiKey && config.homeDepotDatasetId) {
    return [homeDepotBrightDataProvider];
  }
  return [];
}

/**
 * Enabled retailer providers for the price-check pipeline.
 * - Mock: enabled in dev/test when USE_MOCK_PROVIDER=true or NODE_ENV !== production
 * - DiscoverySimulate: when DISCOVERY_SIMULATE=true, simulates search→persist flow (no external APIs)
 * - Amazon (Bright Data): enabled when BRIGHTDATA_ENABLED and vars present
 * - Home Depot: when BRIGHTDATA_API_KEY and BRIGHTDATA_HOMEDEPOT_DATASET_ID are set
 */
export const enabledRetailerProviders: RetailerProvider[] = DISCOVERY_SIMULATE
  ? [discoverySimulateProvider]
  : [
      ...(USE_MOCK_PROVIDER ? [mockProvider] : []),
      ...(getBrightDataConfig().enabled ? [amazonBrightDataProvider] : []),
      ...(!USE_MOCK_PROVIDER ? getHomeDepotProviders() : []),
    ];
