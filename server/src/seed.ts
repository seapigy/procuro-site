/**
 * Database seeding script
 * Creates test user and example items
 * 
 * Run with: npm run seed
 */

import prisma from './lib/prisma';
import { matchItemToRetailers } from './services/matchItem';

async function main() {
  console.log('🌱 Starting database seed...');

  // Create or update test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@procuroapp.com' },
    update: {},
    create: {
      email: 'test@procuroapp.com',
      name: 'Test User',
    },
  });

  console.log('✅ Test user created/verified:', testUser.email);
  console.log('   User ID:', testUser.id);

  // Delete existing items for clean seed
  await prisma.item.deleteMany({
    where: { userId: testUser.id },
  });

  // Create 2-3 example items
  const item1 = await prisma.item.create({
    data: {
      userId: testUser.id,
      name: 'HP Printer Paper 500 Sheets',
      category: 'Office Supplies',
      lastPaidPrice: 12.99,
      upc: '043875321890',
      prices: {
        create: [
          { retailer: 'Amazon', price: 12.99, date: new Date() },
          { retailer: 'Walmart', price: 11.49, date: new Date() },
        ],
      },
    },
  });

  const item2 = await prisma.item.create({
    data: {
      userId: testUser.id,
      name: 'Staples Heavy Duty Stapler',
      category: 'Office Equipment',
      lastPaidPrice: 24.99,
      upc: '087129043210',
      prices: {
        create: [
          { retailer: 'Amazon', price: 24.99, date: new Date() },
          { retailer: 'Staples', price: 22.50, date: new Date() },
        ],
      },
    },
  });

  const item3 = await prisma.item.create({
    data: {
      userId: testUser.id,
      name: 'BIC Round Stic Pens 60-Pack',
      category: 'Writing Supplies',
      lastPaidPrice: 8.49,
      upc: '070330322103',
      prices: {
        create: [
          { retailer: 'Amazon', price: 8.49, date: new Date() },
          { retailer: 'Target', price: 7.99, date: new Date() },
          { retailer: 'Walmart', price: 7.50, date: new Date() },
        ],
      },
    },
  });

  console.log('');
  console.log('✅ Created example items:');
  console.log(`   1. ${item1.name} - $${item1.lastPaidPrice}`);
  console.log(`   2. ${item2.name} - $${item2.lastPaidPrice}`);
  console.log(`   3. ${item3.name} - $${item3.lastPaidPrice}`);
  
  // Match items to retailers
  console.log('');
  console.log('🔗 Matching items to retailers...');
  
  const items = [item1, item2, item3];
  for (const item of items) {
    const match = await matchItemToRetailers(item.name, item.lastPaidPrice);
    if (match) {
      await prisma.item.update({
        where: { id: item.id },
        data: {
          matchedRetailer: match.retailer,
          matchedUrl: match.url,
          matchedPrice: match.price,
        },
      });
      console.log(`   ✓ ${item.name} → ${match.retailer} ($${match.price.toFixed(2)})`);
    } else {
      console.log(`   ✗ ${item.name} → No match found`);
    }
  }
  
  console.log('');
  console.log('📊 Database seeded successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('👉 Connect to QuickBooks: http://localhost:5000/api/qb/connect');
  console.log('👉 View items: http://localhost:5000/api/qb/items');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });