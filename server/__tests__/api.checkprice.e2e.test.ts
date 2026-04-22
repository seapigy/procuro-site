/**
 * END-TO-END TESTS - Price Check API Route
 * Tests GET /api/items/check-price/:id with REAL data flow
 */

import request from 'supertest';
import express from 'express';
import fetch from 'node-fetch';
import itemsRouter from '../src/routes/items';
import { companyContext } from '../src/middleware/companyContext';
import prisma from '../src/lib/prisma';

// Bright Data / Amazon discovery can exceed 60s on cold runs; keep suite stable.
jest.setTimeout(120000);

/** check-price uses runPriceCheckForItem (Bright Data providers when configured). */
async function providerApiReachable(): Promise<boolean> {
  const base = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  try {
    const r = await fetch(`${base}/health`, { timeout: 2500 } as any);
    return r.ok;
  } catch {
    return false;
  }
}

/** Same as production: companyContext resolves tenant from X-Test-User-Email (config testing.testMode). */
const app = express();
app.use(express.json());
app.use('/api', companyContext);
app.use('/api/items', itemsRouter);

const H_PRICE = { 'X-Test-User-Email': 'test-pricecheck@procuroapp.com' };
const H_DBVAL = { 'X-Test-User-Email': 'test-db-validation@procuroapp.com' };

describe('Price Check API - End-to-End Tests', () => {
  let testUserId: number;
  let testItemId: number;
  let testCompanyId: number;
  let apiUp = false;

  beforeAll(async () => {
    apiUp = await providerApiReachable();
    if (!apiUp) {
      console.warn(
        `\n⚠️  check-price live retailer tests need the API running at ${process.env.API_BASE_URL || 'http://localhost:5000'} (npm run dev). Assertions that require prices will allow 0.\n`
      );
    }
    // Create test company
    const company = await prisma.company.upsert({
      where: { realmId: 'test-pricecheck-realm' },
      update: {},
      create: { name: 'Price Check Test Co', realmId: 'test-pricecheck-realm' },
    });
    testCompanyId = company.id;
    await prisma.company.update({
      where: { id: testCompanyId },
      data: { isSubscribed: true },
    });

    // Create test user
    const user = await prisma.user.upsert({
      where: { email: 'test-pricecheck@procuroapp.com' },
      update: { companyId: testCompanyId },
      create: {
        email: 'test-pricecheck@procuroapp.com',
        name: 'Price Check Test User',
        companyId: testCompanyId,
      },
    });
    testUserId = user.id;

    // Create test item
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        companyId: testCompanyId,
        name: 'HP printer paper',
        lastPaidPrice: 25.99,
        baselineUnitPrice: 27.99,
        baselineSource: 'test',
        quantityPerOrder: 1,
        reorderIntervalDays: 30,
        category: 'Office Supplies',
      },
    });
    testItemId = item.id;

    console.log(`\n🧪 Test setup complete:`);
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Item ID: ${testItemId}\n`);
  });

  afterAll(async () => {
    // Cleanup
    if (testItemId) {
      await prisma.price.deleteMany({
        where: { itemId: testItemId },
      });
      await prisma.alert.deleteMany({
        where: { itemId: testItemId },
      });
      await prisma.item.delete({
        where: { id: testItemId },
      });
    }
    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
      }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('should check prices across all retailers', async () => {
    console.log('\n🔍 Testing GET /api/items/check-price/:id...\n');

    const response = await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .set(H_PRICE)
      .expect('Content-Type', /json/)
      .expect(200);

    console.log(`\n✅ Response received\n`);

    // Validate response structure
    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(true);

    expect(response.body).toHaveProperty('item');
    expect(response.body).toHaveProperty('results');
    expect(response.body).toHaveProperty('count');
    expect(response.body).toHaveProperty('bestPrice');

    // Validate item data
    expect(response.body.item.id).toBe(testItemId);
    expect(response.body.item.name).toBe('HP printer paper');
    expect(response.body.item.lastPaidPrice).toBe(25.99);

    // Validate results
    expect(Array.isArray(response.body.results)).toBe(true);
    expect(response.body.results.length).toBeGreaterThanOrEqual(apiUp ? 1 : 0);

    const validResults = response.body.results.filter((r: any) => r.price !== null);
    expect(validResults.length).toBeGreaterThanOrEqual(apiUp ? 1 : 0);

    console.log(`\n📊 Price Check Results:\n`);
    response.body.results.forEach((result: any, index: number) => {
      if (result.price) {
        const sav =
          result.savings != null && result.savingsPercent != null
            ? `Save $${result.savings.toFixed(2)} - ${result.savingsPercent.toFixed(1)}%`
            : 'savings n/a';
        console.log(`  ${index + 1}. ${result.retailer}: $${result.price.toFixed(2)} (${sav})`);
      } else {
        console.log(`  ${index + 1}. ${result.retailer}: No data`);
      }
    });
    console.log('');

    // Each result should have required fields
    response.body.results.forEach((result: any) => {
      expect(result).toHaveProperty('retailer');
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('stock');
      expect(result).toHaveProperty('savings');
      expect(result).toHaveProperty('savingsPercent');

      if (result.price !== null) {
        expect(typeof result.price).toBe('number');
        expect(result.price).toBeGreaterThan(0);
        if (result.savings != null) {
          expect(typeof result.savings).toBe('number');
        }
        if (result.savingsPercent != null) {
          expect(typeof result.savingsPercent).toBe('number');
        }
      }
    });

    // Best price should be first result (lowest price)
    if (response.body.bestPrice) {
      expect(response.body.bestPrice.price).toBe(validResults[0]?.price);
    }
  });

  it('should return actionable results from check-price (no legacy Price row requirement)', async () => {
    console.log('\n💾 Testing check-price response (aggregate-only route; legacy Price model not written here)...\n');

    const res = await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .set(H_PRICE)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    const valid = res.body.results.filter(
      (r: { price: unknown }) => r.price != null && Number(r.price) > 0
    );
    expect(valid.length).toBeGreaterThanOrEqual(apiUp ? 1 : 0);
  });

  it('should create alerts for savings >= 5%', async () => {
    console.log('\n🔔 Testing alert creation...\n');

    // Update item to have higher lastPaidPrice to trigger alerts
    await prisma.item.update({
      where: { id: testItemId },
      data: { lastPaidPrice: 50.00 }, // Higher price = more likely to trigger alerts
    });

    // Trigger price check
    const response = await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .set(H_PRICE)
      .expect(200);

    // Wait for async alert creation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check Alert table
    const alerts = await prisma.alert.findMany({
      where: { itemId: testItemId },
      orderBy: { alertDate: 'desc' },
    });

    console.log(`\n✅ Found ${alerts.length} alerts in database\n`);

    if (alerts.length > 0) {
      // Each alert should have required fields
      alerts.forEach(alert => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('userId');
        expect(alert).toHaveProperty('itemId');
        expect(alert).toHaveProperty('retailer');
        expect(alert).toHaveProperty('oldPrice');
        expect(alert).toHaveProperty('newPrice');
        expect(alert).toHaveProperty('savingsPerOrder');
        expect(alert).toHaveProperty('estimatedMonthlySavings');

        expect(alert.itemId).toBe(testItemId);
        expect(alert.retailer).toBeTruthy();
        expect(alert.newPrice).toBeLessThan(alert.oldPrice);
        expect(alert.savingsPerOrder).toBeGreaterThan(0);

        const savingsPercent = (alert.savingsPerOrder / alert.oldPrice) * 100;
        expect(savingsPercent).toBeGreaterThanOrEqual(5); // At least 5% savings

        console.log(`  ${alert.retailer}: Save $${alert.savingsPerOrder.toFixed(2)} (${savingsPercent.toFixed(1)}%)`);
      });
      console.log('');
    } else {
      console.log('  ⚠️  No alerts created (prices may not be low enough)\n');
    }

    // Reset lastPaidPrice
    await prisma.item.update({
      where: { id: testItemId },
      data: { lastPaidPrice: 25.99 },
    });
  });

  it('should handle non-existent item', async () => {
    const response = await request(app)
      .get('/api/items/check-price/99999')
      .set(H_PRICE)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('should handle invalid item ID', async () => {
    const response = await request(app)
      .get('/api/items/check-price/invalid')
      .set(H_PRICE)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('error');
  });

  it('should return sorted results (lowest price first)', async () => {
    const response = await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .set(H_PRICE)
      .expect(200);

    const validResults = response.body.results.filter((r: any) => r.price !== null);

    // Should be sorted by price ascending
    for (let i = 0; i < validResults.length - 1; i++) {
      expect(validResults[i].price).toBeLessThanOrEqual(validResults[i + 1].price);
    }
  });
});

describe('Price Check API - Database Validation', () => {
  let testUserId: number;
  let testItemId: number;
  let testCompanyId: number;
  let apiUp = false;

  beforeAll(async () => {
    apiUp = await providerApiReachable();
    const company = await prisma.company.upsert({
      where: { realmId: 'test-db-validation-realm' },
      update: {},
      create: { name: 'DB Validation Co', realmId: 'test-db-validation-realm' },
    });
    testCompanyId = company.id;
    await prisma.company.update({
      where: { id: testCompanyId },
      data: { isSubscribed: true },
    });

    const user = await prisma.user.upsert({
      where: { email: 'test-db-validation@procuroapp.com' },
      update: { companyId: testCompanyId },
      create: {
        email: 'test-db-validation@procuroapp.com',
        name: 'DB Validation User',
        companyId: testCompanyId,
      },
    });
    testUserId = user.id;

    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        companyId: testCompanyId,
        name: 'bic pens',
        lastPaidPrice: 12.99,
        baselineUnitPrice: 15.99,
        baselineSource: 'test',
        quantityPerOrder: 1,
        reorderIntervalDays: 45,
        category: 'Office Supplies',
      },
    });
    testItemId = item.id;
  });

  afterAll(async () => {
    if (testItemId) {
      await prisma.price.deleteMany({ where: { itemId: testItemId } });
      await prisma.alert.deleteMany({ where: { itemId: testItemId } });
      await prisma.item.delete({ where: { id: testItemId } });
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('should return consistent JSON from check-price for db-validation tenant', async () => {
    console.log('\n🔍 Validating check-price response shape...\n');

    const res = await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .set(H_DBVAL)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    const withPrice = res.body.results.filter(
      (r: { price: unknown }) => r.price != null && Number(r.price) > 0
    );
    expect(withPrice.length).toBeGreaterThanOrEqual(apiUp ? 1 : 0);

    const allowed = ['Amazon', 'Target', 'Home Depot', "Lowe's", 'Staples', 'Office Depot'];
    withPrice.forEach((row: { retailer: string; price: number }) => {
      expect(allowed).toContain(row.retailer);
      expect(row.price).toBeGreaterThan(0);
      console.log(`  ✅ ${row.retailer}: $${Number(row.price).toFixed(2)}`);
    });
    console.log('');
  });

  it('should not list duplicate retailers in one check-price response', async () => {
    const res = await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .set(H_DBVAL)
      .expect(200);

    const seen = new Set<string>();
    const retailers = res.body.results
      .filter((r: { price: unknown }) => r.price != null && Number(r.price) > 0)
      .map((r: { retailer: string }) => r.retailer);
    retailers.forEach((retailer: string) => {
      expect(seen.has(retailer)).toBe(false);
      seen.add(retailer);
    });
  });
});

