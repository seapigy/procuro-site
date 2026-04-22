/**
 * Aggregate keyword → Office Depot via `/api/provider/officedepot` (legacy / tests).
 * Monitored item discovery uses Bright Data Amazon + Home Depot in `priceCheck.ts`.
 */

import { PriceResult } from './types';
import prisma from '../lib/prisma';
import fetch from 'node-fetch';
import appConfig from '../../../config/app.json';

interface AggregateOptions {
  keyword?: string;
  timeout?: number;
  itemId?: number;
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
  console.log(`   Keyword: ${options.keyword || 'N/A'}\n`);

  const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

  const promises = [
    (async () => {
      try {
        if (!options.keyword) {
          return {
            retailer: 'Office Depot',
            result: createEmptyResult('Office Depot'),
            status: 'fulfilled' as const,
          };
        }
        const response = await fetch(`${API_BASE}/api/provider/officedepot?keyword=${encodeURIComponent(options.keyword)}`);
        const data = await response.json();
        const parsed = data.parsed || createEmptyResult('Office Depot');
        return {
          retailer: 'Office Depot',
          result: parsed,
          status: 'fulfilled' as const,
        };
      } catch (error) {
        console.error(`❌ Office Depot failed:`, error instanceof Error ? error.message : error);
        return {
          retailer: 'Office Depot',
          result: createEmptyResult('Office Depot'),
          status: 'rejected' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })(),
  ];

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

  console.log(`\n✅ Aggregation complete: ${validResults.length}/1 providers returned prices\n`);

  // Log results
  sortedResults.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.retailer}: $${result.price?.toFixed(2)} ${result.stock ? '✅ In Stock' : '❌ Out of Stock'}`);
  });

  // Store results in database if itemId provided
  if (options.itemId && sortedResults.length > 0) {
    await storeResults(options.itemId, sortedResults);
  }

  return sortedResults;
}

/**
 * Store price results in database and create alerts
 */
async function storeResults(
  itemId: number,
  results: PriceResult[]
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

    // Savings and alerts use baselineUnitPrice only (sticky baseline)
    const baselineUnitPrice =
      item.baselineUnitPrice != null && item.baselineUnitPrice > 0
        ? item.baselineUnitPrice
        : null;

    if (baselineUnitPrice == null) {
      console.warn(`⚠️  No baseline unit price for item ${item.id}, skipping alert calculations`);
    }

    let bestPriceThisRun: number | null = null;
    let bestResultThisRun: (typeof results)[0] | null = null;

    for (const result of results) {
      const price = result.price;
      if (price == null || price <= 0) continue;

      await prisma.price.create({
        data: {
          itemId,
          companyId: item.companyId,
          retailer: result.retailer,
          price,
          url: result.url,
          date: new Date(),
        },
      });

      const { storePriceHistory } = await import('../services/priceHistory');
      await storePriceHistory(itemId, item.companyId, price, result.retailer);

      if (bestPriceThisRun == null || price < bestPriceThisRun) {
        bestPriceThisRun = price;
        bestResultThisRun = result;
      }

      if (baselineUnitPrice == null) continue;

      const savings = baselineUnitPrice - price;
      const priceDropPercent = savings / baselineUnitPrice;
      const thresholdPct = (appConfig.pricing?.priceDropThreshold as number) ?? 0.05;
      const minDollars = (appConfig.pricing?.minimumSavingsAmount as number) ?? 0.5;
      if (priceDropPercent >= thresholdPct || savings >= minDollars) {
        const estimatedMonthlySavings =
          savings * (30 / (item.reorderIntervalDays || 30));

        await prisma.alert.create({
          data: {
            userId: item.userId,
            itemId: item.id,
            companyId: item.companyId,
            retailer: result.retailer,
            oldPrice: baselineUnitPrice,
            newPrice: price,
            priceDropAmount: savings,
            savingsPerOrder: savings,
            estimatedMonthlySavings,
            url: result.url || '',
            viewed: false,
            seen: false,
            alertDate: new Date(),
          },
        });

        console.log(`   🔔 Alert created: ${result.retailer} - Save $${savings.toFixed(2)} (${(priceDropPercent * 100).toFixed(1)}%) (baseline: $${baselineUnitPrice.toFixed(2)})`);
      }
    }

    // Best-deal tracking: update item if this run found a lower price than current best
    if (bestPriceThisRun != null && bestResultThisRun != null) {
      const currentBest = item.bestDealUnitPrice;
      if (currentBest == null || bestPriceThisRun < currentBest) {
        await prisma.item.update({
          where: { id: itemId },
          data: {
            bestDealUnitPrice: bestPriceThisRun,
            bestDealFoundAt: new Date(),
            bestDealRetailer: bestResultThisRun.retailer,
            bestDealUrl: bestResultThisRun.url,
          },
        });
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
export async function getBestPrice(keyword: string): Promise<PriceResult | null> {
  const results = await aggregateProviders({ keyword });
  
  if (results.length === 0) {
    return null;
  }

  return results[0]; // Already sorted by price, so first is best
}

