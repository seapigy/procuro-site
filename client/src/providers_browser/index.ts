/**
 * Browser-based Price Provider Aggregator
 * Runs all retailer checks from the user's browser in parallel
 */

import { BrowserPriceResult, ProviderConfig } from './types';
import * as walmart from './walmart.browser';
import * as target from './target.browser';
import * as homedepot from './homedepot.browser';
import * as lowes from './lowes.browser';
import * as staples from './staples.browser';
import * as officedepot from './officedepot.browser';

// Re-export individual providers
export { walmart, target, homedepot, lowes, staples, officedepot };
export * from './types';
export * from './utils';

/**
 * Run all browser providers in parallel
 */
export async function checkAllRetailers(
  keyword: string,
  config?: ProviderConfig
): Promise<BrowserPriceResult[]> {
  console.log(`\n🔄 Checking prices across all retailers (from browser)...`);
  console.log(`   Keyword: "${keyword}"\n`);

  const providers = [
    { name: 'Walmart', fn: walmart.getPriceByKeyword },
    { name: 'Target', fn: target.getPriceByKeyword },
    { name: 'Home Depot', fn: homedepot.getPriceByKeyword },
    { name: "Lowe's", fn: lowes.getPriceByKeyword },
    { name: 'Staples', fn: staples.getPriceByKeyword },
    { name: 'Office Depot', fn: officedepot.getPriceByKeyword },
  ];

  // Run all providers in parallel
  const results = await Promise.allSettled(
    providers.map((provider) => provider.fn(keyword, config))
  );

  // Extract results
  const priceResults: BrowserPriceResult[] = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`❌ ${providers[index].name} failed:`, result.reason);
      return {
        retailer: providers[index].name,
        price: null,
        url: null,
        title: null,
        stock: null,
        image: null,
        error: result.reason?.message || 'Request failed',
      };
    }
  });

  // Filter and sort by price (lowest first)
  const validResults = priceResults.filter((r) => r.price !== null && r.price > 0);
  const sortedResults = [...validResults].sort((a, b) => {
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

  // Add results with no price at the end
  const noDataResults = priceResults.filter((r) => r.price === null);

  console.log(`\n✅ Browser price check complete: ${validResults.length}/${providers.length} retailers returned prices\n`);

  sortedResults.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.retailer}: $${result.price?.toFixed(2)} ${result.stock ? '✅ In Stock' : '❌ Out of Stock'}`);
  });

  return [...sortedResults, ...noDataResults];
}

/**
 * Get best price from all retailers
 */
export function getBestPrice(results: BrowserPriceResult[]): BrowserPriceResult | null {
  const validResults = results.filter((r) => r.price !== null && r.price > 0);
  if (validResults.length === 0) return null;
  
  return validResults.sort((a, b) => {
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  })[0];
}




