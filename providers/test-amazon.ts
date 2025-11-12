/**
 * Test script for Amazon Provider
 * Run with: tsx providers/test-amazon.ts
 */

import dotenv from 'dotenv';
import { AmazonProvider } from './amazon';

// Load environment variables from server/.env
dotenv.config({ path: './server/.env' });

async function testAmazonProvider() {
  console.log('🧪 Testing Amazon Product Advertising API v5\n');

  // Check if credentials are set
  if (!process.env.AMAZON_ACCESS_KEY || !process.env.AMAZON_SECRET_KEY) {
    console.error('❌ Error: AMAZON_ACCESS_KEY and AMAZON_SECRET_KEY must be set in .env');
    console.log('\nPlease add to server/.env:');
    console.log('AMAZON_ACCESS_KEY=your_access_key');
    console.log('AMAZON_SECRET_KEY=your_secret_key');
    console.log('AMAZON_REGION=us-east-1');
    return;
  }

  const provider = new AmazonProvider({
    accessKey: process.env.AMAZON_ACCESS_KEY,
    secretKey: process.env.AMAZON_SECRET_KEY,
    region: process.env.AMAZON_REGION || 'us-east-1',
  });

  try {
    console.log('Testing keyword search: "HP Printer Paper 500 Sheets"\n');
    const result = await provider.getPriceByKeyword('HP Printer Paper 500 Sheets');
    
    console.log('\n✅ Success! Result:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Price:  $${result.price.toFixed(2)}`);
    console.log(`Stock:  ${result.stock ? '✓ In Stock' : '✗ Out of Stock'}`);
    console.log(`URL:    ${result.url}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Full Result Object:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('\n❌ Test Failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      
      if (error.message.includes('404')) {
        console.log('\n💡 This is expected if the product is not found.');
      } else if (error.message.includes('credentials')) {
        console.log('\n💡 Check your Amazon API credentials in .env');
      } else if (error.message.includes('TooManyRequests')) {
        console.log('\n💡 Rate limit exceeded. Try again in a few minutes.');
      }
    } else {
      console.error(error);
    }
  }
}

// Run the test
testAmazonProvider();
