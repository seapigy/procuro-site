/**
 * INTEGRATION TESTS - Aggregate Provider
 * Tests the parallel aggregation logic with REAL API calls
 */

import { aggregateProviders, getBestPrice } from '../src/providers/aggregateProvider';
import { PriceResult } from '../src/providers/types';

jest.setTimeout(60000); // 60 seconds for all providers

describe('Aggregate Provider Integration Tests', () => {
  
  it('should aggregate prices from all providers', async () => {
    console.log('\n🔄 Running full aggregation for "HP printer paper"...\n');
    
    const startTime = Date.now();
    const results = await aggregateProviders({
      keyword: 'HP printer paper',
      timeout: 8000,
    });
    const duration = Date.now() - startTime;

    console.log(`\n✅ Aggregation completed in ${duration}ms\n`);

    // Should return an array
    expect(Array.isArray(results)).toBe(true);

    // Should have results from at least some providers
    expect(results.length).toBeGreaterThanOrEqual(0);

    // Filter valid results (with prices)
    const validResults = results.filter(r => r.price !== null && r.price > 0);
    
    console.log(`\n📊 Results: ${validResults.length}/${results.length} providers returned prices\n`);

    // At least 2 providers should return data for common items
    expect(validResults.length).toBeGreaterThanOrEqual(2);

    // Each result should have required fields
    validResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.retailer}: $${result.price?.toFixed(2)} ${result.stock ? '✅' : '❌'}`);
      
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('stock');
      expect(result).toHaveProperty('retailer');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('image');

      expect(typeof result.retailer).toBe('string');
      expect(result.retailer).not.toBe('');
    });

    // Should be sorted by price (lowest first)
    for (let i = 0; i < validResults.length - 1; i++) {
      expect(validResults[i].price!).toBeLessThanOrEqual(validResults[i + 1].price!);
    }

    // No duplicate retailers
    const retailers = validResults.map(r => r.retailer);
    const uniqueRetailers = new Set(retailers);
    expect(retailers.length).toBe(uniqueRetailers.size);

    // Parallel execution should be fast (< 10 seconds for 7 providers)
    expect(duration).toBeLessThan(10000);
  });

  it('should aggregate prices for BIC pens', async () => {
    console.log('\n🔄 Running aggregation for "bic pens"...\n');
    
    const results = await aggregateProviders({
      keyword: 'bic pens',
      timeout: 8000,
    });

    const validResults = results.filter(r => r.price !== null);
    
    console.log(`\n📊 Results: ${validResults.length}/${results.length} providers returned prices\n`);

    expect(validResults.length).toBeGreaterThanOrEqual(2);

    // Log results
    validResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.retailer}: $${result.price?.toFixed(2)}`);
    });
  });

  it('should aggregate prices for stapler', async () => {
    console.log('\n🔄 Running aggregation for "heavy duty stapler"...\n');
    
    const results = await aggregateProviders({
      keyword: 'heavy duty stapler',
      timeout: 8000,
    });

    const validResults = results.filter(r => r.price !== null);
    
    console.log(`\n📊 Results: ${validResults.length}/${results.length} providers returned prices\n`);

    expect(validResults.length).toBeGreaterThanOrEqual(1);

    // Sorted correctly
    for (let i = 0; i < validResults.length - 1; i++) {
      expect(validResults[i].price!).toBeLessThanOrEqual(validResults[i + 1].price!);
    }
  });

  it('should handle no results gracefully', async () => {
    const results = await aggregateProviders({
      keyword: 'xyz999nonexistent123',
      timeout: 5000,
    });

    expect(Array.isArray(results)).toBe(true);
    
    // All providers should return null prices for non-existent items
    const validResults = results.filter(r => r.price !== null);
    expect(validResults.length).toBe(0);
  });

  it('should handle empty keyword', async () => {
    const results = await aggregateProviders({
      keyword: '',
      timeout: 3000,
    });

    expect(Array.isArray(results)).toBe(true);
    
    // Empty keyword should return no prices
    const validResults = results.filter(r => r.price !== null);
    expect(validResults.length).toBe(0);
  });

  it('should execute providers in parallel (not sequential)', async () => {
    console.log('\n⏱️  Testing parallel execution...\n');
    
    const startTime = Date.now();
    await aggregateProviders({
      keyword: 'notebook',
      timeout: 5000,
    });
    const duration = Date.now() - startTime;

    console.log(`\n⚡ Parallel execution time: ${duration}ms\n`);

    // If providers ran sequentially, it would take 7 * 5000ms = 35 seconds
    // Parallel should complete in ~5-7 seconds (slowest provider + overhead)
    expect(duration).toBeLessThan(8000);
  });

  it('should return best price', async () => {
    const bestPrice = await getBestPrice('copy paper');

    if (bestPrice !== null) {
      expect(bestPrice).toHaveProperty('price');
      expect(bestPrice).toHaveProperty('retailer');
      expect(bestPrice.price).toBeGreaterThan(0);

      console.log(`\n🏆 Best price: $${bestPrice.price?.toFixed(2)} at ${bestPrice.retailer}\n`);
    }
  });

  it('should handle mixed success/failure from providers', async () => {
    // Some providers may fail, but aggregation should continue
    const results = await aggregateProviders({
      keyword: 'test product',
      timeout: 3000,
    });

    // Should not throw even if some providers fail
    expect(Array.isArray(results)).toBe(true);
    
    // Should have attempted all 7 providers
    // (Results may be empty if all fail, but array should exist)
  });

  it('should filter null prices correctly', async () => {
    const results = await aggregateProviders({
      keyword: 'printer ink',
      timeout: 6000,
    });

    // All returned results should have valid structure
    results.forEach(result => {
      expect(result.retailer).toBeDefined();
      expect(typeof result.retailer).toBe('string');
      
      // Price can be null, but if present, must be number
      if (result.price !== null) {
        expect(typeof result.price).toBe('number');
        expect(result.price).toBeGreaterThan(0);
      }
    });
  });

  it('should calculate performance metrics', async () => {
    console.log('\n📊 Performance Metrics Test\n');

    const tests = [
      { keyword: 'paper', expectedTime: 6000 },
      { keyword: 'pens', expectedTime: 6000 },
      { keyword: 'stapler', expectedTime: 6000 },
    ];

    const results = [];

    for (const test of tests) {
      const startTime = Date.now();
      const res = await aggregateProviders({
        keyword: test.keyword,
        timeout: 5000,
      });
      const duration = Date.now() - startTime;

      results.push({
        keyword: test.keyword,
        duration,
        providersReturned: res.filter(r => r.price !== null).length,
      });

      expect(duration).toBeLessThan(test.expectedTime);
    }

    console.log('\n  Performance Summary:');
    results.forEach(r => {
      console.log(`    "${r.keyword}": ${r.duration}ms (${r.providersReturned} providers)`);
    });
    console.log('');
  });
});

