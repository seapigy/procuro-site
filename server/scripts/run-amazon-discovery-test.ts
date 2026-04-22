/**
 * Run live Amazon daily re-discovery for 5 representative test items.
 *
 * Flow:
 * 1. Find items by name (or create if missing)
 * 2. Optionally clear today's quotes (--force)
 * 3. Run price check for each item (Amazon discovery only)
 * 4. Print readable debug output and summary
 *
 * Run:
 *   AMAZON_DISCOVERY_DEBUG=true USE_MOCK_PROVIDER=false npx tsx scripts/run-amazon-discovery-test.ts
 *
 * With force (clear today's quotes before running):
 *   AMAZON_DISCOVERY_DEBUG=true USE_MOCK_PROVIDER=false npx tsx scripts/run-amazon-discovery-test.ts --force
 *
 * With specific company and item IDs:
 *   AMAZON_DISCOVERY_DEBUG=true USE_MOCK_PROVIDER=false npx tsx scripts/run-amazon-discovery-test.ts --company 1 --items 51,52,53
 *
 * Prerequisites: BRIGHTDATA_ENABLED=true, BRIGHTDATA_API_KEY, BRIGHTDATA_AMAZON_DATASET_ID
 */
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Force Amazon discovery debug and real providers
process.env.AMAZON_DISCOVERY_DEBUG = 'true';
process.env.USE_MOCK_PROVIDER = 'false';

import { PrismaClient } from '@prisma/client';
import { runPriceCheckForItem } from '../src/services/priceCheck';

const prisma = new PrismaClient();

const DEFAULT_TEST_ITEMS = [
  'HP Printer Paper 500 Sheets 8.5 x 11',
  'Hammermill Copy Paper 8.5 x 11 500 Sheets',
  'Post-it Notes 3x3 Yellow 12 Pack',
  'Sharpie Black Fine Point 12 Count',
  'Clorox Disinfecting Wipes 75 Count',
];

function getTodayUtcBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Key terms per test item for DB lookup (first term is primary). */
const ITEM_SEARCH_TERMS: Record<string, string[]> = {
  'HP Printer Paper 500 Sheets 8.5 x 11': ['HP', 'printer', 'paper'],
  'Hammermill Copy Paper 8.5 x 11 500 Sheets': ['Hammermill', 'copy', 'paper'],
  'Post-it Notes 3x3 Yellow 12 Pack': ['Post-it', 'Notes', 'Yellow'],
  'Sharpie Black Fine Point 12 Count': ['Sharpie', 'Black', 'Fine'],
  'Clorox Disinfecting Wipes 75 Count': ['Clorox', 'Disinfecting', 'Wipes'],
};

async function findOrCreateItems(companyId: number, itemNames: string[]) {
  const results: Array<{ id: number; companyId: number; name: string; created: boolean }> = [];
  const user = await prisma.user.findFirst({
    where: { companyId },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`No user found for company ${companyId}. Create a company and user first.`);
  }

  for (const name of itemNames) {
    const terms = ITEM_SEARCH_TERMS[name] ?? name.split(/\s+/).filter((w) => w.length >= 2).slice(0, 3);
    const andConditions = terms.map((t) => ({ name: { contains: t, mode: 'insensitive' as const } }));
    const found = await prisma.item.findFirst({
      where: { companyId, AND: andConditions },
      select: { id: true, companyId: true, name: true },
    });
    if (found) {
      results.push({ ...found, created: false });
      continue;
    }
    // Fallback: any item with primary term
    const primary = terms[0] ?? name.split(' ')[0];
    const fallback = await prisma.item.findFirst({
      where: { companyId, name: { contains: primary, mode: 'insensitive' } },
      select: { id: true, companyId: true, name: true },
    });
    if (fallback) {
      results.push({ ...fallback, created: false });
      continue;
    }
    // Create if not found
    const created = await prisma.item.create({
      data: {
        userId: user.id,
        companyId,
        name,
        lastPaidPrice: 15,
      },
    });
    results.push({ id: created.id, companyId: created.companyId, name: created.name, created: true });
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const companyIdx = args.indexOf('--company');
  const companyId = companyIdx >= 0 && args[companyIdx + 1] ? parseInt(args[companyIdx + 1], 10) : 1;
  const itemsIdx = args.indexOf('--items');
  const itemIdsArg = itemsIdx >= 0 && args[itemsIdx + 1] ? args[itemsIdx + 1] : null;

  console.log('\n=== AMAZON DAILY RE-DISCOVERY TEST ===\n');
  console.log('Config: companyId=', companyId, '| force=', force, '| AMAZON_DISCOVERY_DEBUG=true\n');

  let itemsToRun: Array<{ id: number; companyId: number; name: string }>;

  if (itemIdsArg) {
    const ids = itemIdsArg.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    const found = await prisma.item.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true, companyId: true, name: true },
    });
    if (found.length !== ids.length) {
      const missing = ids.filter((id) => !found.some((f) => f.id === id));
      console.warn('Warning: some item IDs not found:', missing);
    }
    itemsToRun = found;
  } else {
    const resolved = await findOrCreateItems(companyId, DEFAULT_TEST_ITEMS);
    itemsToRun = resolved;
    if (resolved.some((r) => r.created)) {
      console.log('Created missing items:', resolved.filter((r) => r.created).map((r) => r.name));
    }
  }

  if (itemsToRun.length === 0) {
    console.error('No items to run. Provide --items 1,2,3 or ensure DB has matching items.');
    process.exit(1);
  }

  console.log(`Running Amazon discovery for ${itemsToRun.length} items:\n`);
  itemsToRun.forEach((i, idx) => console.log(`  ${idx + 1}. id=${i.id} "${i.name}"`));
  console.log('');

  const results: Array<{
    itemId: number;
    name: string;
    ok: boolean;
    inserted?: number;
    skipped?: boolean;
    amazonQuote?: { unitPrice: number; url?: string };
    error?: string;
  }> = [];

  for (const item of itemsToRun) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ITEM ${item.id}: ${item.name}`);
    console.log('='.repeat(60));

    try {
      if (force) {
        const { start, end } = getTodayUtcBounds();
        const deleted = await prisma.retailerPriceQuote.deleteMany({
          where: { itemId: item.id, capturedAt: { gte: start, lt: end } },
        });
        if (deleted.count > 0) {
          console.log(`  Cleared ${deleted.count} today's quote(s) for fresh discovery.\n`);
        }
      }

      const result = await runPriceCheckForItem(item.companyId, item.id);
      const amazonQuote = result.quotes.find((q) => q.retailer === 'Amazon');

      results.push({
        itemId: item.id,
        name: item.name,
        ok: true,
        inserted: result.inserted,
        skipped: result.skipped,
        amazonQuote: amazonQuote ? { unitPrice: amazonQuote.unitPrice, url: amazonQuote.url } : undefined,
      });

      console.log(`\n  Result: inserted=${result.inserted} skipped=${result.skipped ?? false}`);
      if (amazonQuote) {
        console.log(`  Amazon quote: $${amazonQuote.unitPrice} | url=${amazonQuote.url ?? '-'}`);
      } else {
        console.log(`  Amazon quote: (none)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${msg}`);
      results.push({ itemId: item.id, name: item.name, ok: false, error: msg });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`  Passed: ${ok.length}/${results.length}`);
  if (failed.length > 0) {
    console.log(`  Failed: ${failed.length}`);
    failed.forEach((r) => console.log(`    - ${r.name}: ${r.error}`));
  }
  console.log('');
  ok.forEach((r) => {
    const q = r.amazonQuote ? `$${r.amazonQuote.unitPrice}` : 'none';
    console.log(`  ${r.name}: Amazon=${q} ${r.skipped ? '(skipped - had today)' : ''}`);
  });
  console.log('\nDone.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
