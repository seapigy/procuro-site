import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Load mock data for local testing without QuickBooks connection
 */
async function loadMockData() {
  console.log('🌱 Loading mock data for local testing...\n');

  try {
    // Create test company
    const company = await prisma.company.upsert({
      where: { realmId: 'mock-realm-123' },
      update: {},
      create: {
        realmId: 'mock-realm-123',
        name: 'Mock Test Company LLC'
      }
    });
    console.log('✅ Company created:', company.name);

    // Create test user
    const user = await prisma.user.upsert({
      where: { email: 'mockuser@procuroapp.com' },
      update: { companyId: company.id },
      create: {
        email: 'mockuser@procuroapp.com',
        name: 'Mock Test User',
        companyId: company.id,
        onboardingCompleted: true
      }
    });
    console.log('✅ User created:', user.email);

    // Clear existing mock data for this user
    await prisma.item.deleteMany({ where: { userId: user.id } });
    console.log('🧹 Cleared existing mock items');

    // Mock items with realistic data
    const mockItems = [
      {
        name: 'Staples Copy Paper, 8.5" x 11", Case',
        sku: 'STR513096',
        category: 'Office Supplies',
        lastPaidPrice: 45.99,
        vendorName: 'Staples Business Advantage',
        reorderIntervalDays: 30,
        upc: '718103130967'
      },
      {
        name: 'BIC Round Stic Ballpoint Pens, Medium Point, Black, Box of 60',
        sku: 'BIC-GSM60BK',
        category: 'Writing Instruments',
        lastPaidPrice: 12.49,
        vendorName: 'Office Depot',
        reorderIntervalDays: 45,
        upc: '070330334069'
      },
      {
        name: 'Post-it Notes, 3" x 3", Canary Yellow, 12 Pads',
        sku: '3M654Y12',
        category: 'Office Supplies',
        lastPaidPrice: 18.99,
        vendorName: 'Amazon Business',
        reorderIntervalDays: 60,
        upc: '051141971070'
      },
      {
        name: 'HP 64 Black/Tri-Color Ink Cartridges, 2/Pack',
        sku: 'HP-X4D92AN',
        category: 'Printer Supplies',
        lastPaidPrice: 54.99,
        vendorName: 'Best Buy for Business',
        reorderIntervalDays: 90,
        upc: '889296756736'
      },
      {
        name: 'Fellowes Powershred P-35C Cross-Cut Shredder',
        sku: 'FEL3213501',
        category: 'Office Equipment',
        lastPaidPrice: 89.99,
        vendorName: 'Walmart Business',
        reorderIntervalDays: 365,
        upc: '043859677344'
      },
      {
        name: 'Lysol Disinfecting Wipes, Lemon, 80 Wipes',
        sku: 'RAC-19200',
        category: 'Cleaning Supplies',
        lastPaidPrice: 8.99,
        vendorName: 'Target Plus',
        reorderIntervalDays: 30,
        upc: '019200192002'
      }
    ];

    console.log('\n📦 Creating mock items...');
    for (const itemData of mockItems) {
      const item = await prisma.item.create({
        data: {
          userId: user.id,
          ...itemData
        }
      });

      // Create mock prices for each item (3 retailers)
      const basePrice = itemData.lastPaidPrice;
      const prices = [
        {
          itemId: item.id,
          retailer: 'Amazon',
          price: basePrice * 0.92, // 8% cheaper
          url: `https://amazon.com/dp/MOCK${item.id}`,
          date: new Date()
        },
        {
          itemId: item.id,
          retailer: 'Walmart',
          price: basePrice * 0.95, // 5% cheaper
          url: `https://walmart.com/ip/MOCK${item.id}`,
          date: new Date()
        },
        {
          itemId: item.id,
          retailer: 'Staples',
          price: basePrice * 1.03, // 3% more expensive
          url: `https://staples.com/product/MOCK${item.id}`,
          date: new Date()
        }
      ];

      await prisma.price.createMany({ data: prices });

      // Create alert for items with good savings
      const savingsPercent = (basePrice - prices[0].price) / basePrice;
      if (savingsPercent > 0.05) {
        const savingsPerOrder = basePrice - prices[0].price;
        const monthlyOrders = 30 / itemData.reorderIntervalDays;
        const estimatedMonthlySavings = savingsPerOrder * monthlyOrders;

        await prisma.alert.create({
          data: {
            userId: user.id,
            itemId: item.id,
            retailer: prices[0].retailer,
            oldPrice: basePrice,
            newPrice: prices[0].price,
            savingsPerOrder,
            estimatedMonthlySavings,
            url: prices[0].url,
            viewed: false,
            alertDate: new Date()
          }
        });
        console.log(`   🔔 Alert created for ${item.name} (${(savingsPercent * 100).toFixed(1)}% savings)`);
      }

      console.log(`   ✅ ${item.name}`);
    }

    // Create savings summary
    const alerts = await prisma.alert.findMany({
      where: { userId: user.id }
    });
    const totalMonthlySavings = alerts.reduce((sum, a) => sum + a.estimatedMonthlySavings, 0);

    await prisma.savingsSummary.create({
      data: {
        userId: user.id,
        monthlyTotal: totalMonthlySavings,
        yearToDate: totalMonthlySavings,
        lastCalculated: new Date()
      }
    });

    console.log(`\n💰 Savings summary created: $${totalMonthlySavings.toFixed(2)}/month`);
    console.log(`\n✅ Mock data loaded successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Items: ${mockItems.length}`);
    console.log(`   - Prices: ${mockItems.length * 3}`);
    console.log(`   - Alerts: ${alerts.length}`);
    console.log(`   - Estimated Monthly Savings: $${totalMonthlySavings.toFixed(2)}`);
    console.log(`\n🔐 Test Login:`);
    console.log(`   Email: mockuser@procuroapp.com`);
    console.log(`\n👉 Open http://localhost:5173/dashboard to view mock data\n`);

  } catch (error) {
    console.error('❌ Error loading mock data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  loadMockData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { loadMockData };

