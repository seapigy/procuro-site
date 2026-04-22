/**
 * Database seeding script
 * Creates test user and example items
 *
 * Run with: npm run seed (from server directory, so it uses server/.env and writes to Supabase)
 */

import dotenv from 'dotenv';
import path from 'path';

// Load server/.env so DATABASE_URL points to Supabase (same as when you run the server)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import prisma from './lib/prisma';
import { isVagueName, needsClarification } from './services/matchItem';
// import { matchItemToRetailers } from './services/matchItem'; // Skipping for seed (using manual data)

async function main() {
  console.log('🌱 Starting database seed...');

  // Create or update test company
  const testCompany = await prisma.company.upsert({
    where: { realmId: 'test-realm-123' },
    update: {},
    create: {
      realmId: 'test-realm-123',
      name: 'Test Company Inc.',
    },
  });

  console.log('✅ Test company created/verified:', testCompany.name);
  console.log('   Company ID:', testCompany.id);
  console.log('   Realm ID:', testCompany.realmId);

  // Create or update test user and link to company
  const testUser = await prisma.user.upsert({
    where: { email: 'test@procuroapp.com' },
    update: {
      companyId: testCompany.id,
    },
    create: {
      email: 'test@procuroapp.com',
      name: 'Test User',
      companyId: testCompany.id,
    },
  });

  console.log('');
  console.log('✅ Test user created/verified:', testUser.email);
  console.log('   User ID:', testUser.id);
  console.log('   Company ID:', testUser.companyId);

  // Delete existing items for clean seed
  await prisma.item.deleteMany({
    where: { userId: testUser.id },
  });

  // Create a mix of GOOD and VAGUE items for testing
  // Item 1: GOOD - Specific name with brand, size, model
  const item1 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'HP Printer Paper 500 Sheets',
      sku: 'HP-PAPER-500',
      category: 'Office Supplies',
      baselinePrice: 12.99,
      lastPaidPrice: 12.99,
      lastCheckedPrice: 11.49,
      vendorName: 'Office Depot',
      upc: '043875321890',
      isVagueName: isVagueName('HP Printer Paper 500 Sheets'),
      matchConfidence: 0.85, // Good confidence
      needsClarification: needsClarification('HP Printer Paper 500 Sheets', 0.85),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Amazon', 
            price: 12.99, 
            url: 'https://amazon.com/hp-printer-paper',
            date: new Date() 
          },
          { companyId: testCompany.id, retailer: 'Office Depot', 
            price: 11.49, 
            url: 'https://officedepot.com/hp-printer-paper',
            date: new Date() 
          },
        ],
      },
    },
  });

  // Item 2: GOOD - Specific name with brand and type
  const item2 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Staples Heavy Duty Stapler',
      sku: 'STAPL-HD-001',
      category: 'Office Equipment',
      baselinePrice: 24.99,
      lastPaidPrice: 24.99,
      lastCheckedPrice: 22.50,
      vendorName: 'Staples Direct',
      upc: '087129043210',
      isVagueName: isVagueName('Staples Heavy Duty Stapler'),
      matchConfidence: 0.78, // Good confidence
      needsClarification: needsClarification('Staples Heavy Duty Stapler', 0.78),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Amazon', 
            price: 24.99,
            url: 'https://amazon.com/staples-stapler',
            date: new Date() 
          },
          { companyId: testCompany.id, retailer: 'Staples', 
            price: 22.50,
            url: 'https://staples.com/heavy-duty-stapler',
            date: new Date() 
          },
        ],
      },
    },
  });

  // Item 3: VAGUE - Too generic, needs clarification
  const item3 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Nails',
      sku: null,
      category: 'Hardware',
      baselinePrice: 15.99,
      lastPaidPrice: 15.99,
      lastCheckedPrice: null,
      vendorName: null,
      upc: null,
      isVagueName: isVagueName('Nails'),
      matchConfidence: 0.25, // Low confidence - too vague
      needsClarification: needsClarification('Nails', 0.25),
      prices: {
        create: [],
      },
    },
  });

  // Item 4: VAGUE - Single word, no details
  const item4 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Paper',
      sku: null,
      category: 'Office Supplies',
      baselinePrice: 8.99,
      lastPaidPrice: 8.99,
      lastCheckedPrice: null,
      vendorName: null,
      upc: null,
      isVagueName: isVagueName('Paper'),
      matchConfidence: 0.30, // Low confidence
      needsClarification: needsClarification('Paper', 0.30),
      prices: {
        create: [],
      },
    },
  });

  // Item 5: GOOD - Very specific name (the example from your question!)
  const item5 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Simpson Strong-Tie 3-in x 0.148-in 10d Hot-dipped galvanized Smooth Shank Framing nails',
      sku: 'SIMPSON-10D-3IN',
      category: 'Hardware',
      baselinePrice: 15.99,
      lastPaidPrice: 15.99,
      lastCheckedPrice: 14.50,
      vendorName: 'Simpson Strong-Tie',
      upc: '070330322104',
      isVagueName: isVagueName('Simpson Strong-Tie 3-in x 0.148-in 10d Hot-dipped galvanized Smooth Shank Framing nails'),
      matchConfidence: 0.92, // Excellent confidence - very specific
      needsClarification: needsClarification('Simpson Strong-Tie 3-in x 0.148-in 10d Hot-dipped galvanized Smooth Shank Framing nails', 0.92),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Home Depot', 
            price: 14.50,
            url: 'https://homedepot.com/simpson-framing-nails',
            date: new Date() 
          },
          { companyId: testCompany.id, retailer: 'Lowe\'s', 
            price: 15.25,
            url: 'https://lowes.com/simpson-strong-tie-nails',
            date: new Date() 
          },
        ],
      },
    },
  });

  // Item 6: GOOD - Office supplies
  const item6 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'BIC Round Stic Ballpoint Pens, Medium Point, Black, 60-Count',
      sku: 'BIC-60-BLK',
      category: 'Office Supplies',
      baselinePrice: 8.99,
      lastPaidPrice: 8.99,
      lastCheckedPrice: 7.49,
      vendorName: 'BIC',
      upc: '071641000001',
      isVagueName: isVagueName('BIC Round Stic Ballpoint Pens, Medium Point, Black, 60-Count'),
      matchConfidence: 0.88,
      needsClarification: needsClarification('BIC Round Stic Ballpoint Pens, Medium Point, Black, 60-Count', 0.88),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Amazon', price: 7.49, url: 'https://amazon.com/bic-pens-60', date: new Date() },
          { companyId: testCompany.id, retailer: 'Staples', price: 8.99, url: 'https://staples.com/bic-round-stic', date: new Date() },
        ],
      },
    },
  });

  // Item 7: GOOD - Electronics
  const item7 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Logitech MX Master 3 Wireless Mouse',
      sku: 'LOG-MX-M3',
      category: 'Electronics',
      baselinePrice: 99.99,
      lastPaidPrice: 99.99,
      lastCheckedPrice: 89.99,
      vendorName: 'Logitech',
      upc: '097855153123',
      isVagueName: isVagueName('Logitech MX Master 3 Wireless Mouse'),
      matchConfidence: 0.91,
      needsClarification: needsClarification('Logitech MX Master 3 Wireless Mouse', 0.91),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Amazon', price: 89.99, url: 'https://amazon.com/logitech-mx-master-3', date: new Date() },
          { companyId: testCompany.id, retailer: 'Best Buy', price: 99.99, url: 'https://bestbuy.com/mx-master-3', date: new Date() },
        ],
      },
    },
  });

  // Item 8: GOOD - Cleaning supplies
  const item8 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Clorox Disinfecting Wipes, Fresh Scent, 75 Count',
      sku: 'CLX-WIPES-75',
      category: 'Cleaning Supplies',
      baselinePrice: 5.99,
      lastPaidPrice: 5.99,
      lastCheckedPrice: 4.99,
      vendorName: 'Clorox',
      upc: '044600005123',
      isVagueName: isVagueName('Clorox Disinfecting Wipes, Fresh Scent, 75 Count'),
      matchConfidence: 0.86,
      needsClarification: needsClarification('Clorox Disinfecting Wipes, Fresh Scent, 75 Count', 0.86),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Target', price: 4.99, url: 'https://target.com/clorox-wipes', date: new Date() },
          { companyId: testCompany.id, retailer: 'Staples', price: 5.99, url: 'https://staples.com/clorox-wipes-75', date: new Date() },
        ],
      },
    },
  });

  // Item 9: VAGUE - Too generic
  const item9 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Screws',
      sku: null,
      category: 'Hardware',
      baselinePrice: 12.50,
      lastPaidPrice: 12.50,
      lastCheckedPrice: null,
      vendorName: null,
      upc: null,
      isVagueName: isVagueName('Screws'),
      matchConfidence: 0.22,
      needsClarification: needsClarification('Screws', 0.22),
      prices: { create: [] },
    },
  });

  // Item 10: GOOD - Tools
  const item10 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'DEWALT 20V MAX Cordless Drill Kit with Battery and Charger',
      sku: 'DCD771C2',
      category: 'Tools',
      baselinePrice: 149.99,
      lastPaidPrice: 149.99,
      lastCheckedPrice: 129.99,
      vendorName: 'DEWALT',
      upc: '088591177123',
      isVagueName: isVagueName('DEWALT 20V MAX Cordless Drill Kit with Battery and Charger'),
      matchConfidence: 0.93,
      needsClarification: needsClarification('DEWALT 20V MAX Cordless Drill Kit with Battery and Charger', 0.93),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Home Depot', price: 129.99, url: 'https://homedepot.com/dewalt-drill', date: new Date() },
          { companyId: testCompany.id, retailer: 'Lowe\'s', price: 149.99, url: 'https://lowes.com/dewalt-20v-drill', date: new Date() },
        ],
      },
    },
  });

  // Item 11: GOOD - Office furniture
  const item11 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Herman Miller Aeron Chair, Size B, Graphite',
      sku: 'HM-AERON-B-GRY',
      category: 'Furniture',
      baselinePrice: 1295.00,
      lastPaidPrice: 1295.00,
      lastCheckedPrice: 1195.00,
      vendorName: 'Herman Miller',
      upc: null,
      isVagueName: isVagueName('Herman Miller Aeron Chair, Size B, Graphite'),
      matchConfidence: 0.95,
      needsClarification: needsClarification('Herman Miller Aeron Chair, Size B, Graphite', 0.95),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Amazon', price: 1195.00, url: 'https://amazon.com/herman-miller-aeron', date: new Date() },
        ],
      },
    },
  });

  // Item 12: VAGUE - Single word
  const item12 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Tape',
      sku: null,
      category: 'Office Supplies',
      baselinePrice: 3.99,
      lastPaidPrice: 3.99,
      lastCheckedPrice: null,
      vendorName: null,
      upc: null,
      isVagueName: isVagueName('Tape'),
      matchConfidence: 0.28,
      needsClarification: needsClarification('Tape', 0.28),
      prices: { create: [] },
    },
  });

  // Item 13: GOOD - Safety equipment
  const item13 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: '3M N95 Respirator Mask, 20-Pack',
      sku: '3M-8210-20',
      category: 'Safety Equipment',
      baselinePrice: 24.99,
      lastPaidPrice: 24.99,
      lastCheckedPrice: 19.99,
      vendorName: '3M',
      upc: '070074701234',
      isVagueName: isVagueName('3M N95 Respirator Mask, 20-Pack'),
      matchConfidence: 0.89,
      needsClarification: needsClarification('3M N95 Respirator Mask, 20-Pack', 0.89),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Amazon', price: 19.99, url: 'https://amazon.com/3m-n95-mask', date: new Date() },
          { companyId: testCompany.id, retailer: 'Home Depot', price: 24.99, url: 'https://homedepot.com/3m-n95', date: new Date() },
        ],
      },
    },
  });

  // Item 14: GOOD - Packaging
  const item14 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Uline Shipping Boxes, 12x9x6 inches, 25-Pack',
      sku: 'UL-S-200',
      category: 'Packaging',
      baselinePrice: 45.99,
      lastPaidPrice: 45.99,
      lastCheckedPrice: 39.99,
      vendorName: 'Uline',
      upc: null,
      isVagueName: isVagueName('Uline Shipping Boxes, 12x9x6 inches, 25-Pack'),
      matchConfidence: 0.87,
      needsClarification: needsClarification('Uline Shipping Boxes, 12x9x6 inches, 25-Pack', 0.87),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Uline', price: 39.99, url: 'https://uline.com/shipping-boxes', date: new Date() },
        ],
      },
    },
  });

  // Item 15: GOOD - Software/Subscription
  const item15 = await prisma.item.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      name: 'Microsoft Office 365 Business Standard, Annual Subscription',
      sku: 'MS-O365-BUS-STD',
      category: 'Software',
      baselinePrice: 150.00,
      lastPaidPrice: 150.00,
      lastCheckedPrice: 135.00,
      vendorName: 'Microsoft',
      upc: null,
      isVagueName: isVagueName('Microsoft Office 365 Business Standard, Annual Subscription'),
      matchConfidence: 0.90,
      needsClarification: needsClarification('Microsoft Office 365 Business Standard, Annual Subscription', 0.90),
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Microsoft Store', price: 135.00, url: 'https://microsoft.com/office365', date: new Date() },
        ],
      },
    },
  });

  console.log('');
  console.log('✅ Created example items (mix of good and vague for testing):');
  console.log(`   1. ${item1.name} - $${item1.lastPaidPrice} ✅ GOOD`);
  console.log(`   2. ${item2.name} - $${item2.lastPaidPrice} ✅ GOOD`);
  console.log(`   3. ${item3.name} - $${item3.lastPaidPrice} ⚠️ VAGUE`);
  console.log(`   4. ${item4.name} - $${item4.lastPaidPrice} ⚠️ VAGUE`);
  console.log(`   5. ${item5.name.substring(0, 50)}... - $${item5.lastPaidPrice} ✅ EXCELLENT`);
  console.log(`   6-15. ${item6.name.substring(0, 40)}... and 9 more items`);
  
  // Delete existing alerts for clean seed
  await prisma.alert.deleteMany({
    where: { userId: testUser.id },
  });

  // Create multiple alerts with different dates for historical view
  console.log('');
  console.log('🔔 Creating alerts (various dates for historical view)...');
  
  const now = new Date();
  const alertsData = [
    // Recent alerts (this month)
    {
      itemId: item5.id,
      retailer: 'Home Depot',
      oldPrice: 15.99,
      newPrice: 14.50,
      priceDropAmount: 1.49,
      url: 'https://homedepot.com/simpson-framing-nails',
      savingsPerOrder: 1.49,
      estimatedMonthlySavings: 1.49,
      alertDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    {
      itemId: item6.id,
      retailer: 'Amazon',
      oldPrice: 8.99,
      newPrice: 7.49,
      priceDropAmount: 1.50,
      url: 'https://amazon.com/bic-pens-60',
      savingsPerOrder: 1.50,
      estimatedMonthlySavings: 1.50,
      alertDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      itemId: item7.id,
      retailer: 'Amazon',
      oldPrice: 99.99,
      newPrice: 89.99,
      priceDropAmount: 10.00,
      url: 'https://amazon.com/logitech-mx-master-3',
      savingsPerOrder: 10.00,
      estimatedMonthlySavings: 10.00,
      alertDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      itemId: item8.id,
      retailer: 'Target',
      oldPrice: 5.99,
      newPrice: 4.99,
      priceDropAmount: 1.00,
      url: 'https://target.com/clorox-wipes',
      savingsPerOrder: 1.00,
      estimatedMonthlySavings: 1.00,
      alertDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    },
    {
      itemId: item10.id,
      retailer: 'Home Depot',
      oldPrice: 149.99,
      newPrice: 129.99,
      priceDropAmount: 20.00,
      url: 'https://homedepot.com/dewalt-drill',
      savingsPerOrder: 20.00,
      estimatedMonthlySavings: 20.00,
      alertDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
    },
    // Older alerts (last month)
    {
      itemId: item1.id,
      retailer: 'Office Depot',
      oldPrice: 12.99,
      newPrice: 11.49,
      priceDropAmount: 1.50,
      url: 'https://officedepot.com/hp-printer-paper',
      savingsPerOrder: 1.50,
      estimatedMonthlySavings: 1.50,
      alertDate: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
    },
    {
      itemId: item2.id,
      retailer: 'Staples',
      oldPrice: 24.99,
      newPrice: 22.50,
      priceDropAmount: 2.49,
      url: 'https://staples.com/heavy-duty-stapler',
      savingsPerOrder: 2.49,
      estimatedMonthlySavings: 2.49,
      alertDate: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
    },
    {
      itemId: item11.id,
      retailer: 'Amazon',
      oldPrice: 1295.00,
      newPrice: 1195.00,
      priceDropAmount: 100.00,
      url: 'https://amazon.com/herman-miller-aeron',
      savingsPerOrder: 100.00,
      estimatedMonthlySavings: 100.00,
      alertDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
    },
    // Older alerts (last quarter)
    {
      itemId: item13.id,
      retailer: 'Amazon',
      oldPrice: 24.99,
      newPrice: 19.99,
      priceDropAmount: 5.00,
      url: 'https://amazon.com/3m-n95-mask',
      savingsPerOrder: 5.00,
      estimatedMonthlySavings: 5.00,
      alertDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
    },
    {
      itemId: item14.id,
      retailer: 'Uline',
      oldPrice: 45.99,
      newPrice: 39.99,
      priceDropAmount: 6.00,
      url: 'https://uline.com/shipping-boxes',
      savingsPerOrder: 6.00,
      estimatedMonthlySavings: 6.00,
      alertDate: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000), // 75 days ago
    },
    // Older alerts (last year)
    {
      itemId: item15.id,
      retailer: 'Microsoft Store',
      oldPrice: 150.00,
      newPrice: 135.00,
      priceDropAmount: 15.00,
      url: 'https://microsoft.com/office365',
      savingsPerOrder: 15.00,
      estimatedMonthlySavings: 15.00,
      alertDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
    },
    {
      itemId: item6.id,
      retailer: 'Staples',
      oldPrice: 8.99,
      newPrice: 7.99,
      priceDropAmount: 1.00,
      url: 'https://staples.com/bic-round-stic',
      savingsPerOrder: 1.00,
      estimatedMonthlySavings: 1.00,
      alertDate: new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000), // 150 days ago
    },
  ];

  const createdAlerts = [];
  for (const alertData of alertsData) {
    const alert = await prisma.alert.create({
      data: {
        userId: testUser.id,
        companyId: testCompany.id,
        ...alertData,
        seen: false,
        viewed: false,
      },
    });
    createdAlerts.push(alert);
  }
  
  console.log(`   ✓ Created ${createdAlerts.length} alerts across different time periods`);
  
  // Create savings summary
  console.log('');
  console.log('💰 Creating savings summary...');
  
  // Calculate total monthly savings from recent alerts (last month)
  const recentAlerts = alertsData.filter(a => {
    const alertDate = new Date(a.alertDate);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return alertDate >= monthAgo;
  });
  const monthlyTotal = recentAlerts.reduce((sum, a) => sum + a.estimatedMonthlySavings, 0);
  const yearToDate = alertsData.reduce((sum, a) => sum + a.estimatedMonthlySavings, 0) * 12; // Rough estimate

  // Delete existing savings summary if it exists
  await prisma.savingsSummary.deleteMany({
    where: { userId: testUser.id },
  });

  const savingsSummary = await prisma.savingsSummary.create({
    data: {
      userId: testUser.id,
      companyId: testCompany.id,
      monthlyTotal,
      yearToDate,
    },
  });
  
  console.log(`   ✓ Savings summary: $${savingsSummary.monthlyTotal.toFixed(2)}/month, $${savingsSummary.yearToDate.toFixed(2)} YTD`);
  
  // Set matched retailers manually for demo data (only for good items)
  // Using new match fields for consistency with real user experience
  console.log('');
  console.log('🔗 Setting matched retailers...');
  
  await prisma.item.update({
    where: { id: item1.id },
    data: {
      // Legacy fields (for backward compatibility)
      matchedRetailer: 'Office Depot',
      matchedUrl: 'https://officedepot.com/hp-printer-paper',
      matchedPrice: 11.49,
      // New match fields
      matchProvider: 'officedepot',
      matchUrl: 'https://officedepot.com/hp-printer-paper',
      matchTitle: 'HP Printer Paper 500 Sheets',
      matchPrice: 11.49,
      matchConfidence: 0.85,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });
  
  await prisma.item.update({
    where: { id: item2.id },
    data: {
      matchedRetailer: 'Staples',
      matchedUrl: 'https://staples.com/heavy-duty-stapler',
      matchedPrice: 22.50,
      matchProvider: 'officedepot', // Staples is Office Depot
      matchUrl: 'https://staples.com/heavy-duty-stapler',
      matchTitle: 'Staples Heavy Duty Stapler',
      matchPrice: 22.50,
      matchConfidence: 0.78,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });
  
  await prisma.item.update({
    where: { id: item5.id },
    data: {
      matchedRetailer: 'Home Depot',
      matchedUrl: 'https://homedepot.com/simpson-framing-nails',
      matchedPrice: 14.50,
      matchProvider: 'homedepot',
      matchUrl: 'https://homedepot.com/simpson-framing-nails',
      matchTitle: 'Simpson Strong-Tie 3-in x 0.148-in 10d Hot-dipped galvanized Smooth Shank Framing nails',
      matchPrice: 14.50,
      matchConfidence: 0.92,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });

  await prisma.item.update({
    where: { id: item6.id },
    data: {
      matchedRetailer: 'Amazon',
      matchedUrl: 'https://amazon.com/bic-pens-60',
      matchedPrice: 7.49,
      matchProvider: 'amazon',
      matchUrl: 'https://amazon.com/bic-pens-60',
      matchTitle: 'BIC Round Stic Ballpoint Pens, Medium Point, Black, 60-Count',
      matchPrice: 7.49,
      matchConfidence: 0.88,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });

  await prisma.item.update({
    where: { id: item7.id },
    data: {
      matchedRetailer: 'Amazon',
      matchedUrl: 'https://amazon.com/logitech-mx-master-3',
      matchedPrice: 89.99,
      matchProvider: 'amazon',
      matchUrl: 'https://amazon.com/logitech-mx-master-3',
      matchTitle: 'Logitech MX Master 3 Wireless Mouse',
      matchPrice: 89.99,
      matchConfidence: 0.91,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });

  await prisma.item.update({
    where: { id: item8.id },
    data: {
      matchedRetailer: 'Target',
      matchedUrl: 'https://target.com/clorox-wipes',
      matchedPrice: 4.99,
      matchProvider: 'target',
      matchUrl: 'https://target.com/clorox-wipes',
      matchTitle: 'Clorox Disinfecting Wipes, Fresh Scent, 75 Count',
      matchPrice: 4.99,
      matchConfidence: 0.86,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });

  await prisma.item.update({
    where: { id: item10.id },
    data: {
      matchedRetailer: 'Home Depot',
      matchedUrl: 'https://homedepot.com/dewalt-drill',
      matchedPrice: 129.99,
      matchProvider: 'homedepot',
      matchUrl: 'https://homedepot.com/dewalt-drill',
      matchTitle: 'DEWALT 20V MAX Cordless Drill Kit with Battery and Charger',
      matchPrice: 129.99,
      matchConfidence: 0.93,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });

  await prisma.item.update({
    where: { id: item11.id },
    data: {
      matchedRetailer: 'Amazon',
      matchedUrl: 'https://amazon.com/herman-miller-aeron',
      matchedPrice: 1195.00,
      matchProvider: 'amazon',
      matchUrl: 'https://amazon.com/herman-miller-aeron',
      matchTitle: 'Herman Miller Aeron Chair, Size B, Graphite',
      matchPrice: 1195.00,
      matchConfidence: 0.95,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });

  await prisma.item.update({
    where: { id: item13.id },
    data: {
      matchedRetailer: 'Amazon',
      matchedUrl: 'https://amazon.com/3m-n95-mask',
      matchedPrice: 19.99,
      matchProvider: 'amazon',
      matchUrl: 'https://amazon.com/3m-n95-mask',
      matchTitle: '3M N95 Respirator Mask, 20-Pack',
      matchPrice: 19.99,
      matchConfidence: 0.89,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });

  await prisma.item.update({
    where: { id: item14.id },
    data: {
      matchedRetailer: 'Uline',
      matchedUrl: 'https://uline.com/shipping-boxes',
      matchedPrice: 39.99,
      matchProvider: 'uline',
      matchUrl: 'https://uline.com/shipping-boxes',
      matchTitle: 'Uline Shipping Boxes, 12x9x6 inches, 25-Pack',
      matchPrice: 39.99,
      matchConfidence: 0.87,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });

  await prisma.item.update({
    where: { id: item15.id },
    data: {
      matchedRetailer: 'Microsoft Store',
      matchedUrl: 'https://microsoft.com/office365',
      matchedPrice: 135.00,
      matchProvider: 'microsoft',
      matchUrl: 'https://microsoft.com/office365',
      matchTitle: 'Microsoft Office 365 Business Standard, Annual Subscription',
      matchPrice: 135.00,
      matchConfidence: 0.90,
      matchStatus: 'auto_matched',
      lastMatchedAt: new Date(),
    },
  });
  
  console.log(`   ✓ ${item1.name} → Office Depot ($11.49) ✅`);
  console.log(`   ✓ ${item2.name} → Staples ($22.50) ✅`);
  console.log(`   ✓ ${item3.name} → No match (too vague) ⚠️`);
  console.log(`   ✓ ${item4.name} → No match (too vague) ⚠️`);
  console.log(`   ✓ ${item5.name.substring(0, 40)}... → Home Depot ($14.50) ✅`);
  console.log(`   ✓ ${item6.name.substring(0, 40)}... → Amazon ($7.49) ✅`);
  console.log(`   ✓ ${item7.name.substring(0, 40)}... → Amazon ($89.99) ✅`);
  console.log(`   ✓ ${item8.name.substring(0, 40)}... → Target ($4.99) ✅`);
  console.log(`   ✓ ${item9.name} → No match (too vague) ⚠️`);
  console.log(`   ✓ ${item10.name.substring(0, 40)}... → Home Depot ($129.99) ✅`);
  console.log(`   ✓ ${item11.name.substring(0, 40)}... → Amazon ($1195.00) ✅`);
  console.log(`   ✓ ${item12.name} → No match (too vague) ⚠️`);
  console.log(`   ✓ ${item13.name.substring(0, 40)}... → Amazon ($19.99) ✅`);
  console.log(`   ✓ ${item14.name.substring(0, 40)}... → Uline ($39.99) ✅`);
  console.log(`   ✓ ${item15.name.substring(0, 40)}... → Microsoft Store ($135.00) ✅`);
  
  // Create a sample invite
  console.log('');
  console.log('🔗 Creating sample invite...');
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
  
  const invite = await prisma.invite.upsert({
    where: { token: 'procuro-invite-demo' },
    update: {},
    create: {
      companyId: testCompany.id,
      token: 'procuro-invite-demo',
      expiresAt,
      used: false,
    },
  });
  
  console.log(`   ✓ Sample invite created: procuro-invite-demo`);
  console.log(`   ✓ Expires: ${expiresAt.toLocaleDateString()}`);
  console.log(`   ✓ Invite URL: http://localhost:5173/invite/${invite.token}`);

  // --- Second user in same company (Company A) - simulates multiple QB users in one company ---
  console.log('');
  console.log('👤 Creating second user in Company A (multi-user per company)...');
  const testUserA2 = await prisma.user.upsert({
    where: { email: 'test2@procuroapp.com' },
    update: { companyId: testCompany.id },
    create: {
      email: 'test2@procuroapp.com',
      name: 'Test User A2',
      companyId: testCompany.id,
    },
  });
  await prisma.item.deleteMany({ where: { userId: testUserA2.id } });
  const a2item1 = await prisma.item.create({
    data: {
      userId: testUserA2.id,
      companyId: testCompany.id,
      name: 'A2 Only: Canon PIXMA Ink Cartridge Black',
      sku: 'CANON-PIXMA-BLK',
      category: 'Office Supplies',
      baselinePrice: 24.99,
      lastPaidPrice: 24.99,
      lastCheckedPrice: 22.99,
      vendorName: 'Canon',
      isVagueName: false,
      matchConfidence: 0.88,
      needsClarification: false,
      prices: {
        create: [
          { companyId: testCompany.id, retailer: 'Amazon', price: 22.99, url: 'https://amazon.com/canon-pixma-ink', date: new Date() },
        ],
      },
    },
  });
  const a2item2 = await prisma.item.create({
    data: {
      userId: testUserA2.id,
      companyId: testCompany.id,
      name: 'A2 Only: Rubbermaid Storage Bin 18 Gal',
      sku: 'RUB-18',
      category: 'Storage',
      baselinePrice: 12.99,
      lastPaidPrice: 12.99,
      lastCheckedPrice: null,
      vendorName: 'Rubbermaid',
      isVagueName: false,
      matchConfidence: 0.75,
      needsClarification: false,
      prices: { create: [] },
    },
  });
  console.log(`   ✓ User A2 (test2@procuroapp.com) in Company A with ${2} items`);

  // --- Second company (Company B) with its own user and items ---
  console.log('');
  console.log('🏢 Creating second company (Company B) for tenant isolation testing...');
  const companyB = await prisma.company.upsert({
    where: { realmId: 'test-realm-456' },
    update: {},
    create: {
      realmId: 'test-realm-456',
      name: 'Acme Corp',
    },
  });
  const testUserB = await prisma.user.upsert({
    where: { email: 'testb@procuroapp.com' },
    update: { companyId: companyB.id },
    create: {
      email: 'testb@procuroapp.com',
      name: 'Test User B',
      companyId: companyB.id,
    },
  });
  await prisma.item.deleteMany({ where: { userId: testUserB.id } });
  const bitem1 = await prisma.item.create({
    data: {
      userId: testUserB.id,
      companyId: companyB.id,
      name: 'Company B Only: Lenovo ThinkPad USB-C Dock',
      sku: 'LENOVO-DOCK',
      category: 'Electronics',
      baselinePrice: 199.99,
      lastPaidPrice: 199.99,
      lastCheckedPrice: 179.99,
      vendorName: 'Lenovo',
      isVagueName: false,
      matchConfidence: 0.9,
      needsClarification: false,
      prices: {
        create: [
          { companyId: companyB.id, retailer: 'Amazon', price: 179.99, url: 'https://amazon.com/lenovo-dock', date: new Date() },
        ],
      },
    },
  });
  const bitem2 = await prisma.item.create({
    data: {
      userId: testUserB.id,
      companyId: companyB.id,
      name: 'Company B Only: Steelcase Gesture Chair',
      sku: 'STEEL-GEST',
      category: 'Furniture',
      baselinePrice: 1099.00,
      lastPaidPrice: 1099.00,
      lastCheckedPrice: null,
      vendorName: 'Steelcase',
      isVagueName: false,
      matchConfidence: 0.92,
      needsClarification: false,
      prices: { create: [] },
    },
  });
  await prisma.alert.create({
    data: {
      userId: testUserB.id,
      companyId: companyB.id,
      itemId: bitem1.id,
      retailer: 'Amazon',
      oldPrice: 199.99,
      newPrice: 179.99,
      priceDropAmount: 20,
      url: 'https://amazon.com/lenovo-dock',
      savingsPerOrder: 20,
      estimatedMonthlySavings: 20,
      alertDate: new Date(),
      seen: false,
      viewed: false,
    },
  });
  console.log(`   ✓ Company B (Acme Corp), User B (testb@procuroapp.com) with ${2} items and 1 alert`);
  
  console.log('');
  console.log('📊 Database seeded successfully!');
  console.log('');
  console.log('Summary:');
  console.log('   • Company A (Test Company Inc.): User A1 (test@procuroapp.com) – 15 items, alerts, savings');
  console.log('   • Company A: User A2 (test2@procuroapp.com) – 2 items (multi-user same company)');
  console.log('   • Company B (Acme Corp): User B (testb@procuroapp.com) – 2 items, 1 alert');
  console.log('   • Default app user: test@procuroapp.com. Enable TEST_MODE and use "View as" to switch users.');
  console.log('');
  console.log('Next steps:');
  console.log('   1. Open app: http://localhost:5173 (you should see Company A / User A1 data)');
  console.log('   2. Set TEST_MODE=true and use "View as" dropdown to test Company B or User A2');
  console.log('👉 Generate invite link: http://localhost:5000/dashboard/company/invite');
  console.log('👉 Connect to QuickBooks: http://localhost:5000/api/qb/connect');
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