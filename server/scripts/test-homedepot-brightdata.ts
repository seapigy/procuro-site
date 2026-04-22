/**
 * One-off: verify BRIGHTDATA_API_KEY + BRIGHTDATA_HOMEDEPOT_DATASET_ID return rows.
 * Run from server/: npx tsx scripts/test-homedepot-brightdata.ts
 */
import 'dotenv/config';
import { homeDepotBrightDataProvider } from '../src/providers/homeDepotBrightDataProvider';

async function main() {
  const arg = process.argv[2] || 'hammer';
  // Pass a full https://www.homedepot.com/p/... URL to test PDP-style dataset inputs.
  console.log('Input (keyword or full product URL):', arg);
  const quotes = await homeDepotBrightDataProvider.getQuotesForItem({
    companyId: 0,
    itemId: 0,
    name: arg,
  });
  console.log('Quotes:', quotes.length);
  if (quotes[0]) {
    console.log(JSON.stringify(quotes[0], null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
