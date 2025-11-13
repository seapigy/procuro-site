/**
 * Retail Price Providers - Export all providers and aggregator
 */

export * as amazon from './amazon';
export * as walmart from './walmart';
export * as target from './target';
export * as homedepot from './homedepot';
export * as lowes from './lowes';
export * as staples from './staples';
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

