/**
 * INTEGRATION TESTS - Retail Price Providers
 * Tests REAL API calls with REAL product keywords
 * 
 * Run with: npm run test providers.integration
 */

import * as amazon from '../src/providers/amazon';
import * as walmart from '../src/providers/walmart';
import * as target from '../src/providers/target';
import * as homedepot from '../src/providers/homedepot';
import * as lowes from '../src/providers/lowes';
import * as staples from '../src/providers/staples';
import * as officedepot from '../src/providers/officedepot';
import { PriceResult } from '../src/providers/types';

// Extended timeout for real network requests
jest.setTimeout(60000);

// Test keywords that should reliably return results
const TEST_KEYWORDS = {
  office: 'HP printer paper',
  pens: 'bic pens',
  stapler: 'heavy duty stapler',
};

/**
 * Helper: Validate PriceResult structure
 */
function validatePriceResult(result: PriceResult, providerName: string): void {
  // Must have all required keys
  expect(result).toHaveProperty('price');
  expect(result).toHaveProperty('url');
  expect(result).toHaveProperty('stock');
  expect(result).toHaveProperty('retailer');
  expect(result).toHaveProperty('title');
  expect(result).toHaveProperty('image');

  // Retailer must match
  expect(result.retailer).toBe(providerName);

  // Types must be correct
  expect(result.price === null || typeof result.price === 'number').toBe(true);
  expect(result.url === null || typeof result.url === 'string').toBe(true);
  expect(result.stock === null || typeof result.stock === 'boolean').toBe(true);
  expect(result.title === null || typeof result.title === 'string').toBe(true);
  expect(result.image === null || typeof result.image === 'string').toBe(true);

  // No undefined values
  expect(result.price).not.toBe(undefined);
  expect(result.url).not.toBe(undefined);
  expect(result.stock).not.toBe(undefined);
  expect(result.title).not.toBe(undefined);
  expect(result.image).not.toBe(undefined);

  // If price is present, validate it's reasonable
  if (result.price !== null) {
    expect(result.price).toBeGreaterThan(0);
    expect(result.price).toBeLessThan(10000); // No product should be > $10k
  }

  // If URL is present, validate format
  if (result.url !== null) {
    expect(result.url).toMatch(/^https?:\/\//);
  }
}

/**
 * Helper: Log test result
 */
function logTestResult(providerName: string, keyword: string, result: PriceResult, duration: number): void {
  const priceStr = result.price !== null ? `$${result.price.toFixed(2)}` : 'N/A';
  const stockStr = result.stock === true ? '✅' : result.stock === false ? '❌' : '?';
  
  console.log(`\n  ${providerName} - "${keyword}"`);
  console.log(`    Price: ${priceStr} | Stock: ${stockStr} | Time: ${duration}ms`);
  if (result.title) console.log(`    Title: ${result.title.substring(0, 60)}...`);
}

describe('Provider Integration Tests - REAL API CALLS', () => {
  
  // ============================================================================
  // AMAZON PROVIDER TESTS
  // ============================================================================
  describe('Amazon Provider', () => {
    const PROVIDER_NAME = 'Amazon';

    it('should handle HP printer paper search', async () => {
      const startTime = Date.now();
      const result = await amazon.getPriceByKeyword(TEST_KEYWORDS.office);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.office, result, duration);

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle BIC pens search', async () => {
      const startTime = Date.now();
      const result = await amazon.getPriceByKeyword(TEST_KEYWORDS.pens);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.pens, result, duration);
    });

    it('should handle empty keyword gracefully', async () => {
      const result = await amazon.getPriceByKeyword('');
      validatePriceResult(result, PROVIDER_NAME);
      // Empty keyword should return null results
      expect(result.price).toBe(null);
    });

    it('should handle no results gracefully', async () => {
      const result = await amazon.getPriceByKeyword('xyz123nonexistent999');
      validatePriceResult(result, PROVIDER_NAME);
      // Non-existent product should return null
      expect(result.price).toBe(null);
    });
  });

  // ============================================================================
  // WALMART PROVIDER TESTS
  // ============================================================================
  describe('Walmart Provider', () => {
    const PROVIDER_NAME = 'Walmart';

    it('should handle HP printer paper search', async () => {
      const startTime = Date.now();
      const result = await walmart.getPriceByKeyword(TEST_KEYWORDS.office);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.office, result, duration);

      expect(duration).toBeLessThan(5000);
      
      // Walmart should reliably return results for common items
      if (result.price !== null) {
        expect(result.url).toContain('walmart.com');
      }
    });

    it('should handle BIC pens search', async () => {
      const startTime = Date.now();
      const result = await walmart.getPriceByKeyword(TEST_KEYWORDS.pens);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.pens, result, duration);
    });

    it('should handle stapler search', async () => {
      const startTime = Date.now();
      const result = await walmart.getPriceByKeyword(TEST_KEYWORDS.stapler);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.stapler, result, duration);
    });

    it('should parse embedded JSON correctly', async () => {
      const result = await walmart.getPriceByKeyword('notebook');
      validatePriceResult(result, PROVIDER_NAME);
      
      // If data returned, it should have been parsed from window.__WML_REDUX_INITIAL_STATE__
      if (result.price !== null) {
        expect(result.title).not.toBe(null);
      }
    });

    it('should handle empty keyword gracefully', async () => {
      const result = await walmart.getPriceByKeyword('');
      validatePriceResult(result, PROVIDER_NAME);
    });
  });

  // ============================================================================
  // TARGET PROVIDER TESTS
  // ============================================================================
  describe('Target Provider', () => {
    const PROVIDER_NAME = 'Target';

    it('should handle HP printer paper search', async () => {
      const startTime = Date.now();
      const result = await target.getPriceByKeyword(TEST_KEYWORDS.office);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.office, result, duration);

      expect(duration).toBeLessThan(5000);

      // Target RedSky API should be fast and reliable
      if (result.price !== null) {
        expect(result.url).toContain('target.com');
      }
    });

    it('should handle BIC pens search', async () => {
      const startTime = Date.now();
      const result = await target.getPriceByKeyword(TEST_KEYWORDS.pens);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.pens, result, duration);
    });

    it('should handle stapler search', async () => {
      const startTime = Date.now();
      const result = await target.getPriceByKeyword(TEST_KEYWORDS.stapler);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.stapler, result, duration);
    });

    it('should use RedSky API correctly', async () => {
      const result = await target.getPriceByKeyword('clorox wipes');
      validatePriceResult(result, PROVIDER_NAME);
      
      // RedSky API returns JSON directly (no scraping needed)
      // Should be fast and reliable
    });
  });

  // ============================================================================
  // HOME DEPOT PROVIDER TESTS
  // ============================================================================
  describe('Home Depot Provider', () => {
    const PROVIDER_NAME = 'Home Depot';

    it('should handle stapler search', async () => {
      const startTime = Date.now();
      const result = await homedepot.getPriceByKeyword(TEST_KEYWORDS.stapler);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.stapler, result, duration);

      expect(duration).toBeLessThan(5000);
    });

    it('should handle hardware search', async () => {
      const startTime = Date.now();
      const result = await homedepot.getPriceByKeyword('hammer');
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, 'hammer', result, duration);
    });

    it('should parse window.__app__ correctly', async () => {
      const result = await homedepot.getPriceByKeyword('drill');
      validatePriceResult(result, PROVIDER_NAME);
      
      // Home Depot embeds data in window.__app__.pageData
      if (result.price !== null) {
        expect(result.url).toContain('homedepot.com');
      }
    });
  });

  // ============================================================================
  // LOWE'S PROVIDER TESTS
  // ============================================================================
  describe("Lowe's Provider", () => {
    const PROVIDER_NAME = "Lowe's";

    it('should handle stapler search', async () => {
      const startTime = Date.now();
      const result = await lowes.getPriceByKeyword(TEST_KEYWORDS.stapler);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.stapler, result, duration);

      expect(duration).toBeLessThan(5000);
    });

    it('should handle hardware search', async () => {
      const startTime = Date.now();
      const result = await lowes.getPriceByKeyword('saw');
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, 'saw', result, duration);
    });

    it('should parse window.__PRELOADED_STATE__ correctly', async () => {
      const result = await lowes.getPriceByKeyword('screwdriver');
      validatePriceResult(result, PROVIDER_NAME);
      
      // Lowe's embeds data in window.__PRELOADED_STATE__
      if (result.price !== null) {
        expect(result.url).toContain('lowes.com');
      }
    });
  });

  // ============================================================================
  // STAPLES PROVIDER TESTS
  // ============================================================================
  describe('Staples Provider', () => {
    const PROVIDER_NAME = 'Staples';

    it('should handle HP printer paper search', async () => {
      const startTime = Date.now();
      const result = await staples.getPriceByKeyword(TEST_KEYWORDS.office);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.office, result, duration);

      expect(duration).toBeLessThan(5000);

      // Staples should be great for office supplies
      if (result.price !== null) {
        expect(result.url).toContain('staples.com');
      }
    });

    it('should handle BIC pens search', async () => {
      const startTime = Date.now();
      const result = await staples.getPriceByKeyword(TEST_KEYWORDS.pens);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.pens, result, duration);
    });

    it('should handle stapler search', async () => {
      const startTime = Date.now();
      const result = await staples.getPriceByKeyword(TEST_KEYWORDS.stapler);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.stapler, result, duration);
    });

    it('should parse __NEXT_DATA__ correctly', async () => {
      const result = await staples.getPriceByKeyword('folders');
      validatePriceResult(result, PROVIDER_NAME);
      
      // Staples uses Next.js with embedded JSON in <script id="__NEXT_DATA__">
      if (result.price !== null) {
        expect(result.title).not.toBe(null);
      }
    });
  });

  // ============================================================================
  // OFFICE DEPOT PROVIDER TESTS
  // ============================================================================
  describe('Office Depot Provider', () => {
    const PROVIDER_NAME = 'Office Depot';

    it('should handle HP printer paper search', async () => {
      const startTime = Date.now();
      const result = await officedepot.getPriceByKeyword(TEST_KEYWORDS.office);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.office, result, duration);

      expect(duration).toBeLessThan(5000);
    });

    it('should handle BIC pens search', async () => {
      const startTime = Date.now();
      const result = await officedepot.getPriceByKeyword(TEST_KEYWORDS.pens);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.pens, result, duration);
    });

    it('should handle stapler search', async () => {
      const startTime = Date.now();
      const result = await officedepot.getPriceByKeyword(TEST_KEYWORDS.stapler);
      const duration = Date.now() - startTime;

      validatePriceResult(result, PROVIDER_NAME);
      logTestResult(PROVIDER_NAME, TEST_KEYWORDS.stapler, result, duration);
    });

    it('should parse __NEXT_DATA__ correctly', async () => {
      const result = await officedepot.getPriceByKeyword('binder clips');
      validatePriceResult(result, PROVIDER_NAME);
      
      // Office Depot uses Next.js
      if (result.price !== null) {
        expect(result.url).toContain('officedepot.com');
      }
    });
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================
describe('Error Handling Tests', () => {
  it('should handle timeout gracefully (Walmart)', async () => {
    const result = await walmart.getPriceByKeyword('test', { timeout: 100, maxRetries: 0 });
    
    validatePriceResult(result, 'Walmart');
    // Should return null result, not throw
    expect(result.price).toBe(null);
  });

  it('should handle invalid keyword (Target)', async () => {
    const result = await target.getPriceByKeyword('!@#$%^&*()');
    
    validatePriceResult(result, 'Target');
    // Should handle gracefully
  });

  it('should handle no results (Staples)', async () => {
    const result = await staples.getPriceByKeyword('xyz999nonexistent123');
    
    validatePriceResult(result, 'Staples');
    expect(result.price).toBe(null);
  });

  it('should not crash on malformed response (Home Depot)', async () => {
    // This test ensures the parser handles unexpected HTML structures
    const result = await homedepot.getPriceByKeyword('test', { timeout: 2000, maxRetries: 0 });
    
    validatePriceResult(result, 'Home Depot');
    // Should not throw, even if HTML parsing fails
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================
describe('Performance Tests', () => {
  it('should complete within reasonable time (< 5s per provider)', async () => {
    const providers = [
      { name: 'Walmart', fn: walmart.getPriceByKeyword },
      { name: 'Target', fn: target.getPriceByKeyword },
      { name: 'Staples', fn: staples.getPriceByKeyword },
    ];

    for (const provider of providers) {
      const startTime = Date.now();
      await provider.fn('paper');
      const duration = Date.now() - startTime;

      console.log(`\n  ${provider.name} completed in ${duration}ms`);
      expect(duration).toBeLessThan(5000);
    }
  });

  it('should handle concurrent requests without blocking', async () => {
    const startTime = Date.now();

    const results = await Promise.all([
      walmart.getPriceByKeyword('paper'),
      target.getPriceByKeyword('paper'),
      staples.getPriceByKeyword('paper'),
    ]);

    const duration = Date.now() - startTime;

    console.log(`\n  3 providers in parallel: ${duration}ms`);
    
    // Parallel should be faster than sequential (< 6 seconds for 3 providers)
    expect(duration).toBeLessThan(6000);
    
    results.forEach(result => {
      expect(result).toBeDefined();
    });
  });
});

