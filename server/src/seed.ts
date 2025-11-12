/**
 * Database seeding script
 * Creates test user and example items
 * 
 * Run with: npm run seed
 */

import prisma from './lib/prisma';
// import { matchItemToRetailers } from './services/matchItem'; // Skipping for seed

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

  // Create 3 example items with all fields
  const item1 = await prisma.item.create({
    data: {
      userId: testUser.id,
      name: 'HP Printer Paper 500 Sheets',
      sku: 'HP-PAPER-500',
      category: 'Office Supplies',
      lastPaidPrice: 12.99,
      lastCheckedPrice: 11.49,
      vendorName: 'Office Depot',
      upc: '043875321890',
      prices: {
        create: [
          { 
            retailer: 'Amazon', 
            price: 12.99, 
            url: 'https://amazon.com/hp-printer-paper',
            date: new Date() 
          },
          { 
            retailer: 'Walmart', 
            price: 11.49, 
            url: 'https://walmart.com/hp-printer-paper',
            date: new Date() 
          },
        ],
      },
    },
  });

  const item2 = await prisma.item.create({
    data: {
      userId: testUser.id,
      name: 'Staples Heavy Duty Stapler',
      sku: 'STAPL-HD-001',
      category: 'Office Equipment',
      lastPaidPrice: 24.99,
      lastCheckedPrice: 22.50,
      vendorName: 'Staples Direct',
      upc: '087129043210',
      prices: {
        create: [
          { 
            retailer: 'Amazon', 
            price: 24.99,
            url: 'https://amazon.com/staples-stapler',
            date: new Date() 
          },
          { 
            retailer: 'Staples', 
            price: 22.50,
            url: 'https://staples.com/heavy-duty-stapler',
            date: new Date() 
          },
        ],
      },
    },
  });

  const item3 = await prisma.item.create({
    data: {
      userId: testUser.id,
      name: 'BIC Round Stic Pens 60-Pack',
      sku: 'BIC-PEN-60PK',
      category: 'Writing Supplies',
      lastPaidPrice: 8.49,
      lastCheckedPrice: 7.50,
      vendorName: 'Office Supply Co',
      upc: '070330322103',
      prices: {
        create: [
          { 
            retailer: 'Amazon', 
            price: 8.49,
            url: 'https://amazon.com/bic-pens-60pack',
            date: new Date() 
          },
          { 
            retailer: 'Target', 
            price: 7.99,
            url: 'https://target.com/bic-pens',
            date: new Date() 
          },
          { 
            retailer: 'Walmart', 
            price: 7.50,
            url: 'https://walmart.com/bic-round-stic-pens',
            date: new Date() 
          },
        ],
      },
    },
  });

  console.log('');
  console.log('✅ Created example items:');
  console.log(`   1. ${item1.name} - $${item1.lastPaidPrice} (SKU: ${item1.sku})`);
  console.log(`   2. ${item2.name} - $${item2.lastPaidPrice} (SKU: ${item2.sku})`);
  console.log(`   3. ${item3.name} - $${item3.lastPaidPrice} (SKU: ${item3.sku})`);
  
  // Create a sample alert for item3 (price drop)
  console.log('');
  console.log('🔔 Creating sample alert...');
  
  const alert = await prisma.alert.create({
    data: {
      userId: testUser.id,
      itemId: item3.id,
      retailer: 'Walmart',
      oldPrice: 8.49,
      newPrice: 7.50,
      priceDropAmount: 0.99,
      url: 'https://walmart.com/bic-round-stic-pens',
      savingsPerOrder: 0.99,
      estimatedMonthlySavings: 0.99,
      seen: false,
      viewed: false,
    },
  });
  
  console.log(`   ✓ Alert created: ${item3.name} price dropped $${alert.priceDropAmount.toFixed(2)}`);
  
  // Create savings summary
  console.log('');
  console.log('💰 Creating savings summary...');
  
  const savingsSummary = await prisma.savingsSummary.create({
    data: {
      userId: testUser.id,
      monthlyTotal: 2.48,  // Sum of potential monthly savings
      yearToDate: 29.76,   // 12 months of savings
    },
  });
  
  console.log(`   ✓ Savings summary: $${savingsSummary.monthlyTotal.toFixed(2)}/month, $${savingsSummary.yearToDate.toFixed(2)} YTD`);
  
  // Set matched retailers manually for demo data
  console.log('');
  console.log('🔗 Setting matched retailers...');
  
  await prisma.item.update({
    where: { id: item1.id },
    data: {
      matchedRetailer: 'Walmart',
      matchedUrl: 'https://walmart.com/hp-printer-paper',
      matchedPrice: 11.49,
    },
  });
  
  await prisma.item.update({
    where: { id: item2.id },
    data: {
      matchedRetailer: 'Staples',
      matchedUrl: 'https://staples.com/heavy-duty-stapler',
      matchedPrice: 22.50,
    },
  });
  
  await prisma.item.update({
    where: { id: item3.id },
    data: {
      matchedRetailer: 'Walmart',
      matchedUrl: 'https://walmart.com/bic-round-stic-pens',
      matchedPrice: 7.50,
    },
  });
  
  console.log(`   ✓ ${item1.name} → Walmart ($11.49)`);
  console.log(`   ✓ ${item2.name} → Staples ($22.50)`);
  console.log(`   ✓ ${item3.name} → Walmart ($7.50)`);
  
  console.log('');
  console.log('📊 Database seeded successfully!');
  console.log('');
  console.log('Summary:');
  console.log('   • 1 User (test@procuroapp.com)');
  console.log('   • 3 Items with vendors and prices');
  console.log('   • 7 Price records from different retailers');
  console.log('   • 1 Alert for price drop');
  console.log('   • 1 Savings summary record');
  console.log('');
  console.log('Next steps:');
  console.log('👉 Connect to QuickBooks: http://localhost:5000/api/qb/connect');
  console.log('👉 View items: http://localhost:5000/api/qb/items');
  console.log('👉 Open Prisma Studio: npx prisma studio');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });