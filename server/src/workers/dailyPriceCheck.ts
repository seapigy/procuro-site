import cron from 'node-cron';
import prisma from '../lib/prisma';
import appConfig from '../../../config/app.json';

/**
 * Daily price check worker
 * Runs every night at configured time (default 3 AM)
 */

let isRunning = false;

export async function runDailyPriceCheck() {
  if (isRunning) {
    console.log('⏸️  Daily price check already running, skipping...');
    return;
  }

  // Check if auto-check is enabled in config
  if (!appConfig.features.enableDailyPriceCheck) {
    console.log('⏸️  Daily price check disabled in config, skipping...');
    return;
  }

  isRunning = true;
  const startTime = new Date();
  console.log(`\n🔍 Starting daily price check at ${startTime.toISOString()}`);

  try {
    // Get all items with user information
    const items = await prisma.item.findMany({
      include: {
        user: true,
        prices: {
          orderBy: { date: 'desc' },
          take: 1
        }
      }
    });

    console.log(`📦 Found ${items.length} items to check`);

    let checkedCount = 0;
    let alertsCreated = 0;
    let errors = 0;

    // Check each item
    for (const item of items) {
      try {
        // Get most recent price
        const lastPrice = item.prices[0];
        
        if (!lastPrice) {
          console.log(`⚠️  No price data for item: ${item.name}`);
          continue;
        }

        const lastKnownPrice = lastPrice.price;
        const priceDrop = item.lastPaidPrice - lastKnownPrice;
        const priceDropPercent = priceDrop / item.lastPaidPrice;

        // Check if price drop exceeds threshold
        if (priceDropPercent >= appConfig.pricing.priceDropThreshold) {
          // Create alert
          const alert = await prisma.alert.createMany({
            data: {
              userId: item.userId,
              itemId: item.id,
              retailer: lastPrice.retailer,
              oldPrice: item.lastPaidPrice,
              newPrice: lastKnownPrice,
              savingsPerOrder: priceDrop,
              estimatedMonthlySavings: priceDrop * (30 / (item.reorderIntervalDays || 30)),
              url: lastPrice.url,
              viewed: false,
              alertDate: new Date()
            }
          });

          alertsCreated++;
          console.log(`✅ Alert created for ${item.name}: ${item.lastPaidPrice} → ${lastKnownPrice} (${(priceDropPercent * 100).toFixed(1)}% drop)`);

          // Update savings summary for user
          await updateSavingsSummary(item.userId, priceDrop);
        }

        checkedCount++;
      } catch (error) {
        console.error(`Error checking item ${item.id}:`, error);
        errors++;
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log(`\n✅ Daily price check completed in ${duration}s`);
    console.log(`   📊 Items checked: ${checkedCount}`);
    console.log(`   🔔 Alerts created: ${alertsCreated}`);
    console.log(`   ❌ Errors: ${errors}`);

  } catch (error) {
    console.error('❌ Daily price check failed:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Update savings summary for a user
 */
async function updateSavingsSummary(userId: number, savingsAmount: number) {
  try {
    const existing = await prisma.savingsSummary.findFirst({
      where: { userId }
    });

    if (existing) {
      await prisma.savingsSummary.update({
        where: { id: existing.id },
        data: {
          monthlyTotal: {
            increment: savingsAmount
          },
          lastCalculated: new Date()
        }
      });
    } else {
      await prisma.savingsSummary.create({
        data: {
          userId,
          monthlyTotal: savingsAmount,
          yearToDate: savingsAmount,
          lastCalculated: new Date()
        }
      });
    }
  } catch (error) {
    console.error('Error updating savings summary:', error);
  }
}

/**
 * Start the daily price check cron job
 */
export function startDailyPriceCheckCron() {
  if (!appConfig.features.enableDailyPriceCheck) {
    console.log('⏸️  Daily price check disabled in config');
    return;
  }

  const cronExpression = appConfig.scheduling.priceCheckCron || '0 3 * * *';
  
  cron.schedule(cronExpression, () => {
    console.log(`\n⏰ Triggered scheduled price check (${new Date().toISOString()})`);
    runDailyPriceCheck();
  });

  console.log(`✅ Daily price check scheduled: ${cronExpression} (${appConfig.scheduling.priceCheckTime})`);
}

