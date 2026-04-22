import prisma from '../lib/prisma';
import appConfig from '../../../config/app.json';

const RETAILERS = ['officeDepot', 'staples', 'costco', 'amazon'];

/**
 * Generate simulated price drops for monitored items in test mode
 * Creates realistic alerts with random price drops between 5-40%
 */
export async function generateSimulatedPriceDrops(companyId: number): Promise<number> {
  try {
    // Get all monitored items for this company (exclude vague items)
    const items = await prisma.item.findMany({
      where: {
        user: {
          companyId: companyId,
        },
        isMonitored: true,
        needsClarification: false, // Exclude vague items that cannot be monitored
      },
      include: {
        user: true,
      },
    });

    if (items.length === 0) {
      console.log(`⚠️ No monitored items found for company ${companyId}`);
      return 0;
    }

    console.log(`🎲 Generating simulated price drops for ${items.length} monitored items...`);

    let alertsCreated = 0;

    for (const item of items) {
      // Random chance (20-40%) to generate an alert
      const chance = Math.random();
      if (chance > 0.3) {
        // 30% chance = 70% skip rate, so we want 20-40% chance
        // Let's use 30% chance (0.3 threshold)
        continue;
      }

      // Use baselineUnitPrice for savings (sticky baseline)
      const baseline = (item.baselineUnitPrice != null && item.baselineUnitPrice > 0)
        ? item.baselineUnitPrice
        : (item.baselinePrice && item.baselinePrice > 0) ? item.baselinePrice : item.lastPaidPrice;
      if (baseline <= 0) continue;

      // Random price drop between 5-40%
      const priceDropPercent = 0.05 + Math.random() * 0.35; // 5% to 40%
      const newPrice = baseline * (1 - priceDropPercent);
      const priceDrop = baseline - newPrice;

      // Random retailer
      const retailer = RETAILERS[Math.floor(Math.random() * RETAILERS.length)];

      // Calculate savings
      const estimatedMonthlyUnits = item.estimatedMonthlyUnits || 1;
      const savingsPerOrder = priceDrop;
      const estimatedMonthlySavings = priceDrop * estimatedMonthlyUnits;

      // Only create alert if savings meet minimum threshold (default 5% = 0.05)
      const priceDropThreshold = (appConfig.pricing?.priceDropThreshold as number) || 0.05;
      if (priceDropPercent >= priceDropThreshold) {
        // Check if we already have a recent alert for this item (avoid duplicates)
        const recentAlert = await prisma.alert.findFirst({
          where: {
            itemId: item.id,
            retailer: retailer,
            alertDate: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        });

        if (!recentAlert) {
          // Create the alert
          const companyId = item.companyId ?? item.user.companyId;
          if (companyId == null) continue;
          await prisma.alert.create({
            data: {
              userId: item.userId,
              itemId: item.id,
              companyId,
              retailer: retailer,
              oldPrice: baseline,
              newPrice: newPrice,
              priceDropAmount: priceDrop,
              savingsPerOrder: savingsPerOrder,
              estimatedMonthlySavings: estimatedMonthlySavings,
              url: `https://${retailer}.com/product/${item.id}`,
              viewed: false,
              alertDate: new Date(),
            },
          });

          await prisma.price.create({
            data: {
              itemId: item.id,
              companyId,
              retailer: retailer,
              price: newPrice,
              url: `https://${retailer}.com/product/${item.id}`,
              date: new Date(),
            },
          });

          const { storePriceHistory } = await import('./priceHistory');
          await storePriceHistory(item.id, companyId, newPrice, retailer);

          console.log(`✅ Simulated alert: ${item.name} - ${retailer} - $${item.lastPaidPrice.toFixed(2)} → $${newPrice.toFixed(2)} (${(priceDropPercent * 100).toFixed(1)}% drop)`);
          alertsCreated++;
        }
      }
    }

    console.log(`✅ Generated ${alertsCreated} simulated price drop alerts`);
    return alertsCreated;
  } catch (error) {
    console.error('Error generating simulated price drops:', error);
    throw error;
  }
}

