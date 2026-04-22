/**
 * Discovery test: verify first-run search → persist identity → second-run product monitoring.
 *
 * Flow:
 * 1. Create fresh test item (name only, no retailer identity)
 * 2. Run 1: search at Amazon + Home Depot → select candidates → persist to ItemRetailerMatch
 * 3. Delete today's quotes (so run 2 doesn't skip)
 * 4. Run 2: use saved matches (product URL fetch) instead of search
 *
 * Run (real APIs): USE_MOCK_PROVIDER=false DISCOVERY_DEBUG=true npx tsx scripts/discovery-test.ts
 * Run (simulated, no external APIs): DISCOVERY_SIMULATE=true npx tsx scripts/discovery-test.ts
 *
 * Prerequisites for real APIs: BRIGHTDATA_ENABLED=true, BRIGHTDATA_API_KEY, BRIGHTDATA_AMAZON_DATASET_ID
 */
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Force real providers and debug logging before any imports (unless using simulated mode)
if (process.env.DISCOVERY_SIMULATE !== 'true') {
  process.env.USE_MOCK_PROVIDER = 'false';
}
process.env.DISCOVERY_DEBUG = 'true';

import { PrismaClient } from '@prisma/client';
import { runPriceCheckForItem } from '../src/services/priceCheck';

const prisma = new PrismaClient();

const TEST_ITEM_NAME = 'HP Printer Paper 500 Sheets 8.5 x 11';

function getTodayUtcBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function main() {
  console.log('=== DISCOVERY TEST ===\n');
  console.log('Goal: Verify search → persist identity → second run uses saved matches\n');

  // 1. Get or create a user for the test item (company 1)
  const user = await prisma.user.findFirst({
    where: { companyId: 1 },
    select: { id: true },
  });
  if (!user) {
    console.error('No user found for company 1. Create a company and user first.');
    process.exit(1);
  }

  // 2. Create fresh test item
  const item = await prisma.item.create({
    data: {
      userId: user.id,
      companyId: 1,
      name: TEST_ITEM_NAME,
      lastPaidPrice: 10,
      // Explicitly null retailer identity
      amazonAsin: null,
      amazonProductUrl: null,
      amazonMatchedAt: null,
      matchedUrl: null,
      matchUrl: null,
      manualMatchUrl: null,
    },
  });
  console.log(`Created test item id=${item.id} name="${item.name}"\n`);

  // 3. Ensure no ItemRetailerMatch rows
  const deletedMatches = await prisma.itemRetailerMatch.deleteMany({
    where: { itemId: item.id },
  });
  if (deletedMatches.count > 0) {
    console.log(`Cleaned ${deletedMatches.count} existing ItemRetailerMatch rows\n`);
  }

  // 4. RUN 1: Discovery (search)
  console.log('--- RUN 1: Discovery (search) ---\n');
  const run1 = await runPriceCheckForItem(item.companyId, item.id);
  console.log('\nRun 1 result:', {
    inserted: run1.inserted,
    skipped: run1.skipped,
    quotes: run1.quotes,
    bestDealUnitPrice: run1.bestDealUnitPrice,
    bestDealRetailer: run1.bestDealRetailer,
  });

  // 5. Check what was persisted
  const matchesAfterRun1 = await prisma.itemRetailerMatch.findMany({
    where: { itemId: item.id },
    orderBy: { retailer: 'asc' },
  });
  console.log('\nItemRetailerMatch after Run 1:', matchesAfterRun1);

  const itemAfterRun1 = await prisma.item.findUnique({
    where: { id: item.id },
    select: {
      amazonAsin: true,
      amazonProductUrl: true,
      amazonMatchedAt: true,
    },
  });
  console.log('Item legacy fields after Run 1:', itemAfterRun1);

  // 6. Delete today's quotes so Run 2 doesn't skip
  const { start: startOfToday, end: endOfToday } = getTodayUtcBounds();
  const deletedQuotes = await prisma.retailerPriceQuote.deleteMany({
    where: {
      itemId: item.id,
      capturedAt: { gte: startOfToday, lt: endOfToday },
    },
  });
  console.log(`\nDeleted ${deletedQuotes.count} today's quotes (so Run 2 will run providers)\n`);

  // 7. RUN 2: Should use saved matches (product URL fetch)
  console.log('--- RUN 2: Product URL fetch (saved identity) ---\n');
  const run2 = await runPriceCheckForItem(item.companyId, item.id);
  console.log('\nRun 2 result:', {
    inserted: run2.inserted,
    skipped: run2.skipped,
    quotes: run2.quotes,
    bestDealUnitPrice: run2.bestDealUnitPrice,
    bestDealRetailer: run2.bestDealRetailer,
  });

  // 8. Final ItemRetailerMatch and quote rows
  const finalMatches = await prisma.itemRetailerMatch.findMany({
    where: { itemId: item.id },
    orderBy: { retailer: 'asc' },
  });
  const finalQuotes = await prisma.retailerPriceQuote.findMany({
    where: { itemId: item.id },
    orderBy: { capturedAt: 'desc' },
    take: 20,
  });

  // 9. Report
  console.log('\n=== DISCOVERY TEST REPORT ===\n');
  const amazonQuote = run1.quotes.find((q) => q.retailer === 'Amazon');
  const amazonMatch = matchesAfterRun1.find((m) => m.retailer === 'Amazon');
  console.log('1. Amazon discovery returns candidate rows:', run1.quotes.some((q) => q.retailer === 'Amazon') ? 'YES' : 'NO');
  if (amazonQuote?.rawJson && typeof amazonQuote.rawJson === 'object') {
    const raw = amazonQuote.rawJson as Record<string, unknown>;
    console.log('2. Top Amazon candidate:');
    console.log('   - title:', raw.title ?? raw.name ?? '?');
    console.log('   - asin:', raw.asin ?? raw.product_id ?? '?');
    console.log('   - price:', amazonQuote.unitPrice);
    console.log('   - url:', amazonQuote.url ?? '?');
  } else {
    console.log('2. Top Amazon candidate: (none - check [AmazonDiscovery] logs for candidates)');
  }
  console.log('3. Amazon selects best candidate:', amazonQuote ? 'YES' : 'NO');
  console.log('4. Amazon persists:');
  console.log('   - retailerProductId:', amazonMatch?.retailerProductId ?? '?');
  console.log('   - productUrl:', amazonMatch?.productUrl ?? '?');
  console.log('   - amazonMatchedAt:', itemAfterRun1?.amazonMatchedAt ?? '?');
  console.log('   - ItemRetailerMatch row:', amazonMatch ? 'YES' : 'NO');
  console.log('5. Home Depot discovery returns anything:', run1.quotes.some((q) => q.retailer === 'Home Depot') ? 'YES' : 'NO');
  console.log('6. Second run uses saved Amazon identity (product-URL-fetch): check Run 2 logs for path');
  console.log('7. Final ItemRetailerMatch rows:', JSON.stringify(finalMatches, null, 2));
  console.log('8. Final quote rows (last 20):', JSON.stringify(finalQuotes.map((q) => ({ retailer: q.retailer, unitPrice: q.unitPrice, url: q.url, capturedAt: q.capturedAt })), null, 2));
  console.log('9. Home Depot discovery: check Run 1 logs for Bright Data / Home Depot path and any errors');
  console.log('\nTest item id:', item.id, '(you can delete it after verification)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
