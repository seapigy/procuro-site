/**
 * Retail Price Providers - Export all providers and aggregator
 */

// Amazon - Standby mode (not registered, file preserved)
// export * as amazon from './amazon';

// Target - Disabled
// export * as target from './target';
// HomeDepot - Disabled
// export * as homedepot from './homedepot';
// Lowes - Disabled
// export * as lowes from './lowes';
// Staples - Disabled
// export * as staples from './staples';
export * as officedepot from './officedepot';

export * from './aggregateProvider';
export * from './types';
export * from './utils';

// Default export for convenience
import { aggregateProviders, getBestPrice } from './aggregateProvider';

export default {
  aggregateProviders,
  getBestPrice,
};

