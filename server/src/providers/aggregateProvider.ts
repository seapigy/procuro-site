/**
 * Aggregate Provider - runs all retail providers in parallel
 * Returns sorted results by price (lowest first)
 */

import { PriceResult } from './types';
import * as amazon from './amazon';
import * as walmart from './walmart';
import * as target from './target';
import * as homedepot from './homedepot';
import * as lowes from './lowes';
import * as staples from './staples';
import * as officedepot from './officedepot';
import prisma from '../lib/prisma';

interface AggregateOptions {
  keyword?: string;
  sku?: string;
  timeout?: number;
  itemId?: number;
  lastPaidPrice?: number;
}

interface ProviderResult {
  retailer: string;
  result: PriceResult;
  status: 'fulfilled' | 'rejected';
  error?: string;
}

/**
 * Run all providers in parallel and return sorted results
 */
export async function aggregateProviders(options: AggregateOptions): Promise<PriceResult[]> {
  console.log(`\n🔄 Aggregating prices from all providers...`);
  console.log(`   Keyword: ${options.keyword || 'N/A'}`);
  console.log(`   SKU: ${options.sku || 'N/A'}\n`);

  const providers = [
    { name: 'Amazon', module: amazon },
    { name: 'Walmart', module: walmart },
    { name: 'Target', module: target },
    { name: 'Home Depot', module: homedepot },
    { name: "Lowe's", module: lowes },
    { name: 'Staples', module: staples },
    { name: 'Office Depot', module: officedepot },
  ];

  // Run all providers in parallel
  const promises = providers.map(async (provider) => {
    try {
      const result = options.keyword
        ? await provider.module.getPriceByKeyword(options.keyword, { timeout: options.timeout })
        : options.sku
        ? await provider.module.getPriceBySKU(options.sku, { timeout: options.timeout })
        : null;

      return {
        retailer: provider.name,
        result: result || createEmptyResult(provider.name),
        status: 'fulfilled' as const,
      };
    } catch (error) {
      console.error(`❌ ${provider.name} failed:`, error instanceof Error ? error.message : error);
      return {
        retailer: provider.name,
        result: createEmptyResult(provider.name),
        status: 'rejected' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  const results = await Promise.allSettled(promises);

  // Extract successful results
  const providerResults: ProviderResult[] = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => (result as PromiseFulfilledResult<ProviderResult>).value);

  // Filter out null prices
  const validResults = providerResults
    .map((pr) => pr.result)
    .filter((result) => result.price !== null && result.price > 0);

  // Sort by price (lowest first)
  const sortedResults = validResults.sort((a, b) => {
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

  console.log(`\n✅ Aggregation complete: ${validResults.length}/${providers.length} providers returned prices\n`);

  // Log results
  sortedResults.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.retailer}: $${result.price?.toFixed(2)} ${result.stock ? '✅ In Stock' : '❌ Out of Stock'}`);
  });

  // Store results in database if itemId provided
  if (options.itemId && sortedResults.length > 0) {
    await storeResults(options.itemId, sortedResults, options.lastPaidPrice);
  }

  return sortedResults;
}

/**
 * Store price results in database and create alerts
 */
async function storeResults(
  itemId: number,
  results: PriceResult[],
  lastPaidPrice?: number
): Promise<void> {
  try {
    console.log(`\n💾 Storing ${results.length} price results in database...`);

    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      console.error('❌ Item not found');
      return;
    }

    const currentLastPaidPrice = lastPaidPrice || item.lastPaidPrice;

    // Store each result as a Price record
    for (const result of results) {
      if (result.price === null) continue;

      await prisma.price.create({
        data: {
          itemId,
          retailer: result.retailer,
          price: result.price,
          url: result.url,
          date: new Date(),
        },
      });

      // Create alert if price is lower than lastPaidPrice
      const savings = currentLastPaidPrice - result.price;
      const savingsPercent = (savings / currentLastPaidPrice) * 100;

      if (savingsPercent >= 5) {
        // At least 5% savings
        const estimatedMonthlySavings =
          savings * (30 / (item.reorderIntervalDays || 30));

        await prisma.alert.create({
          data: {
            userId: item.userId,
            itemId: item.id,
            retailer: result.retailer,
            oldPrice: currentLastPaidPrice,
            newPrice: result.price,
            savingsPerOrder: savings,
            estimatedMonthlySavings,
            url: result.url || '',
            viewed: false,
            seen: false,
            alertDate: new Date(),
          },
        });

        console.log(`   🔔 Alert created: ${result.retailer} - Save $${savings.toFixed(2)} (${savingsPercent.toFixed(1)}%)`);
      }
    }

    console.log(`✅ Database storage complete\n`);
  } catch (error) {
    console.error('❌ Error storing results:', error);
  }
}

/**
 * Create an empty result for a retailer
 */
function createEmptyResult(retailer: string): PriceResult {
  return {
    price: null,
    url: null,
    stock: null,
    retailer,
    title: null,
    image: null,
  };
}

/**
 * Get best price from all providers
 */
export async function getBestPrice(keyword: string, sku?: string): Promise<PriceResult | null> {
  const results = await aggregateProviders({ keyword, sku });
  
  if (results.length === 0) {
    return null;
  }

  return results[0]; // Already sorted by price, so first is best
}

