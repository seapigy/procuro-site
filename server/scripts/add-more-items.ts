/**
 * Script to add more items for testing the 50-item monitoring cap
 * Run with: npx tsx server/scripts/add-more-items.ts
 */

import prisma from '../src/lib/prisma';
import { isVagueName, needsClarification } from '../src/services/matchItem';

const additionalItems = [
  // Office Supplies
  { name: '3M Post-it Notes, 3x3 inches, 12 Pads', category: 'Office Supplies', price: 8.99, sku: '3M-POSTIT-12', vendor: 'Office Depot' },
  { name: 'Sharpie Permanent Markers, Fine Point, 12-Pack', category: 'Office Supplies', price: 12.49, sku: 'SHARPIE-FP-12', vendor: 'Staples' },
  { name: 'Scotch Magic Tape, 3/4 inch x 1296 inches', category: 'Office Supplies', price: 4.99, sku: 'SCOTCH-TAPE-34', vendor: 'Various' },
  { name: 'Avery Address Labels, 1 x 2-5/8 inches, 3000 Labels', category: 'Office Supplies', price: 15.99, sku: 'AVERY-LABEL-3000', vendor: 'Office Depot' },
  { name: 'Pilot G2 Retractable Gel Pens, 0.7mm, 12-Pack', category: 'Office Supplies', price: 13.99, sku: 'PILOT-G2-12', vendor: 'Amazon' },
  { name: 'Ticonderoga Pencils, #2 Soft, 144 Count', category: 'Office Supplies', price: 18.99, sku: 'TICONDER-144', vendor: 'Staples' },
  { name: 'Elmer\'s Glue Sticks, Washable, 0.77 oz, 30-Pack', category: 'Office Supplies', price: 9.99, sku: 'ELMERS-GLUE-30', vendor: 'Various' },
  { name: 'Five Star Notebook, College Ruled, 1 Subject, 100 Sheets', category: 'Office Supplies', price: 3.99, sku: 'FIVESTAR-NB-100', vendor: 'Target' },
  { name: 'Swingline Paper Shredder, 12-Sheet Capacity', category: 'Office Equipment', price: 89.99, sku: 'SWING-SHRED-12', vendor: 'Staples' },
  { name: 'Brother HL-L2350DW Monochrome Laser Printer', category: 'Office Equipment', price: 129.99, sku: 'BROTHER-HL2350', vendor: 'Best Buy' },
  
  // Cleaning Supplies
  { name: 'Lysol Disinfecting Wipes, Lemon & Lime Blossom, 75 Count', category: 'Cleaning Supplies', price: 6.99, sku: 'LYSOL-WIPES-75', vendor: 'Target' },
  { name: 'Clorox Bleach, Regular, 121 oz', category: 'Cleaning Supplies', price: 5.49, sku: 'CLOROX-BLEACH-121', vendor: 'Various' },
  { name: 'Swiffer Wet Jet Refill Pads, 16 Count', category: 'Cleaning Supplies', price: 8.99, sku: 'SWIFFER-WET-16', vendor: 'Target' },
  { name: 'Dawn Dish Soap, Original Scent, 24 oz', category: 'Cleaning Supplies', price: 4.99, sku: 'DAWN-ORIG-24', vendor: 'Various' },
  { name: 'Bounty Paper Towels, 12 Double Rolls', category: 'Cleaning Supplies', price: 19.99, sku: 'BOUNTY-12DBL', vendor: 'Costco' },
  { name: 'Charmin Ultra Soft Toilet Paper, 18 Mega Rolls', category: 'Cleaning Supplies', price: 24.99, sku: 'CHARMIN-18MEGA', vendor: 'Costco' },
  { name: 'Tide Pods Laundry Detergent, Original, 81 Count', category: 'Cleaning Supplies', price: 24.99, sku: 'TIDE-PODS-81', vendor: 'Various' },
  { name: 'Febreze Fabric Refresher, Gain Original, 27.5 oz', category: 'Cleaning Supplies', price: 7.99, sku: 'FEBREZE-GAIN-27', vendor: 'Target' },
  
  // Tools & Hardware
  { name: 'DEWALT 20V MAX Cordless Drill/Driver Kit', category: 'Tools', price: 149.99, sku: 'DEWALT-20V-DRILL', vendor: 'Home Depot' },
  { name: 'Milwaukee M18 Fuel Circular Saw, 6-1/2 inch', category: 'Tools', price: 199.99, sku: 'MILWAUKEE-CIRC-65', vendor: 'Home Depot' },
  { name: 'Stanley 25-Foot Tape Measure', category: 'Tools', price: 12.99, sku: 'STANLEY-TAPE-25', vendor: 'Home Depot' },
  { name: 'Craftsman 450-Piece Socket Set', category: 'Tools', price: 89.99, sku: 'CRAFTS-SOCKET-450', vendor: 'Lowe\'s' },
  { name: 'Black+Decker 20V MAX Cordless Screwdriver', category: 'Tools', price: 39.99, sku: 'BLACK-SCREW-20V', vendor: 'Home Depot' },
  { name: 'Gorilla Glue, 4 oz Bottle', category: 'Tools', price: 5.99, sku: 'GORILLA-GLUE-4', vendor: 'Home Depot' },
  { name: '3M Safety Glasses, Clear Lens, Anti-Fog', category: 'Safety Equipment', price: 8.99, sku: '3M-SAFETY-GLASS', vendor: 'Home Depot' },
  { name: 'Klein Tools Wire Stripper, 10-18 AWG', category: 'Tools', price: 15.99, sku: 'KLEIN-STRIP-10-18', vendor: 'Home Depot' },
  
  // Electronics
  { name: 'Apple AirPods Pro, 2nd Generation', category: 'Electronics', price: 249.99, sku: 'APPLE-AIRPODS-PRO2', vendor: 'Best Buy' },
  { name: 'Samsung 32-inch 4K UHD Smart TV', category: 'Electronics', price: 299.99, sku: 'SAMSUNG-TV-32-4K', vendor: 'Best Buy' },
  { name: 'Anker USB-C to Lightning Cable, 6 ft', category: 'Electronics', price: 12.99, sku: 'ANKER-CABLE-6FT', vendor: 'Amazon' },
  { name: 'Belkin 7-Port USB 3.0 Hub', category: 'Electronics', price: 29.99, sku: 'BELKIN-HUB-7', vendor: 'Amazon' },
  { name: 'SanDisk 128GB Ultra USB 3.0 Flash Drive', category: 'Electronics', price: 14.99, sku: 'SANDISK-128-USB3', vendor: 'Best Buy' },
  { name: 'Canon PIXMA TR8620 All-in-One Printer', category: 'Electronics', price: 199.99, sku: 'CANON-PIXMA-TR8620', vendor: 'Best Buy' },
  
  // Building Materials
  { name: '2x4x8 Pressure Treated Lumber', category: 'Building Materials', price: 8.99, sku: 'LUMBER-2X4X8-PT', vendor: 'Home Depot' },
  { name: 'Sheetrock 1/2 inch x 4 ft x 8 ft Drywall', category: 'Building Materials', price: 12.99, sku: 'SHEETROCK-12-4X8', vendor: 'Home Depot' },
  { name: 'Loctite PL Premium Construction Adhesive, 10 oz', category: 'Building Materials', price: 6.99, sku: 'LOCTITE-PL-10', vendor: 'Home Depot' },
  { name: 'Rust-Oleum Painter\'s Touch Latex Paint, White, 1 Quart', category: 'Building Materials', price: 9.99, sku: 'RUSTOLEUM-WHITE-QT', vendor: 'Home Depot' },
  { name: '3M Command Picture Hanging Strips, Large, 6 Pairs', category: 'Building Materials', price: 7.99, sku: '3M-COMMAND-LG-6', vendor: 'Home Depot' },
  
  // Safety & PPE
  { name: '3M N95 Respirator Mask, 20-Pack', category: 'Safety Equipment', price: 24.99, sku: '3M-N95-20PK', vendor: 'Amazon' },
  { name: 'Honeywell Safety Glasses, Clear, Anti-Fog', category: 'Safety Equipment', price: 6.99, sku: 'HONEYWELL-GLASS', vendor: 'Home Depot' },
  { name: 'Carhartt Work Gloves, Large, 3-Pack', category: 'Safety Equipment', price: 24.99, sku: 'CARHARTT-GLOVE-L-3', vendor: 'Home Depot' },
  { name: '3M WorkTunes Hearing Protection Headphones', category: 'Safety Equipment', price: 49.99, sku: '3M-WORKTUNES', vendor: 'Home Depot' },
  
  // Packaging & Shipping
  { name: 'Uline Shipping Boxes, 12x9x6 inches, 25-Pack', category: 'Packaging', price: 45.99, sku: 'ULINE-BOX-12X9X6-25', vendor: 'Uline' },
  { name: 'Scotch Bubble Wrap, 12 inch x 125 ft', category: 'Packaging', price: 19.99, sku: 'SCOTCH-BUBBLE-12-125', vendor: 'Uline' },
  { name: 'Dymo LabelWriter 450 Turbo Label Printer', category: 'Packaging', price: 149.99, sku: 'DYMO-450-TURBO', vendor: 'Staples' },
  { name: 'Packing Tape, 2 inch x 55 yards, 6 Rolls', category: 'Packaging', price: 12.99, sku: 'PACK-TAPE-2X55-6', vendor: 'Uline' },
];

async function main() {
  console.log('🌱 Adding additional items for testing...\n');

  // Get test user
  const testUser = await prisma.user.findFirst({
    where: { email: 'test@procuroapp.com' },
  });

  if (!testUser) {
    console.error('❌ Test user not found. Please run seed script first.');
    process.exit(1);
  }

  console.log(`✅ Found user: ${testUser.email} (ID: ${testUser.id})\n`);

  let created = 0;
  let skipped = 0;

  for (const itemData of additionalItems) {
    // Check if item already exists
    const existing = await prisma.item.findFirst({
      where: {
        userId: testUser.id,
        name: itemData.name,
      },
    });

    if (existing) {
      console.log(`⏭️  Skipping (already exists): ${itemData.name}`);
      skipped++;
      continue;
    }

    // Create item with realistic data
    const isVague = isVagueName(itemData.name);
    const needsClar = needsClarification(itemData.name, 0.75); // Assume 75% confidence for seed data

    await prisma.item.create({
      data: {
        userId: testUser.id,
        name: itemData.name,
        category: itemData.category,
        baselinePrice: itemData.price,
        lastPaidPrice: itemData.price,
        sku: itemData.sku,
        vendorName: itemData.vendor,
        isVagueName: isVague,
        needsClarification: needsClar,
        matchConfidence: 0.75, // Default confidence for seed data
        matchStatus: 'auto_matched',
        purchaseCount: Math.floor(Math.random() * 10) + 1, // 1-10 purchases
        firstPurchasedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date in last year
        lastPurchasedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
        estimatedMonthlyUnits: Math.random() * 10 + 1, // 1-11 units per month
      },
    });

    console.log(`✅ Created: ${itemData.name}`);
    created++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   • Created: ${created} items`);
  console.log(`   • Skipped: ${skipped} items (already exist)`);
  console.log(`\n🔄 Now recomputing monitoring priorities...\n`);

  // Recompute monitoring
  const { recomputeMonitoringForCompany } = await import('../src/services/monitoring');
  const appConfig = await import('../../config/app.json');
  const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 50;

  if (testUser.companyId) {
    await recomputeMonitoringForCompany(testUser.companyId, maxMonitoredItems);
    
    const monitoredCount = await prisma.item.count({
      where: {
        userId: testUser.id,
        isMonitored: true,
      },
    });

    const totalCount = await prisma.item.count({
      where: { userId: testUser.id },
    });

    console.log(`✅ Monitoring recomputed:`);
    console.log(`   • Total items: ${totalCount}`);
    console.log(`   • Monitored items: ${monitoredCount} of ${maxMonitoredItems}`);
  }

  console.log('\n✅ Done!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

