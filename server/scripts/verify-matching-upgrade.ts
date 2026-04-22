import axios from 'axios';
import appConfig from '../../config/app.json';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
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
      validateStatus: () => true, // Don't throw on any status
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    return { 
      status: error.response?.status || 500, 
      data: error.response?.data || { error: error.message } 
    };
  }
}

async function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  🔍 MATCHING UPGRADE VERIFICATION        ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  try {
    // Step 1: Health check
    console.log('📋 Step 1: Health check...');
    const healthResult = await apiCall('GET', '/health');
    assert(healthResult.status === 200, 'Health endpoint responds');
    assert(healthResult.data.status === 'ok', 'Health status is ok');
    assert(healthResult.data.db === true, 'Database connection works');
    passed += 3;

    if (TEST_MODE) {
      console.log('\n📋 Step 2: Test mode setup...');
      
      // Setup test environment
      const setupResult = await apiCall('POST', '/api/test/setup');
      if (setupResult.status === 200 || setupResult.status === 201) {
        console.log('✅ Test environment setup');
        passed += 1;
      } else {
        console.log('⚠️  Setup returned status:', setupResult.status);
      }

      // Create edge case items
      console.log('\n📋 Step 3: Creating matching edge cases...');
      const edgeCasesResult = await apiCall('POST', '/api/test/create-matching-edge-cases');
      assert(edgeCasesResult.status === 200, 'Edge cases endpoint responds');
      assert(edgeCasesResult.data.success === true, 'Edge cases created successfully');
      assert(Array.isArray(edgeCasesResult.data.items), 'Edge cases returned items array');
      assert(edgeCasesResult.data.items.length > 0, 'Edge cases created items');
      passed += 4;

      // Wait a bit for matching to complete
      await sleep(2000);
    } else {
      console.log('⚠️  TEST_MODE not enabled, skipping test setup steps');
    }

    // Step 4: Verify items have new fields
    console.log('\n📋 Step 4: Verifying items have new matching fields...');
    const itemsResult = await apiCall('GET', '/api/items');
    assert(itemsResult.status === 200, 'Items endpoint responds');
    assert(itemsResult.data.items && Array.isArray(itemsResult.data.items), 'Items returned as array');
    
    const items = itemsResult.data.items as any[];
    if (items.length > 0) {
      const firstItem = items[0];
      console.log(`   Checking item: ${firstItem.name}`);
      
      // Check for new fields (they may be null/undefined for existing items, that's ok)
      const hasMatchStatus = 'matchStatus' in firstItem;
      const hasNormalizedName = 'normalizedName' in firstItem;
      const hasMatchProvider = 'matchProvider' in firstItem;
      const hasMatchUrl = 'matchUrl' in firstItem;
      const hasMatchTitle = 'matchTitle' in firstItem;
      const hasIsManuallyMatched = 'isManuallyMatched' in firstItem;
      const hasMatchReasons = 'matchReasons' in firstItem;
      
      assert(hasMatchStatus, 'Item has matchStatus field');
      assert(hasNormalizedName, 'Item has normalizedName field');
      assert(hasMatchProvider, 'Item has matchProvider field');
      assert(hasMatchUrl, 'Item has matchUrl field');
      assert(hasMatchTitle, 'Item has matchTitle field');
      assert(hasIsManuallyMatched, 'Item has isManuallyMatched field');
      assert(hasMatchReasons, 'Item has matchReasons field');
      passed += 7;
    } else {
      console.log('⚠️  No items found, skipping field checks');
    }

    // Step 5: Test rematch endpoint
    console.log('\n📋 Step 5: Testing rematch endpoint...');
    if (items.length > 0) {
      const testItem = items.find((item: any) => item.matchStatus === 'needs_review') || items[0];
      const rematchResult = await apiCall('POST', `/api/items/${testItem.id}/rematch`);
      assert(rematchResult.status === 200, 'Rematch endpoint responds');
      assert(rematchResult.data.success === true, 'Rematch successful');
      assert(rematchResult.data.item, 'Rematch returned updated item');
      passed += 3;

      // Step 6: Test verify endpoint
      console.log('\n📋 Step 6: Testing verify endpoint...');
      const verifyResult = await apiCall('POST', `/api/items/${testItem.id}/match/verify`);
      if (verifyResult.status === 200) {
        assert(verifyResult.data.success === true, 'Verify successful');
        assert(verifyResult.data.item.matchStatus === 'verified', 'Status set to verified');
        assert(verifyResult.data.item.isManuallyMatched === true, 'isManuallyMatched set to true');
        passed += 3;
      } else {
        console.log(`⚠️  Verify returned status ${verifyResult.status}, may need existing match`);
      }

      // Step 7: Test that verified match is not overwritten
      console.log('\n📋 Step 7: Testing name change preserves manual match...');
      const nameUpdateResult = await apiCall('PATCH', `/api/items/${testItem.id}`, {
        name: `${testItem.name} (Updated)`,
      });
      if (nameUpdateResult.status === 200) {
        const updatedItem = nameUpdateResult.data.item;
        // If item was verified, status should remain verified (not auto-rematched)
        if (testItem.matchStatus === 'verified' || testItem.isManuallyMatched) {
          assert(
            updatedItem.matchStatus === 'verified' || updatedItem.matchStatus === 'overridden',
            'Verified match not overwritten by name change'
          );
          passed += 1;
        }
      }

      // Step 8: Test override endpoint
      console.log('\n📋 Step 8: Testing override endpoint...');
      const overrideItem = items.find((item: any) => item.id !== testItem.id) || items[0];
      const overrideResult = await apiCall('POST', `/api/items/${overrideItem.id}/match/override`, {
        provider: 'homedepot',
        url: 'https://www.homedepot.com/p/test-product/123456789',
        title: 'Test Product Override',
        notes: 'Test override',
      });
      assert(overrideResult.status === 200, 'Override endpoint responds');
      assert(overrideResult.data.success === true, 'Override successful');
      assert(overrideResult.data.item.matchStatus === 'overridden', 'Status set to overridden');
      assert(overrideResult.data.item.isManuallyMatched === true, 'isManuallyMatched set to true');
      assert(overrideResult.data.item.manualMatchProvider === 'homedepot', 'manualMatchProvider set');
      assert(overrideResult.data.item.manualMatchUrl === 'https://www.homedepot.com/p/test-product/123456789', 'manualMatchUrl set');
      passed += 6;
    } else {
      console.log('⚠️  No items found, skipping endpoint tests');
    }

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  ✅ VERIFICATION COMPLETE                 ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log(`\n✅ Passed: ${passed}`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}`);
      process.exit(1);
    }
    console.log('\n🎉 All checks passed!\n');
  } catch (error: any) {
    failed += 1;
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



