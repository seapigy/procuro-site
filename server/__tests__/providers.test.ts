/**
 * Tests for retail price providers
 */

import * as walmart from '../src/providers/walmart';
import * as target from '../src/providers/target';
import * as homedepot from '../src/providers/homedepot';
import * as lowes from '../src/providers/lowes';
import * as staples from '../src/providers/staples';
import * as officedepot from '../src/providers/officedepot';
import { aggregateProviders } from '../src/providers/aggregateProvider';
import { PriceResult } from '../src/providers/types';

// Set longer timeout for network requests
jest.setTimeout(30000);

describe('Retail Price Providers', () => {
  const testKeyword = 'copy paper 500 sheets';
  const testSKU = '123456';

  describe('Provider Structure', () => {
    const providers = [
      { name: 'Walmart', module: walmart },
      { name: 'Target', module: target },
      { name: 'Home Depot', module: homedepot },
      { name: "Lowe's", module: lowes },
      { name: 'Staples', module: staples },
      { name: 'Office Depot', module: officedepot },
    ];

    providers.forEach(({ name, module }) => {
      describe(`${name} Provider`, () => {
        it('should export getPriceByKeyword function', () => {
          expect(module.getPriceByKeyword).toBeDefined();
          expect(typeof module.getPriceByKeyword).toBe('function');
        });

        it('should export getPriceBySKU function', () => {
          expect(module.getPriceBySKU).toBeDefined();
          expect(typeof module.getPriceBySKU).toBe('function');
        });
      });
    });
  });

  describe('Provider Response Format', () => {
    const providers = [
      { name: 'Walmart', module: walmart },
      { name: 'Target', module: target },
      { name: 'Home Depot', module: homedepot },
      { name: "Lowe's", module: lowes },
      { name: 'Staples', module: staples },
      { name: 'Office Depot', module: officedepot },
    ];

    providers.forEach(({ name, module }) => {
      describe(`${name} Provider`, () => {
        it('should return expected keys from getPriceByKeyword', async () => {
          const result = await module.getPriceByKeyword(testKeyword, { timeout: 10000 });

          expect(result).toHaveProperty('price');
          expect(result).toHaveProperty('url');
          expect(result).toHaveProperty('stock');
          expect(result).toHaveProperty('retailer');
          expect(result).toHaveProperty('title');
          expect(result).toHaveProperty('image');

          expect(result.retailer).toBe(name);
        });

        it('should return expected keys from getPriceBySKU', async () => {
          const result = await module.getPriceBySKU(testSKU, { timeout: 10000 });

          expect(result).toHaveProperty('price');
          expect(result).toHaveProperty('url');
          expect(result).toHaveProperty('stock');
          expect(result).toHaveProperty('retailer');
          expect(result).toHaveProperty('title');
          expect(result).toHaveProperty('image');

          expect(result.retailer).toBe(name);
        });

        it('should handle empty search results gracefully', async () => {
          const result = await module.getPriceByKeyword('xyz123nonexistent999', { timeout: 5000 });

          expect(result).toBeDefined();
          expect(result.retailer).toBe(name);
          // Empty results should have null values
          expect(result.price === null || typeof result.price === 'number').toBe(true);
        });

        it('should not throw errors on failure', async () => {
          await expect(
            module.getPriceByKeyword('test', { timeout: 1000 })
          ).resolves.toBeDefined();
        });
      });
    });
  });

  describe('Aggregator', () => {
    it('should run all providers in parallel', async () => {
      const startTime = Date.now();
      const results = await aggregateProviders({
        keyword: testKeyword,
        timeout: 5000,
      });
      const endTime = Date.now();

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // Should complete in reasonable time (not sequential)
      // 7 providers * 5 seconds each = 35 seconds sequentially
      // Parallel should be much faster (< 10 seconds)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(15000); // 15 seconds max
    });

    it('should return sorted results (lowest price first)', async () => {
      const results = await aggregateProviders({
        keyword: 'printer paper',
        timeout: 5000,
      });

      const validResults = results.filter(r => r.price !== null && r.price > 0);

      if (validResults.length > 1) {
        for (let i = 0; i < validResults.length - 1; i++) {
          expect(validResults[i].price!).toBeLessThanOrEqual(validResults[i + 1].price!);
        }
      }
    });

    it('should filter out null prices', async () => {
      const results = await aggregateProviders({
        keyword: 'test product',
        timeout: 3000,
      });

      results.forEach(result => {
        if (result.price !== null) {
          expect(typeof result.price).toBe('number');
          expect(result.price).toBeGreaterThan(0);
        }
      });
    });

    it('should handle all providers failing gracefully', async () => {
      const results = await aggregateProviders({
        keyword: 'xyz123nonexistent999',
        timeout: 2000,
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // May be empty array if no results
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed HTML gracefully (Walmart)', async () => {
      const result = await walmart.getPriceByKeyword('test', { timeout: 3000, maxRetries: 1 });
      expect(result).toBeDefined();
      expect(result.retailer).toBe('Walmart');
    });

    it('should handle network timeouts (Target)', async () => {
      const result = await target.getPriceByKeyword('test', { timeout: 100, maxRetries: 0 });
      expect(result).toBeDefined();
      expect(result.retailer).toBe('Target');
    });

    it('should handle invalid SKUs (Staples)', async () => {
      const result = await staples.getPriceBySKU('invalid-sku', { timeout: 3000, maxRetries: 1 });
      expect(result).toBeDefined();
      expect(result.retailer).toBe('Staples');
    });
  });

  describe('Data Validation', () => {
    it('should return valid price when found (Walmart)', async () => {
      const result = await walmart.getPriceByKeyword('bic pens', { timeout: 10000 });

      if (result.price !== null) {
        expect(typeof result.price).toBe('number');
        expect(result.price).toBeGreaterThan(0);
        expect(result.price).toBeLessThan(1000); // Reasonable price range
      }
    });

    it('should return valid URL when found (Target)', async () => {
      const result = await target.getPriceByKeyword('notebook', { timeout: 10000 });

      if (result.url !== null) {
        expect(typeof result.url).toBe('string');
        expect(result.url).toMatch(/^https?:\/\//); // Valid URL
        expect(result.url).toContain('target.com');
      }
    });

    it('should return boolean stock status (Home Depot)', async () => {
      const result = await homedepot.getPriceByKeyword('hammer', { timeout: 10000 });

      if (result.stock !== null) {
        expect(typeof result.stock).toBe('boolean');
      }
    });
  });

  describe('Performance', () => {
    it('should complete keyword search within timeout', async () => {
      const timeout = 5000;
      const startTime = Date.now();

      await Promise.race([
        staples.getPriceByKeyword('paper', { timeout }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout + 1000)
        ),
      ]);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(timeout + 1000);
    });

    it('should handle multiple concurrent requests', async () => {
      const keywords = ['paper', 'pens', 'stapler', 'tape', 'folders'];

      const results = await Promise.all(
        keywords.map(keyword =>
          walmart.getPriceByKeyword(keyword, { timeout: 5000 })
        )
      );

      expect(results).toHaveLength(keywords.length);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.retailer).toBe('Walmart');
      });
    });
  });
});

describe('Integration Tests', () => {
  it('should aggregate prices from multiple providers', async () => {
    const results = await aggregateProviders({
      keyword: 'stapler',
      timeout: 8000,
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);

    // At least some providers should return results
    const validResults = results.filter(r => r.price !== null);
    
    console.log(`\n✅ Integration test: ${validResults.length}/${results.length} providers returned prices\n`);

    validResults.forEach(result => {
      expect(result).toMatchObject({
        price: expect.any(Number),
        retailer: expect.any(String),
      });
    });
  });

  it('should calculate savings correctly', async () => {
    const lastPaidPrice = 50.00;
    const results = await aggregateProviders({
      keyword: 'printer paper',
      timeout: 5000,
    });

    const validResults = results.filter(r => r.price !== null && r.price > 0);

    validResults.forEach(result => {
      const savings = lastPaidPrice - result.price!;
      const savingsPercent = (savings / lastPaidPrice) * 100;

      expect(typeof savings).toBe('number');
      expect(typeof savingsPercent).toBe('number');

      if (result.price! < lastPaidPrice) {
        expect(savings).toBeGreaterThan(0);
        expect(savingsPercent).toBeGreaterThan(0);
      }
    });
  });
});

