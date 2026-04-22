/**
 * Amazon discovery validation report for 10 representative items across categories.
 * Outputs a readable review report for each item.
 *
 * Run:
 *   npx tsx scripts/amazon-validation-report.ts
 *
 * Focused mode (3 items only, saves to file):
 *   npx tsx scripts/amazon-validation-report.ts --focused
 *
 * Custom item filter (comma-separated partial names):
 *   npx tsx scripts/amazon-validation-report.ts --items "Post-it,Hefty,Dell 24"
 *
 * Prerequisites: BRIGHTDATA_ENABLED=true, BRIGHTDATA_API_KEY, BRIGHTDATA_AMAZON_DATASET_ID
 *
 * Optional: --baseline <number> to use a fake baseline for savings display (default: 1.2x winner price)
 * Optional: --output <path> to override output file when using --focused or --items (default: amazon-validation-focused-report.txt)
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

process.env.DISCOVERY_PIPELINE_DEBUG = 'true';

import { normalizeSearchQuery } from '../src/services/matching/normalize';
import { extractItemAttributes } from '../src/services/matching/attributes';
import { getCategoryTemplate } from '../src/services/matching/categoryTemplates';
import { selectCheapestValidAmazonCandidate } from '../src/providers/brightDataAmazonParse';
import { getAmazonMatchSearchDepths } from '../src/config/brightData';
import { inferBrandFromItemName } from '../src/services/matching/brandInference';
import { fetchAmazonDiscoveryRows } from '../src/providers/amazonBrightDataProvider';
import { computeDealState } from '../src/services/dealState';

const VALIDATION_ITEMS: Array<{ name: string; category: string }> = [
  { name: 'HP Printer Paper 500 Sheets 8.5 x 11', category: 'office supplies' },
  { name: 'Post-it Notes 3x3 Yellow 12 Pack', category: 'office supplies' },
  { name: 'Sharpie Black Fine Point 12 Count', category: 'office supplies' },
  { name: 'Clorox Disinfecting Wipes 75 Count', category: 'cleaning' },
  { name: 'Lysol All Purpose Cleaner 32 oz', category: 'cleaning' },
  { name: 'Simpson Strong-Tie 3 inch Galvanized Nails 5 lb', category: 'construction' },
  { name: '2x4x8 Douglas Fir Lumber', category: 'construction' },
  { name: 'Hefty 13 Gallon Trash Bags 80 Count', category: 'restaurant supplies' },
  { name: 'Reynolds Wrap Aluminum Foil 75 sq ft', category: 'restaurant supplies' },
  { name: 'Dell 24 inch LED Monitor P2422H', category: 'electronics' },
];

/** Focused 3-item set for quick validation runs. */
const FOCUSED_ITEMS: Array<{ name: string; category: string }> = [
  { name: 'Post-it Notes 3x3 Yellow 12 Pack', category: 'office supplies' },
  { name: 'Hefty 13 Gallon Trash Bags 80 Count', category: 'restaurant supplies' },
  { name: 'Dell 24 inch LED Monitor P2422H', category: 'electronics' },
];

function formatCandidate(
  idx: number,
  c: {
    asin: string;
    title: string;
    price: number;
    normalizedUnitPrice?: number;
    normalizedUnitType?: string;
    confidenceBand: string;
    rejectionReason: { code: string; detail: string } | null;
    brandDebug?: {
      inferredBrand?: string;
      inferenceSignals: string[];
      productBrand?: string;
      brandInTitle: boolean;
      brandMatchResult: string;
    };
    amazonDebug?: {
      brand?: string;
      model_number?: string;
      categoriesDeptSummary?: string;
      chosenPriceField?: string;
      availability?: string | boolean;
      amazon_prime?: boolean;
      bundleReplacementRenewedDetected?: string | null;
      matchOrRejectReason?: string;
      monitorSizeSource?: string;
      monitorScreenSize?: string;
    };
  }
): string {
  const lines: string[] = [];
  lines.push(`  ${idx}. ${c.asin} | $${c.price.toFixed(2)}`);
  if (c.normalizedUnitPrice != null && c.normalizedUnitType) {
    lines.push(`     normalizedUnitPrice: $${c.normalizedUnitPrice.toFixed(4)} (${c.normalizedUnitType})`);
  }
  lines.push(`     title: ${c.title.slice(0, 80)}${c.title.length > 80 ? '...' : ''}`);
  lines.push(`     confidenceBand: ${c.confidenceBand}`);
  if (c.brandDebug) {
    lines.push(
      `     brandDebug: inferred=${c.brandDebug.inferredBrand ?? 'none'} signals=[${c.brandDebug.inferenceSignals.join(', ')}] productBrand=${c.brandDebug.productBrand ?? 'none'} brandInTitle=${c.brandDebug.brandInTitle} brandMatch=${c.brandDebug.brandMatchResult}`
    );
  }
  if (c.amazonDebug) {
    const ad = c.amazonDebug;
    const amazonParts: string[] = [];
    if (ad.brand) amazonParts.push(`brand=${ad.brand}`);
    if (ad.model_number) amazonParts.push(`model_number=${ad.model_number}`);
    if (ad.categoriesDeptSummary) amazonParts.push(`categories/dept=${ad.categoriesDeptSummary}`);
    if (ad.chosenPriceField) amazonParts.push(`priceField=${ad.chosenPriceField}`);
    if (ad.availability !== undefined) amazonParts.push(`available=${ad.availability}`);
    if (ad.amazon_prime) amazonParts.push(`prime=${ad.amazon_prime}`);
    if (ad.bundleReplacementRenewedDetected) amazonParts.push(`bundle/replacement/renewed=${ad.bundleReplacementRenewedDetected}`);
    if (ad.monitorSizeSource) amazonParts.push(`monitorSize=${ad.monitorSizeSource}:${ad.monitorScreenSize ?? ''}`);
    if (ad.matchOrRejectReason) amazonParts.push(`reason=${ad.matchOrRejectReason}`);
    if (amazonParts.length > 0) {
      lines.push(`     amazonDebug: ${amazonParts.join(' ')}`);
    }
  }
  if (c.rejectionReason) {
    lines.push(`     REJECTED: ${c.rejectionReason.code} - ${c.rejectionReason.detail}`);
  }
  return lines.join('\n');
}

async function runValidationForItem(
  item: { name: string; category: string },
  fakeBaselineMultiplier: number
): Promise<{
  ok: boolean;
  report: string;
  error?: string;
  rawCount: number;
  hasWinner: boolean;
  noCandidates: boolean;
  escalationHappened?: boolean;
  escalationReason?: string;
}> {
  const lines: string[] = [];
  const normalizedQuery = normalizeSearchQuery(item.name);
  const itemAttrs = extractItemAttributes(item.name);
  const template = getCategoryTemplate(itemAttrs.category);

  lines.push(`Item name: ${item.name}`);
  lines.push(`Category (test): ${item.category}`);
  lines.push(`Normalized search query: ${normalizedQuery}`);
  lines.push(`Extracted item attributes: ${JSON.stringify(itemAttrs, null, 2)}`);
  lines.push(`Category template: ${template ? `${template.category} (priceBasis: ${template.priceBasis ?? 'each'})` : 'none'}`);

  let cacheHit = false;
  let rawCount = 0;
  let rows: Record<string, unknown>[] = [];

  try {
    console.log(`  [Validation] calling fetchAmazonDiscoveryRows from amazonBrightDataProvider`);
    const fetchResult = await fetchAmazonDiscoveryRows(normalizedQuery);
    rows = fetchResult.rows;
    cacheHit = fetchResult.cacheHit;
    rawCount = fetchResult.rawCount;

    const was202Flow =
      fetchResult.debug?.responseShape?.includes('202') ||
      fetchResult.debug?.emptyReason?.includes('async snapshot');
    const snapshotRowsDownloaded = (fetchResult.debug?.rowsBeforeFilter ?? 0) > 0 && was202Flow;
    console.log(
      `  [Validation] fetchAmazonDiscoveryRows returned: rows=${rows.length} rawCount=${rawCount} ` +
        `202Flow=${was202Flow} snapshotRowsDownloaded=${snapshotRowsDownloaded}`
    );

    lines.push(`Cache: ${cacheHit ? 'HIT' : 'MISS'}`);
    lines.push(`Raw candidates returned: ${rawCount}`);
    lines.push(`Normalized candidates: ${rows.length}`);

    if (fetchResult.debug) {
      lines.push(`\n[Pipeline debug]`);
      lines.push(`  normalizedQuery: ${JSON.stringify(fetchResult.debug.normalizedQuery)}`);
      lines.push(`  payload: ${JSON.stringify(fetchResult.debug.payload)}`);
      lines.push(`  responseShape: ${fetchResult.debug.responseShape}`);
      lines.push(`  rowsBeforeFilter: ${fetchResult.debug.rowsBeforeFilter}`);
      lines.push(`  rowsAfterFilter: ${fetchResult.debug.rowsAfterFilter}`);
      lines.push(`  rowsAfterNormalize: ${fetchResult.debug.rowsAfterNormalize}`);
      if (fetchResult.debug.emptyReason) {
        lines.push(`  emptyReason: ${fetchResult.debug.emptyReason}`);
      }
    }
  } catch (err) {
    return {
      ok: false,
      report: lines.join('\n') + `\nERROR fetching: ${err instanceof Error ? err.message : String(err)}`,
      error: err instanceof Error ? err.message : String(err),
      rawCount: 0,
      hasWinner: false,
      noCandidates: true,
      escalationHappened: false,
    };
  }

  if (rows.length === 0) {
    lines.push('\nNo candidates returned. Skipping selection.');
    lines.push('Pipeline stage lost: fetch (Bright Data returned 0 rows)');
    return { ok: true, report: lines.join('\n'), rawCount, hasWinner: false, noCandidates: true, escalationHappened: false };
  }

  const fallbackUrl = `https://www.amazon.com/s?k=${encodeURIComponent(normalizedQuery)}`;
  const lastPaid = undefined;
  const { defaultDepth, escalationDepth } = getAmazonMatchSearchDepths();

  // Pass 1: cost-aware default (BRIGHTDATA_AMAZON_MATCH_DEPTH)
  let parsed = selectCheapestValidAmazonCandidate(
    item.name,
    rows,
    fallbackUrl,
    lastPaid,
    true,
    defaultDepth
  );

  const recordsProcessedPass1 = Math.min(rows.length, defaultDepth);
  let escalationHappened = false;
  let escalationReason: string | undefined;
  let recordsProcessed = recordsProcessedPass1;

  // Early exit: strong (high-confidence) winner in first pass depth
  if (parsed && parsed.bestRow && !parsed.needsReview) {
    lines.push(`\n--- Cost-aware search depth ---`);
    lines.push(`  Records processed: ${recordsProcessed}`);
    lines.push(`  Escalation: no (early exit: strong winner in top ${defaultDepth})`);
  } else {
    const shouldEscalate =
      !parsed || !parsed.bestRow || parsed.needsReview;
    if (shouldEscalate && rows.length > defaultDepth) {
      escalationHappened = true;
      escalationReason =
        !parsed || !parsed.bestRow
          ? 'all candidates rejected'
          : `only medium-confidence candidates in top ${defaultDepth}`;
      parsed = selectCheapestValidAmazonCandidate(
        item.name,
        rows,
        fallbackUrl,
        lastPaid,
        true,
        escalationDepth
      );
      recordsProcessed = Math.min(rows.length, escalationDepth);
      lines.push(`\n--- Cost-aware search depth ---`);
      lines.push(`  Records processed: ${recordsProcessedPass1} -> ${recordsProcessed} (escalation)`);
      lines.push(`  Escalation: yes (reason: ${escalationReason})`);
    } else {
      lines.push(`\n--- Cost-aware search depth ---`);
      lines.push(`  Records processed: ${recordsProcessed}`);
      lines.push(`  Escalation: no (${!parsed || !parsed.bestRow ? 'no valid candidates' : 'insufficient data to escalate'})`);
    }
  }

  lines.push('\n--- Top candidates ---');
  const debugViews = parsed?.debugViews ?? [];
  if (debugViews.length > 0) {
    debugViews.forEach((c, i) => {
      lines.push(formatCandidate(i + 1, {
        asin: c.asin,
        title: c.title,
        price: c.price,
        normalizedUnitPrice: c.normalizedUnitPrice,
        normalizedUnitType: c.normalizedUnitType,
        confidenceBand: c.confidenceBand,
        rejectionReason: c.rejectionReason,
        brandDebug: c.brandDebug,
        amazonDebug: c.amazonDebug,
      }));
    });
  } else {
    lines.push('  (no debug views - rows existed but none passed price filter for evaluation)');
  }

  const hasWinner = parsed != null && parsed.bestRow != null;
  if (!hasWinner) {
    lines.push('\nSelected winner: NONE (no valid candidates)');
    lines.push('Why: All candidates rejected or score too low');
    lines.push('Pipeline stage lost: selection (had normalized rows, all rejected or score too low)');
    return {
      ok: true,
      report: lines.join('\n'),
      rawCount,
      hasWinner: false,
      noCandidates: false,
      escalationHappened,
      escalationReason,
    };
  }

  const winner = parsed;
  const winnerTitle = (winner.bestRow.title ?? winner.bestRow.name ?? '').toString();
  lines.push('\n--- Selected winner ---');
  lines.push(`  ASIN: ${winner.bestRow.asin ?? '-'}`);
  lines.push(`  Title: ${winnerTitle.slice(0, 100)}${winnerTitle.length > 100 ? '...' : ''}`);
  lines.push(`  Price: $${winner.minPrice.toFixed(2)}`);
  if (winner.normalizedUnitPrice != null && winner.normalizedUnitType) {
    lines.push(`  Normalized unit price: $${winner.normalizedUnitPrice.toFixed(4)} (${winner.normalizedUnitType})`);
  }
  lines.push(`  Score: ${winner.score.toFixed(2)} | validCount: ${winner.validCount} | needsReview: ${winner.needsReview}`);
  if (itemAttrs.brand) {
    const inference = inferBrandFromItemName(item.name);
    lines.push(`  Inferred brand: ${itemAttrs.brand} (signals: ${inference.signals.join(', ') || 'none'})`);
  }

  const whyWon = winner.needsReview
    ? 'Selected from medium-confidence pool (no high-confidence candidates); cheapest by normalized unit price'
    : 'Cheapest valid high-confidence candidate by normalized unit price (or raw price when priceBasis=each)';
  lines.push(`Why it won: ${whyWon}`);

  const baselineUnitPrice =
    fakeBaselineMultiplier > 0
      ? winner.minPrice * fakeBaselineMultiplier
      : null;
  const deal = computeDealState({
    baselineUnitPrice,
    bestDealUnitPrice: winner.minPrice,
  });

  lines.push('\n--- Savings (using fake baseline for validation) ---');
  if (baselineUnitPrice != null) {
    lines.push(`  Baseline (fake): $${baselineUnitPrice.toFixed(2)}`);
    lines.push(`  Best deal: $${winner.minPrice.toFixed(2)}`);
    lines.push(`  estimatedSavings: ${deal.estimatedSavings != null ? `$${deal.estimatedSavings.toFixed(2)}` : 'N/A'}`);
    lines.push(`  savingsPercent: ${deal.savingsPercent != null ? `${deal.savingsPercent.toFixed(1)}%` : 'N/A'}`);
  } else {
    lines.push('  N/A (no baseline)');
  }

  return {
    ok: true,
    report: lines.join('\n'),
    rawCount,
    hasWinner: true,
    noCandidates: false,
    escalationHappened,
    escalationReason,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const baselineIdx = args.indexOf('--baseline');
  const fakeBaselineMultiplier =
    baselineIdx >= 0 && args[baselineIdx + 1]
      ? parseFloat(args[baselineIdx + 1])
      : 1.2;

  const focusedMode = args.includes('--focused');
  const itemsIdx = args.indexOf('--items');
  const itemsFilter =
    itemsIdx >= 0 && args[itemsIdx + 1]
      ? args[itemsIdx + 1].split(',').map((s) => s.trim()).filter(Boolean)
      : null;
  const outputIdx = args.indexOf('--output');
  const outputPath =
    outputIdx >= 0 && args[outputIdx + 1]
      ? args[outputIdx + 1]
      : path.join(__dirname, '..', 'amazon-validation-focused-report.txt');

  let itemsToRun: Array<{ name: string; category: string }>;
  let saveToFile = false;

  if (focusedMode) {
    itemsToRun = FOCUSED_ITEMS;
    saveToFile = true;
  } else if (itemsFilter && itemsFilter.length > 0) {
    itemsToRun = VALIDATION_ITEMS.filter((item) =>
      itemsFilter.some((f) => item.name.toLowerCase().includes(f.toLowerCase()))
    );
    if (itemsToRun.length === 0) {
      console.error('No items matched --items filter. Available:', VALIDATION_ITEMS.map((i) => i.name).join(', '));
      process.exit(1);
    }
    saveToFile = true;
  } else {
    itemsToRun = VALIDATION_ITEMS;
  }

  const headerLines = [
    '\n╔══════════════════════════════════════════════════════════════╗',
    '║  AMAZON DISCOVERY VALIDATION REPORT                         ║',
    saveToFile
      ? `║  Focused run: ${itemsToRun.length} items                                      ║`
      : '║  10 items across office, cleaning, construction,             ║',
    saveToFile ? '║                                                          ║' : '║  restaurant supplies, electronics                            ║',
    '╚══════════════════════════════════════════════════════════════╝\n',
    `Fake baseline multiplier: ${fakeBaselineMultiplier} (use --baseline <n> to override)\n`,
  ];
  const headerStr = headerLines.join('\n');

  console.log(headerStr);

  const results: Array<{
    item: { name: string; category: string };
    ok: boolean;
    report: string;
    error?: string;
    rawCount: number;
    hasWinner: boolean;
    noCandidates: boolean;
    escalationHappened?: boolean;
    escalationReason?: string;
  }> = [];

  const outputLines: string[] = [headerStr];

  for (const item of itemsToRun) {
    const sep = `\n${'═'.repeat(70)}`;
    const proc = `Processing: ${item.name} [${item.category}]`;
    console.log(sep);
    console.log(proc);
    console.log('═'.repeat(70));

    outputLines.push(sep);
    outputLines.push(proc);
    outputLines.push('═'.repeat(70));

    try {
      const result = await runValidationForItem(item, fakeBaselineMultiplier);
      results.push({ ...result, item });
      console.log(result.report);
      outputLines.push(result.report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${msg}`);
      const errReport = `Error: ${msg}`;
      results.push({
        item,
        ok: false,
        report: errReport,
        error: msg,
        rawCount: 0,
        hasWinner: false,
        noCandidates: true,
      });
      outputLines.push(errReport);
    }
  }

  const summaryLines = [
    '\n\n╔══════════════════════════════════════════════════════════════╗',
    '║  SUMMARY                                                      ║',
    '╚══════════════════════════════════════════════════════════════╝\n',
    `  Items processed: ${results.length}/${itemsToRun.length}`,
    `  With winner: ${results.filter((r) => r.hasWinner).length}`,
    `  Escalation to top 50: ${results.filter((r) => r.escalationHappened).length}`,
    `  No candidates (raw=0 or fetch failed): ${results.filter((r) => r.noCandidates).length}`,
    `  Only rejected (had candidates, none valid): ${results.filter((r) => r.ok && !r.noCandidates && !r.hasWinner).length}`,
  ];
  const itemsWithErrors = results.filter((r) => r.error).length;
  if (itemsWithErrors > 0) {
    summaryLines.push(`  Errors: ${itemsWithErrors}`);
    results.filter((r) => r.error).forEach((r) => summaryLines.push(`    - ${r.item.name}: ${r.error}`));
  }
  summaryLines.push('\nDone.\n');

  const summaryStr = summaryLines.join('\n');
  console.log(summaryStr);
  outputLines.push(summaryStr);

  if (saveToFile) {
    const fullOutput = outputLines.join('\n');
    fs.writeFileSync(outputPath, fullOutput, 'utf8');
    console.log(`Report saved to: ${outputPath}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
