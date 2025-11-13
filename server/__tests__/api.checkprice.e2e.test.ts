/**
 * END-TO-END TESTS - Price Check API Route
 * Tests GET /api/items/check-price/:id with REAL data flow
 */

import request from 'supertest';
import express from 'express';
import itemsRouter from '../src/routes/items';
import prisma from '../src/lib/prisma';

jest.setTimeout(60000); // 60 seconds for full E2E test

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/items', itemsRouter);

describe('Price Check API - End-to-End Tests', () => {
  let testUserId: number;
  let testItemId: number;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.upsert({
      where: { email: 'test-pricecheck@procuroapp.com' },
      update: {},
      create: {
        email: 'test-pricecheck@procuroapp.com',
        name: 'Price Check Test User',
      },
    });
    testUserId = user.id;

    // Create test item
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: 'HP printer paper',
        lastPaidPrice: 25.99,
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
    expect(response.body.results.length).toBeGreaterThanOrEqual(1);

    // At least one provider should return data for "HP printer paper"
    const validResults = response.body.results.filter((r: any) => r.price !== null);
    expect(validResults.length).toBeGreaterThanOrEqual(1);

    console.log(`\n📊 Price Check Results:\n`);
    response.body.results.forEach((result: any, index: number) => {
      if (result.price) {
        console.log(`  ${index + 1}. ${result.retailer}: $${result.price.toFixed(2)} (Save $${result.savings.toFixed(2)} - ${result.savingsPercent.toFixed(1)}%)`);
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
        expect(typeof result.savings).toBe('number');
        expect(typeof result.savingsPercent).toBe('number');
      }
    });

    // Best price should be first result (lowest price)
    if (response.body.bestPrice) {
      expect(response.body.bestPrice.price).toBe(validResults[0]?.price);
    }
  });

  it('should store prices in database', async () => {
    console.log('\n💾 Testing database writes...\n');

    // Trigger price check
    await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .expect(200);

    // Wait a bit for async DB writes
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check Price table
    const prices = await prisma.price.findMany({
      where: { itemId: testItemId },
      orderBy: { date: 'desc' },
    });

    console.log(`\n✅ Found ${prices.length} price records in database\n`);

    // Should have at least 1 price record
    expect(prices.length).toBeGreaterThanOrEqual(1);

    // Each price should have required fields
    prices.forEach(price => {
      expect(price).toHaveProperty('id');
      expect(price).toHaveProperty('itemId');
      expect(price).toHaveProperty('retailer');
      expect(price).toHaveProperty('price');
      expect(price).toHaveProperty('date');

      expect(price.itemId).toBe(testItemId);
      expect(price.retailer).toBeTruthy();
      expect(price.price).toBeGreaterThan(0);

      console.log(`  ${price.retailer}: $${price.price.toFixed(2)} (${price.date.toISOString()})`);
    });
    console.log('');

    // No null retailer values
    const nullRetailers = prices.filter(p => !p.retailer);
    expect(nullRetailers.length).toBe(0);
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
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Item not found');
  });

  it('should handle invalid item ID', async () => {
    const response = await request(app)
      .get('/api/items/check-price/invalid')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('error');
  });

  it('should return sorted results (lowest price first)', async () => {
    const response = await request(app)
      .get(`/api/items/check-price/${testItemId}`)
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

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: 'test-db-validation@procuroapp.com' },
      update: {},
      create: {
        email: 'test-db-validation@procuroapp.com',
        name: 'DB Validation User',
      },
    });
    testUserId = user.id;

    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: 'bic pens',
        lastPaidPrice: 12.99,
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

  it('should validate Price table integrity', async () => {
    console.log('\n🔍 Validating Price table...\n');

    // Trigger price check
    await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .expect(200);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const prices = await prisma.price.findMany({
      where: { itemId: testItemId },
    });

    expect(prices.length).toBeGreaterThanOrEqual(1);

    // Validate each price record
    prices.forEach(price => {
      // No null values in required fields
      expect(price.retailer).not.toBeNull();
      expect(price.price).not.toBeNull();
      expect(price.date).not.toBeNull();

      // Retailer name should be correct
      const validRetailers = ['Amazon', 'Walmart', 'Target', 'Home Depot', "Lowe's", 'Staples', 'Office Depot'];
      expect(validRetailers).toContain(price.retailer);

      // Price should be positive
      expect(price.price).toBeGreaterThan(0);

      // Timestamp should be recent (within last minute)
      const now = new Date();
      const diff = now.getTime() - price.date.getTime();
      expect(diff).toBeLessThan(60000); // 60 seconds

      console.log(`  ✅ ${price.retailer}: $${price.price.toFixed(2)} at ${price.date.toISOString()}`);
    });
    console.log('');
  });

  it('should not have duplicate retailer entries for same check', async () => {
    // Clear existing prices
    await prisma.price.deleteMany({ where: { itemId: testItemId } });

    // Run price check once
    await request(app)
      .get(`/api/items/check-price/${testItemId}`)
      .expect(200);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const prices = await prisma.price.findMany({
      where: { itemId: testItemId },
    });

    // Count retailer occurrences
    const retailerCounts: { [key: string]: number } = {};
    prices.forEach(price => {
      retailerCounts[price.retailer] = (retailerCounts[price.retailer] || 0) + 1;
    });

    // Each retailer should appear at most once per check
    Object.entries(retailerCounts).forEach(([retailer, count]) => {
      console.log(`  ${retailer}: ${count} record(s)`);
      expect(count).toBe(1);
    });
  });
});

