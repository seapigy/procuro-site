// Security Testing Script for Procuro
// Tests public access and blocked paths

const http = require('http');

const BASE_URL = 'http://localhost:5000';

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function testUrl(path, expectedStatus, description) {
  return new Promise((resolve) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      const passed = res.statusCode === expectedStatus;
      const icon = passed ? '✅' : '❌';
      const color = passed ? colors.green : colors.red;
      
      console.log(`${color}${icon} ${description}${colors.reset}`);
      console.log(`   Path: ${path}`);
      console.log(`   Expected: ${expectedStatus}, Got: ${res.statusCode}`);
      console.log('');
      
      resolve({ path, passed, expected: expectedStatus, actual: res.statusCode });
    }).on('error', (err) => {
      console.log(`${colors.red}❌ ${description}${colors.reset}`);
      console.log(`   Path: ${path}`);
      console.log(`   Error: ${err.message}`);
      console.log('');
      
      resolve({ path, passed: false, error: err.message });
    });
  });
}

async function runTests() {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     PROCURO SECURITY VERIFICATION TESTS          ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  
  const results = [];
  
  // Test 1: Public Pages (should return 200)
  console.log(`${colors.yellow}📄 Testing Public Pages (Expected: 200 OK)${colors.reset}`);
  console.log('─'.repeat(50));
  console.log('');
  
  results.push(await testUrl('/', 200, 'Landing page'));
  results.push(await testUrl('/support', 200, 'Support page'));
  results.push(await testUrl('/privacy', 200, 'Privacy policy'));
  results.push(await testUrl('/terms', 200, 'Terms of use'));
  results.push(await testUrl('/health', 200, 'Health check'));
  
  // Test 2: Blocked Paths (should return 403)
  console.log(`${colors.yellow}🔒 Testing Blocked Paths (Expected: 403 Forbidden)${colors.reset}`);
  console.log('─'.repeat(50));
  console.log('');
  
  results.push(await testUrl('/server/src/index.ts', 403, 'Server source code'));
  results.push(await testUrl('/jobs/dailyCheck.ts', 403, 'Background jobs'));
  results.push(await testUrl('/providers/amazon.ts', 403, 'API providers'));
  results.push(await testUrl('/db/schema.prisma', 403, 'Database schema'));
  results.push(await testUrl('/.env', 403, 'Environment variables'));
  results.push(await testUrl('/prisma/schema.prisma', 403, 'Prisma schema'));
  results.push(await testUrl('/node_modules/express', 403, 'Node modules'));
  results.push(await testUrl('/.git/config', 403, 'Git repository'));
  results.push(await testUrl('/src/index.ts', 403, 'Source code'));
  
  // Test 3: API Endpoints (should return 200 or auth-related status)
  console.log(`${colors.yellow}📡 Testing API Endpoints${colors.reset}`);
  console.log('─'.repeat(50));
  console.log('');
  
  results.push(await testUrl('/api/items', 200, 'Items API endpoint'));
  results.push(await testUrl('/api/alerts', 200, 'Alerts API endpoint'));
  
  // Summary
  console.log('');
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║                 TEST SUMMARY                      ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
  
  if (failed > 0) {
    console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
    console.log('');
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${colors.red}• ${r.path}${colors.reset}`);
    });
  }
  
  console.log('');
  
  if (failed === 0) {
    console.log(`${colors.green}╔═══════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}║   ✅ ALL TESTS PASSED - SECURITY VERIFIED! ✅     ║${colors.reset}`);
    console.log(`${colors.green}╚═══════════════════════════════════════════════════╝${colors.reset}`);
  } else {
    console.log(`${colors.red}╔═══════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.red}║      ⚠️  SOME TESTS FAILED - REVIEW NEEDED        ║${colors.reset}`);
    console.log(`${colors.red}╚═══════════════════════════════════════════════════╝${colors.reset}`);
  }
  
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
console.log('Checking if server is running...');
http.get(`${BASE_URL}/health`, (res) => {
  console.log(`${colors.green}✅ Server is running on ${BASE_URL}${colors.reset}`);
  console.log('');
  setTimeout(runTests, 500);
}).on('error', () => {
  console.log(`${colors.red}❌ Server is not running on ${BASE_URL}${colors.reset}`);
  console.log('');
  console.log('Please start the server first:');
  console.log(`  ${colors.blue}cd server${colors.reset}`);
  console.log(`  ${colors.blue}npm run dev${colors.reset}`);
  console.log('');
  process.exit(1);
});

