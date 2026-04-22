/**
 * Debug Amazon and Home Depot discovery providers directly.
 * Run: DISCOVERY_DEBUG=true npx tsx scripts/debug-discovery-providers.ts
 */
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

process.env.USE_MOCK_PROVIDER = 'false';
process.env.DISCOVERY_SIMULATE = 'false';
process.env.DISCOVERY_DEBUG = 'true';

const QUERY = 'HP Printer Paper 500 Sheets 8.5 x 11';

async function main() {
  console.log('=== DISCOVERY PROVIDER DEBUG ===\n');
  console.log('Query:', QUERY, '\n');

  // A) Amazon discovery
  console.log('--- A) AMAZON DISCOVERY ---\n');
  const { amazonBrightDataProvider } = await import('../src/providers/amazonBrightDataProvider');
  const amazonQuotes = await amazonBrightDataProvider.getQuotesForItem({
    companyId: 1,
    itemId: 999,
    name: QUERY,
  });
  console.log('\nAmazon result: quotes count=', amazonQuotes.length);
  if (amazonQuotes.length > 0) {
    console.log('Amazon quote:', JSON.stringify(amazonQuotes[0], null, 2));
  }

  // B) Home Depot discovery (Bright Data when HOMEDEPOT dataset configured)
  console.log('\n--- B) HOME DEPOT DISCOVERY ---\n');
  const { enabledRetailerProviders } = await import('../src/providers/retailerProviders');
  const homeDepotProvider = enabledRetailerProviders.find((p) => p.name === 'Home Depot');
  const homeDepotQuotes = homeDepotProvider
    ? await homeDepotProvider.getQuotesForItem({
        companyId: 1,
        itemId: 999,
        name: QUERY,
      })
    : [];
  console.log('\nHome Depot result: quotes count=', homeDepotQuotes.length);
  if (homeDepotQuotes.length > 0) {
    console.log('Home Depot quote:', JSON.stringify(homeDepotQuotes[0], null, 2));
  }

  console.log('\n=== DEBUG COMPLETE ===');
}

main().catch(console.error);
