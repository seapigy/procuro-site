import prisma from '../src/lib/prisma';
import { recomputeMonitoringForCompany } from '../src/services/monitoring';
import { runDailyPriceCheck } from '../src/workers/dailyPriceCheck';
import appConfig from '../../config/app.json';
import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const TEST_MODE = process.env.TEST_MODE === 'true' || (appConfig.testing?.testMode as boolean) || false;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCall(method: string, endpoint: string, data?: any) {
  try {
    const response = await axios({
      method,
      url: `${API_BASE}${endpoint}`,
      data,
    });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  🧪 PROCURO E2E TEST RUNNER              ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  if (!TEST_MODE) {
    console.log('⚠️  TEST_MODE is not enabled. Set TEST_MODE=true in .env');
    console.log('   This script requires test mode to be active.\n');
    process.exit(1);
  }

  const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;

  try {
    // Step 1: Reset DB (clear test data)
    console.log('📋 Step 1: Resetting test database...');
    await prisma.alert.deleteMany({
      where: {
        item: {
          user: {
            companyId: testCompanyId,
          },
        },
      },
    });
    await prisma.price.deleteMany({
      where: {
        item: {
          user: {
            companyId: testCompanyId,
          },
        },
      },
    });
    await prisma.item.deleteMany({
      where: {
        user: {
          companyId: testCompanyId,
        },
      },
    });
    console.log('✅ Database reset complete\n');

    // Step 2: Create test user + company
    console.log('📋 Step 2: Creating test user and company...');
    const setupResult = await apiCall('POST', '/api/test/setup');
    console.log(`✅ Created: ${setupResult.company.name} (ID: ${setupResult.company.id})`);
    console.log(`   User: ${setupResult.user.email}\n`);

    // Step 3: Import sample QuickBooks data
    console.log('📋 Step 3: Importing sample QuickBooks purchase data...');
    const importResult = await apiCall('POST', '/api/test/import-sample-data');
    console.log(`✅ Imported ${importResult.totalItems} unique items`);
    console.log(`   Created: ${importResult.itemsCreated}, Updated: ${importResult.itemsUpdated}`);
    console.log(`   Monitored items: ${importResult.monitoredItems}\n`);

    // Step 4: Verify monitoring state
    console.log('📋 Step 4: Verifying monitoring state...');
    const status1 = await apiCall('GET', '/api/test/status');
    console.log(`✅ Company subscription: ${status1.company.isSubscribed ? 'Active' : 'Inactive'}`);
    console.log(`   Monitored items: ${status1.company.monitoredItemsCount}\n`);

    // Step 5: Simulate subscription
    console.log('📋 Step 5: Activating subscription (test mode)...');
    await apiCall('POST', '/api/test/force-subscribe');
    const status2 = await apiCall('GET', '/api/test/status');
    console.log(`✅ Subscription activated: ${status2.company.isSubscribed}\n`);

    // Step 6: Recompute monitoring (should work now that subscribed)
    console.log('📋 Step 6: Recomputing monitoring priorities...');
    const monitoringResult = await apiCall('POST', '/api/test/recompute-monitoring');
    console.log(`✅ Monitoring recalculated: ${monitoringResult.monitoredItems} items monitored\n`);

    // Step 7: Run price check cycle
    console.log('📋 Step 7: Running price check cycle...');
    const priceCheckResult = await apiCall('POST', '/api/test/run-price-check');
    console.log(`✅ Price check complete`);
    console.log(`   Total alerts: ${priceCheckResult.alertsCount}`);
    if (priceCheckResult.recentAlerts.length > 0) {
      console.log(`   Recent alerts:`);
      priceCheckResult.recentAlerts.slice(0, 3).forEach((alert: any) => {
        console.log(`     - ${alert.itemName}: $${alert.oldPrice.toFixed(2)} → $${alert.newPrice.toFixed(2)} (${alert.retailer})`);
      });
    }
    console.log('');

    // Step 8: Final verification
    console.log('📋 Step 8: Final verification...');
    const finalStatus = await apiCall('GET', '/api/test/status');
    console.log(`✅ Final State:`);
    console.log(`   Company: ${finalStatus.company.name} (ID: ${finalStatus.company.id})`);
    console.log(`   Subscription: ${finalStatus.company.isSubscribed ? '✅ Active' : '❌ Inactive'}`);
    console.log(`   Monitored Items: ${finalStatus.company.monitoredItemsCount}`);
    console.log(`   Total Alerts: ${priceCheckResult.alertsCount}`);
    console.log(`   Last Alert: ${finalStatus.company.lastAlertGenerated || 'None'}\n`);

    // Step 9: Test subscription toggle
    console.log('📋 Step 9: Testing subscription cancellation...');
    await apiCall('POST', '/api/test/force-unsubscribe');
    const unsubStatus = await apiCall('GET', '/api/test/status');
    console.log(`✅ Subscription cancelled: ${!unsubStatus.company.isSubscribed}\n`);

    console.log('╔═══════════════════════════════════════════╗');
    console.log('║  ✅ E2E TEST COMPLETE                    ║');
    console.log('╚═══════════════════════════════════════════╝\n');

    console.log('📝 MANUAL FRONTEND TESTING STEPS:');
    console.log('');
    console.log('1. Login Flow:');
    console.log('   - Open http://localhost:5173');
    console.log('   - Verify test user is logged in');
    console.log('');
    console.log('2. Dashboard Subscription Banner:');
    console.log('   - Should see "Free Plan" badge');
    console.log('   - Should see upgrade banner (if not subscribed)');
    console.log('   - Click "Upgrade" button → should open upgrade modal');
    console.log('');
    console.log('3. Items Gating:');
    console.log('   - Navigate to Items page');
    console.log('   - "Check Price" button should be disabled');
    console.log('   - Click disabled button → should open upgrade modal');
    console.log('   - Monitored badge should show "Locked"');
    console.log('');
    console.log('4. Manual "Check Price" Behavior:');
    console.log('   - In test admin panel, click "Force Subscribe"');
    console.log('   - Refresh Items page');
    console.log('   - "Check Price" button should now be enabled');
    console.log('   - Click button → should call backend API');
    console.log('');
    console.log('5. Reports Gating:');
    console.log('   - Navigate to Reports page');
    console.log('   - Should see upgrade banner');
    console.log('   - "Export CSV" should be disabled');
    console.log('');
    console.log('6. Settings → Billing Portal:');
    console.log('   - Navigate to Settings');
    console.log('   - If subscribed: Should see "Billing & Subscription" card');
    console.log('   - Click "Manage Billing" → should open Stripe Portal');
    console.log('   - (Note: In test mode, Stripe calls are simulated)');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Test Failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

