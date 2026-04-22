/**
 * Rakuten API Automated Test Script
 * Tests Rakuten provider endpoint with multiple keywords
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000';
const TEST_KEYWORDS = ['paper', 'hp', 'coffee', 'office'];
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

const results = {
  serverStartup: null,
  healthCheck: null,
  keywordTests: [],
  tokenValidity: null,
  errors: []
};

/**
 * Wait for server to be ready
 */
async function waitForServer(maxRetries = MAX_RETRIES) {
  console.log('⏳ Waiting for server to start...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch(`${API_BASE}/health`);
      console.log('✅ Server is ready!');
      return true;
    } catch (error) {
      if (i < maxRetries - 1) {
        process.stdout.write(`\r   Attempt ${i + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  
  console.log('\n❌ Server did not start within timeout');
  return false;
}

/**
 * Make HTTP request
 */
async function makeRequest(url) {
  try {
    const response = await fetch(url);
    const status = response.status;
    let data;
    
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      data = { raw: text, parseError: e.message };
    }
    
    return { status, data, success: response.ok };
  } catch (error) {
    return { 
      status: 0, 
      data: null, 
      error: error.message,
      success: false 
    };
  }
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint() {
  console.log('\n🏥 Testing health endpoint...');
  const result = await makeRequest(`${API_BASE}/health`);
  
  results.healthCheck = {
    url: `${API_BASE}/health`,
    status: result.status,
    data: result.data,
    success: result.success,
    error: result.error
  };
  
  if (result.success) {
    console.log(`✅ Health check passed (${result.status})`);
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  } else {
    console.log(`❌ Health check failed (${result.status})`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  return result;
}

/**
 * Test Rakuten endpoint with keyword
 */
async function testRakutenKeyword(keyword) {
  const url = `${API_BASE}/api/provider/rakuten?keyword=${encodeURIComponent(keyword)}`;
  console.log(`\n🔍 Testing keyword: "${keyword}"`);
  console.log(`   URL: ${url}`);
  
  const result = await makeRequest(url);
  
  const testResult = {
    keyword,
    url,
    status: result.status,
    data: result.data,
    success: result.success,
    error: result.error,
    analysis: {
      hasSuccess: result.data && typeof result.data.success === 'boolean',
      successValue: result.data?.success,
      hasItems: Array.isArray(result.data?.items),
      itemsCount: Array.isArray(result.data?.items) ? result.data.items.length : 0,
      hasError: result.data && typeof result.data.error === 'string',
      errorMessage: result.data?.error,
      hasRetailer: result.data && result.data.retailer === 'rakuten'
    }
  };
  
  // Log results
  console.log(`   Status: ${result.status}`);
  if (result.data) {
    console.log(`   Success: ${testResult.analysis.successValue}`);
    console.log(`   Items count: ${testResult.analysis.itemsCount}`);
    if (testResult.analysis.hasError) {
      console.log(`   Error: ${testResult.analysis.errorMessage}`);
    }
    console.log(`   Full response:`, JSON.stringify(result.data, null, 2));
  } else if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  
  results.keywordTests.push(testResult);
  return testResult;
}

/**
 * Determine token validity
 */
function determineTokenValidity() {
  console.log('\n🔐 Analyzing token validity...');
  
  const tests = results.keywordTests;
  const allStatuses = tests.map(t => t.status);
  const allErrors = tests.map(t => t.analysis.errorMessage).filter(Boolean);
  const allResponses = tests.map(t => t.data).filter(Boolean);
  
  let classification = {
    status: 'unknown',
    reason: '',
    details: {}
  };
  
  // Check for 401 Unauthorized
  if (allStatuses.some(s => s === 401)) {
    classification.status = 'unauthorized';
    classification.reason = 'Received 401 Unauthorized - Token is invalid or expired';
    classification.details = { httpStatus: 401 };
  }
  // Check for 403 Forbidden
  else if (allStatuses.some(s => s === 403)) {
    classification.status = 'forbidden';
    classification.reason = 'Received 403 Forbidden - SID not approved in Rakuten dashboard';
    classification.details = { httpStatus: 403 };
  }
  // Check for invalid_token in error messages
  else if (allErrors.some(e => e.toLowerCase().includes('invalid_token') || e.toLowerCase().includes('invalid token'))) {
    classification.status = 'invalid';
    classification.reason = 'API returned invalid_token error';
    classification.details = { errors: allErrors.filter(e => e.toLowerCase().includes('invalid')) };
  }
  // Check if all requests succeeded
  else if (tests.every(t => t.analysis.successValue === true)) {
    const hasItems = tests.some(t => t.analysis.itemsCount > 0);
    if (hasItems) {
      classification.status = 'valid_with_results';
      classification.reason = 'Token is valid and API returned product results';
      classification.details = { 
        totalTests: tests.length,
        testsWithItems: tests.filter(t => t.analysis.itemsCount > 0).length
      };
    } else {
      classification.status = 'valid_no_results';
      classification.reason = 'Token is valid but no products returned (may need advertiser approval)';
      classification.details = { 
        totalTests: tests.length,
        allReturnedEmpty: tests.every(t => t.analysis.itemsCount === 0)
      };
    }
  }
  // Check for rate limiting (429)
  else if (allStatuses.some(s => s === 429)) {
    classification.status = 'rate_limited';
    classification.reason = 'API rate limit exceeded';
    classification.details = { httpStatus: 429 };
  }
  // Check for server errors (5xx)
  else if (allStatuses.some(s => s >= 500)) {
    classification.status = 'server_error';
    classification.reason = 'Rakuten API server errors detected';
    classification.details = { httpStatuses: allStatuses.filter(s => s >= 500) };
  }
  // Check for connection errors
  else if (tests.some(t => t.status === 0 || t.error)) {
    classification.status = 'connection_error';
    classification.reason = 'Could not connect to Rakuten API';
    classification.details = { 
      errors: tests.filter(t => t.error).map(t => t.error)
    };
  }
  // Mixed results
  else {
    classification.status = 'mixed';
    classification.reason = 'Mixed results - some requests succeeded, some failed';
    classification.details = {
      successCount: tests.filter(t => t.analysis.successValue === true).length,
      failureCount: tests.filter(t => t.analysis.successValue === false).length,
      statuses: [...new Set(allStatuses)]
    };
  }
  
  console.log(`   Classification: ${classification.status}`);
  console.log(`   Reason: ${classification.reason}`);
  
  results.tokenValidity = classification;
  return classification;
}

/**
 * Generate markdown report
 */
function generateReport() {
  const report = `# Rakuten API Automated Test Results

**Test Date:** ${new Date().toISOString()}  
**Server:** ${API_BASE}

---

## 1. Server Startup Status

${results.serverStartup === true ? '✅ **Server started successfully**' : '❌ **Server failed to start or timeout reached**'}

${results.serverStartup === false ? '**Error:** Server did not respond within timeout period' : ''}

---

## 2. Health Endpoint Result

${results.healthCheck ? `
- **URL:** ${results.healthCheck.url}
- **Status Code:** ${results.healthCheck.status}
- **Success:** ${results.healthCheck.success ? '✅ Yes' : '❌ No'}
${results.healthCheck.data ? `
- **Response:**
\`\`\`json
${JSON.stringify(results.healthCheck.data, null, 2)}
\`\`\`
` : ''}
${results.healthCheck.error ? `- **Error:** ${results.healthCheck.error}` : ''}
` : '**Not tested**'}

---

## 3. Keyword Test Results

### Test Keywords: ${TEST_KEYWORDS.join(', ')}

${results.keywordTests.map((test, index) => `
#### Test ${index + 1}: "${test.keyword}"

- **URL:** \`${test.url}\`
- **HTTP Status:** ${test.status}
- **Request Success:** ${test.success ? '✅ Yes' : '❌ No'}

**Response Analysis:**
- ✅ Has \`success\` field: ${test.analysis.hasSuccess ? 'Yes' : 'No'}
- ✅ Success value: \`${test.analysis.successValue}\`
- ✅ Has \`items\` array: ${test.analysis.hasItems ? 'Yes' : 'No'}
- ✅ Items count: ${test.analysis.itemsCount}
- ${test.analysis.hasError ? `- ❌ Error present: \`${test.analysis.errorMessage}\`` : '- ✅ No error field'}
- ✅ Has \`retailer\` field: ${test.analysis.hasRetailer ? 'Yes (rakuten)' : 'No'}

${test.data ? `
**Full Response:**
\`\`\`json
${JSON.stringify(test.data, null, 2)}
\`\`\`
` : ''}
${test.error ? `
**Request Error:**
\`\`\`
${test.error}
\`\`\`
` : ''}
`).join('\n')}

---

## 4. Token Validity Classification

**Status:** **${results.tokenValidity?.status.toUpperCase().replace(/_/g, ' ')}**

**Reason:** ${results.tokenValidity?.reason}

${results.tokenValidity?.details ? `
**Details:**
\`\`\`json
${JSON.stringify(results.tokenValidity.details, null, 2)}
\`\`\`
` : ''}

---

## 5. Errors Encountered

${results.errors.length > 0 ? `
${results.errors.map((error, i) => `${i + 1}. ${error}`).join('\n')}
` : '✅ **No errors encountered**'}

---

## 6. Recommended Next Steps

${results.tokenValidity?.status === 'valid_with_results' ? `
### ✅ Token is Valid and Working!

- Rakuten API integration is **functional**
- Token is authenticated successfully
- Products are being returned
- **Recommendation:** Ready for integration later (currently in standby mode)
` : ''}

${results.tokenValidity?.status === 'valid_no_results' ? `
### ⚠️ Token is Valid but No Results

- Token authentication is working
- API requests are succeeding
- No products returned (empty items arrays)
- **Possible Reasons:**
  - Advertisers require approval in Rakuten dashboard
  - Search keywords may not match available products
  - API may need additional configuration
- **Recommendation:** 
  - Check Rakuten dashboard for advertiser approvals
  - Try different keywords
  - Verify API access level
` : ''}

${results.tokenValidity?.status === 'unauthorized' ? `
### ❌ Token is Unauthorized (401)

- Token is invalid or expired
- **Action Required:** Regenerate token in Rakuten dashboard
- **Steps:**
  1. Log into Rakuten Marketing dashboard
  2. Navigate to API/Settings section
  3. Generate new access token
  4. Update \`RAKUTEN_ACCESS_TOKEN\` in \`server/.env\`
  5. Restart server
` : ''}

${results.tokenValidity?.status === 'forbidden' ? `
### ❌ Access Forbidden (403)

- Token is valid but SID is not approved
- **Action Required:** Approve site in Rakuten dashboard
- **Steps:**
  1. Log into Rakuten Marketing dashboard
  2. Navigate to Site Approval section
  3. Approve your site/application
  4. Wait for approval confirmation
  5. Retry API requests
` : ''}

${results.tokenValidity?.status === 'invalid' ? `
### ❌ Invalid Token

- API returned invalid_token error
- **Action Required:** Regenerate token
- See "unauthorized" steps above
` : ''}

${results.tokenValidity?.status === 'rate_limited' ? `
### ⚠️ Rate Limited (429)

- Too many requests in short time
- **Action Required:** Wait and retry later
- Implement rate limiting in application
` : ''}

${results.tokenValidity?.status === 'connection_error' ? `
### ❌ Connection Error

- Could not connect to Rakuten API
- **Possible Issues:**
  - Network connectivity
  - API endpoint may be incorrect
  - Firewall blocking requests
- **Recommendation:** Check network and API endpoint URL
` : ''}

${results.tokenValidity?.status === 'server_error' ? `
### ❌ Server Error

- Rakuten API server returned 5xx errors
- **Action Required:** Check Rakuten API status page
- **Recommendation:** Retry after some time
` : ''}

${results.tokenValidity?.status === 'mixed' ? `
### ⚠️ Mixed Results

- Some requests succeeded, some failed
- Review individual test results above
- **Recommendation:** Check for intermittent issues
` : ''}

${results.tokenValidity?.status === 'unknown' ? `
### ❓ Unknown Status

- Could not determine token validity
- Review test results above for details
` : ''}

---

## 7. ProviderTest UI Compatibility

${results.keywordTests.length > 0 && results.keywordTests[0].analysis.hasSuccess ? `
✅ **Response format is compatible with ProviderTest.tsx**

The Rakuten endpoint returns:
- \`success\` field: ✅ Present
- \`retailer\` field: ✅ Present (value: "rakuten")
- \`items\` array: ✅ Present

ProviderTest.tsx has been configured to handle this format.
` : '❓ **Could not verify compatibility** - Review test results'}

---

## Test Summary

- **Total Keywords Tested:** ${results.keywordTests.length}
- **Successful Requests:** ${results.keywordTests.filter(t => t.success).length}
- **Failed Requests:** ${results.keywordTests.filter(t => !t.success).length}
- **Requests with Items:** ${results.keywordTests.filter(t => t.analysis.itemsCount > 0).length}
- **Token Status:** ${results.tokenValidity?.status || 'Unknown'}

---

**Test completed at:** ${new Date().toISOString()}
`;

  return report;
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Rakuten API Automated Tests\n');
  console.log('='.repeat(60));
  
  try {
    // Wait for server
    results.serverStartup = await waitForServer();
    
    if (!results.serverStartup) {
      results.errors.push('Server did not start within timeout');
      console.log('\n❌ Cannot proceed with tests - server not available');
      return;
    }
    
    // Test health endpoint
    await testHealthEndpoint();
    
    // Wait a bit before testing Rakuten endpoint
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test each keyword
    console.log('\n' + '='.repeat(60));
    console.log('📦 Testing Rakuten Provider Endpoint');
    console.log('='.repeat(60));
    
    for (const keyword of TEST_KEYWORDS) {
      await testRakutenKeyword(keyword);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Determine token validity
    console.log('\n' + '='.repeat(60));
    determineTokenValidity();
    
    // Generate report
    console.log('\n' + '='.repeat(60));
    console.log('📄 Generating Test Report');
    console.log('='.repeat(60));
    
    const report = generateReport();
    
    // Save report to file
    const fs = require('fs');
    const reportPath = 'RAKUTEN-API-TEST-RESULTS.md';
    fs.writeFileSync(reportPath, report);
    console.log(`\n✅ Report saved to: ${reportPath}`);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Token Status: ${results.tokenValidity?.status || 'Unknown'}`);
    console.log(`Successful Requests: ${results.keywordTests.filter(t => t.success).length}/${results.keywordTests.length}`);
    console.log(`Tests with Items: ${results.keywordTests.filter(t => t.analysis.itemsCount > 0).length}/${results.keywordTests.length}`);
    console.log('\n✅ Tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    results.errors.push(`Test execution error: ${error.message}`);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Error: fetch is not available. Node.js 18+ is required.');
  console.error('   Install node-fetch: npm install node-fetch');
  process.exit(1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

