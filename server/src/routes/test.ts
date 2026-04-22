import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { recomputeMonitoringForCompany } from '../services/monitoring';
import { runDailyPriceCheck } from '../workers/dailyPriceCheck';
import { computeBaseline, computeP90 } from '../services/baseline';
import { generateSimulatedPriceDrops } from '../services/testing';
import appConfig from '../../../config/app.json';
import { getBrightDataConfig, getLimitPerInput } from '../config/brightData';
import {
  AMAZON_TEST_CLEANING_CATEGORY,
  AMAZON_TEST_CLEANING_EXPECTED_COUNT,
  AMAZON_TEST_CLEANING_ITEMS,
} from '../config/amazonTestCleaningItems';
import {
  getAmazonDiscoveryQuotesWithStats,
  type AmazonDiscoveryQuotesWithStatsResult,
} from '../providers/amazonBrightDataProvider';
import type { AmazonCandidatePreview } from '../providers/brightDataAmazonParse';
import { isVagueName, needsClarification } from '../services/matchItem';

function amazonBatchReviewHint(
  outcome: 'ok' | 'no_api_rows' | 'matcher_rejected' | 'error' | 'skipped_needs_clarification',
  stats?: AmazonDiscoveryQuotesWithStatsResult,
  errorMessage?: string
): { reviewHint?: string; failureKind?: 'infra' | 'data' } {
  if (outcome === 'skipped_needs_clarification') {
    return {
      reviewHint:
        'Item is flagged as needing a clearer name before discovery. Edit the item (brand, size, pack) then re-run.',
      failureKind: 'data',
    };
  }
  if (outcome === 'error') {
    const em = (errorMessage || '').toLowerCase();
    if (em.includes('timeout')) {
      return {
        reviewHint: 'Request timed out — retry later. This is usually infrastructure, not fixed by renaming alone.',
        failureKind: 'infra',
      };
    }
    return { reviewHint: errorMessage, failureKind: 'infra' };
  }
  if (!stats) return {};
  const er = (stats.emptyReason || '').toLowerCase();
  if (er.includes('timeout')) {
    return {
      reviewHint:
        'Bright Data snapshot timed out — retry later. Changing the item name rarely fixes timeouts.',
      failureKind: 'infra',
    };
  }
  if (outcome === 'matcher_rejected') {
    const code = stats.matcherTopRejection?.code?.replace(/_/g, ' ') ?? '';
    return {
      reviewHint: `No listing passed match checks. Add brand, pack count, or an Amazon search hint.${code ? ` Common issue: ${code}.` : ''}`,
      failureKind: 'data',
    };
  }
  if (outcome === 'no_api_rows' && stats.normalizedRows === 0) {
    return {
      reviewHint:
        'No product rows returned. Try a clearer keyword or search hint; if this persists, retry later (infra).',
      failureKind: er ? 'infra' : 'data',
    };
  }
  return {};
}
import { isBrightDataConfigured } from '../services/brightData';

const router = Router();

const RATE_PER_THOUSAND_USD = 1.5;

type TestItemDifficulty = 'easy_found' | 'medium_ambiguous' | 'hard_not_found';
type TestCompanyKind = 'janitorial' | 'construction' | 'it_office';

interface TestItemBlueprint {
  name: string;
  category: string;
  vendorName: string;
  productBrand?: string | null;
  amazonSearchHint?: string | null;
  baselineUnitPrice: number;
  lastPaidPrice: number;
  quantityPerOrder: number;
  reorderIntervalDays: number;
  difficulty: TestItemDifficulty;
}

interface TestCompanyBlueprint {
  name: string;
  realmId: string;
  userEmail: string;
  userName: string;
  kind: TestCompanyKind;
  items: TestItemBlueprint[];
}

const TEST_COMPANY_BLUEPRINTS: TestCompanyBlueprint[] = [
  {
    name: 'Janitorial Supply Co',
    realmId: 'test-janitorial-001',
    userEmail: (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com',
    userName: 'Test User - Janitorial',
    kind: 'janitorial',
    items: [
      { name: 'Clorox Disinfecting Wipes Fresh Scent 75 Count', category: 'Cleaning', vendorName: 'CloroxPro', productBrand: 'Clorox', amazonSearchHint: 'clorox wipes 75 count canister', baselineUnitPrice: 7.99, lastPaidPrice: 8.49, quantityPerOrder: 6, reorderIntervalDays: 30, difficulty: 'easy_found' },
      { name: 'Lysol Disinfectant Spray Crisp Linen 19 oz', category: 'Cleaning', vendorName: 'Lysol Direct', productBrand: 'Lysol', amazonSearchHint: 'lysol disinfectant spray 19 oz', baselineUnitPrice: 6.49, lastPaidPrice: 6.99, quantityPerOrder: 8, reorderIntervalDays: 30, difficulty: 'easy_found' },
      { name: 'Bounty Paper Towels Select-A-Size 12 Double Rolls', category: 'Paper Goods', vendorName: 'P&G Pro', productBrand: 'Bounty', baselineUnitPrice: 22.99, lastPaidPrice: 24.49, quantityPerOrder: 2, reorderIntervalDays: 30, difficulty: 'easy_found' },
      { name: 'Rubbermaid Commercial Brute 32 Gallon Trash Can', category: 'Facility', vendorName: 'Rubbermaid Commercial', productBrand: 'Rubbermaid', baselineUnitPrice: 45.0, lastPaidPrice: 49.99, quantityPerOrder: 1, reorderIntervalDays: 120, difficulty: 'easy_found' },
      { name: 'Mr Clean Multi Surface Cleaner 45 oz', category: 'Cleaning', vendorName: 'P&G Professional', productBrand: 'Mr Clean', baselineUnitPrice: 5.99, lastPaidPrice: 6.29, quantityPerOrder: 12, reorderIntervalDays: 30, difficulty: 'easy_found' },
      { name: 'Scotch-Brite Heavy Duty Scrub Sponge 24 Pack', category: 'Cleaning', vendorName: '3M Janitorial', productBrand: 'Scotch-Brite', baselineUnitPrice: 18.5, lastPaidPrice: 19.99, quantityPerOrder: 2, reorderIntervalDays: 45, difficulty: 'easy_found' },
      { name: 'Pumice Stone Toilet Ring Remover', category: 'Cleaning', vendorName: 'Facility Depot', productBrand: null, amazonSearchHint: 'pumice toilet ring remover tool', baselineUnitPrice: 12.99, lastPaidPrice: 14.25, quantityPerOrder: 2, reorderIntervalDays: 60, difficulty: 'medium_ambiguous' },
      { name: 'Glass Cleaner Ammonia Free Concentrate', category: 'Cleaning', vendorName: 'Facility Depot', productBrand: null, baselineUnitPrice: 15.0, lastPaidPrice: 16.5, quantityPerOrder: 2, reorderIntervalDays: 45, difficulty: 'medium_ambiguous' },
      { name: 'Degreaser Industrial Kitchen 1 Gallon', category: 'Cleaning', vendorName: 'Kitchen Supply House', productBrand: null, baselineUnitPrice: 21.0, lastPaidPrice: 22.5, quantityPerOrder: 2, reorderIntervalDays: 45, difficulty: 'medium_ambiguous' },
      { name: 'Floor cleaner', category: 'Cleaning', vendorName: 'Generic Supplier', productBrand: null, baselineUnitPrice: 12.0, lastPaidPrice: 13.0, quantityPerOrder: 4, reorderIntervalDays: 30, difficulty: 'hard_not_found' },
      { name: 'Toilet cleaner', category: 'Cleaning', vendorName: 'Generic Supplier', productBrand: null, baselineUnitPrice: 5.0, lastPaidPrice: 5.75, quantityPerOrder: 10, reorderIntervalDays: 30, difficulty: 'hard_not_found' },
      { name: 'Trash bags black contractor', category: 'Facility', vendorName: 'Generic Supplier', productBrand: null, baselineUnitPrice: 18.0, lastPaidPrice: 19.0, quantityPerOrder: 3, reorderIntervalDays: 30, difficulty: 'hard_not_found' },
    ],
  },
  {
    name: 'Apex Build Supply',
    realmId: 'test-construction-001',
    userEmail: 'build@procuroapp.com',
    userName: 'Test User - Construction',
    kind: 'construction',
    items: [
      { name: 'DEWALT 20V MAX Cordless Drill Kit DCD771C2', category: 'Tools', vendorName: 'DEWALT', productBrand: 'DEWALT', baselineUnitPrice: 119.0, lastPaidPrice: 129.0, quantityPerOrder: 1, reorderIntervalDays: 180, difficulty: 'easy_found' },
      { name: 'Simpson Strong-Tie LUS28Z Joist Hanger', category: 'Hardware', vendorName: 'Simpson Strong-Tie', productBrand: 'Simpson Strong-Tie', baselineUnitPrice: 2.89, lastPaidPrice: 3.15, quantityPerOrder: 50, reorderIntervalDays: 30, difficulty: 'easy_found' },
      { name: 'Tapcon 1/4 in x 2-3/4 in Concrete Anchors 100-Pack', category: 'Fasteners', vendorName: 'Tapcon', productBrand: 'Tapcon', baselineUnitPrice: 34.0, lastPaidPrice: 37.99, quantityPerOrder: 2, reorderIntervalDays: 60, difficulty: 'easy_found' },
      { name: 'Milwaukee Shockwave Impact Driver Bit Set 74-Piece', category: 'Tools', vendorName: 'Milwaukee Tool', productBrand: 'Milwaukee', baselineUnitPrice: 26.0, lastPaidPrice: 29.99, quantityPerOrder: 2, reorderIntervalDays: 90, difficulty: 'easy_found' },
      { name: 'ScotchBlue Painters Tape 1.88 in x 60 yd 6-Pack', category: 'Supplies', vendorName: '3M Construction', productBrand: 'ScotchBlue', baselineUnitPrice: 27.0, lastPaidPrice: 29.0, quantityPerOrder: 2, reorderIntervalDays: 45, difficulty: 'easy_found' },
      { name: 'Diablo Framing Circular Saw Blade 7-1/4 in 24-Tooth', category: 'Tools', vendorName: 'Freud Diablo', productBrand: 'Diablo', baselineUnitPrice: 11.5, lastPaidPrice: 12.79, quantityPerOrder: 5, reorderIntervalDays: 60, difficulty: 'easy_found' },
      { name: 'Galvanized framing nails 10d 5lb', category: 'Fasteners', vendorName: 'Builder Supply', productBrand: null, baselineUnitPrice: 22.0, lastPaidPrice: 24.0, quantityPerOrder: 4, reorderIntervalDays: 30, difficulty: 'medium_ambiguous' },
      { name: 'Construction adhesive heavy duty tube', category: 'Supplies', vendorName: 'Builder Supply', productBrand: null, baselineUnitPrice: 5.5, lastPaidPrice: 6.1, quantityPerOrder: 12, reorderIntervalDays: 30, difficulty: 'medium_ambiguous' },
      { name: 'Exterior deck screws star drive 3 inch', category: 'Fasteners', vendorName: 'Builder Supply', productBrand: null, baselineUnitPrice: 39.0, lastPaidPrice: 42.0, quantityPerOrder: 2, reorderIntervalDays: 45, difficulty: 'medium_ambiguous' },
      { name: 'Nails', category: 'Fasteners', vendorName: 'Generic Hardware', productBrand: null, baselineUnitPrice: 15.0, lastPaidPrice: 17.5, quantityPerOrder: 3, reorderIntervalDays: 30, difficulty: 'hard_not_found' },
      { name: 'Screws', category: 'Fasteners', vendorName: 'Generic Hardware', productBrand: null, baselineUnitPrice: 16.0, lastPaidPrice: 18.0, quantityPerOrder: 3, reorderIntervalDays: 30, difficulty: 'hard_not_found' },
      { name: 'Drill bits', category: 'Tools', vendorName: 'Generic Hardware', productBrand: null, baselineUnitPrice: 24.0, lastPaidPrice: 26.0, quantityPerOrder: 2, reorderIntervalDays: 60, difficulty: 'hard_not_found' },
    ],
  },
  {
    name: 'Bright Office Tech',
    realmId: 'test-itoffice-001',
    userEmail: 'office@procuroapp.com',
    userName: 'Test User - IT Office',
    kind: 'it_office',
    items: [
      { name: 'HP 902XL Black Ink Cartridge T6M14AN', category: 'Printing', vendorName: 'HP Business', productBrand: 'HP', baselineUnitPrice: 42.0, lastPaidPrice: 46.0, quantityPerOrder: 2, reorderIntervalDays: 45, difficulty: 'easy_found' },
      { name: 'Logitech MX Master 3S Wireless Mouse 910-006556', category: 'Peripherals', vendorName: 'Logitech', productBrand: 'Logitech', baselineUnitPrice: 88.0, lastPaidPrice: 94.0, quantityPerOrder: 2, reorderIntervalDays: 180, difficulty: 'easy_found' },
      { name: 'Fellowes Powershred 79Ci Cross-Cut Shredder', category: 'Office Equipment', vendorName: 'Fellowes', productBrand: 'Fellowes', baselineUnitPrice: 235.0, lastPaidPrice: 249.0, quantityPerOrder: 1, reorderIntervalDays: 365, difficulty: 'easy_found' },
      { name: 'Canon PG-245XL Black Ink Cartridge', category: 'Printing', vendorName: 'Canon', productBrand: 'Canon', baselineUnitPrice: 25.0, lastPaidPrice: 27.0, quantityPerOrder: 4, reorderIntervalDays: 60, difficulty: 'easy_found' },
      { name: 'APC Back-UPS 1500VA BR1500MS2', category: 'Power', vendorName: 'APC', productBrand: 'APC', baselineUnitPrice: 219.0, lastPaidPrice: 229.0, quantityPerOrder: 1, reorderIntervalDays: 365, difficulty: 'easy_found' },
      { name: 'Samsung T7 Portable SSD 1TB', category: 'Storage', vendorName: 'Samsung', productBrand: 'Samsung', baselineUnitPrice: 84.0, lastPaidPrice: 89.0, quantityPerOrder: 3, reorderIntervalDays: 180, difficulty: 'easy_found' },
      { name: 'USB C docking station dual monitor', category: 'Peripherals', vendorName: 'IT Procurement', productBrand: null, baselineUnitPrice: 120.0, lastPaidPrice: 129.0, quantityPerOrder: 2, reorderIntervalDays: 180, difficulty: 'medium_ambiguous' },
      { name: 'Ergonomic keyboard wireless rechargeable', category: 'Peripherals', vendorName: 'IT Procurement', productBrand: null, baselineUnitPrice: 65.0, lastPaidPrice: 72.0, quantityPerOrder: 3, reorderIntervalDays: 180, difficulty: 'medium_ambiguous' },
      { name: 'Noise cancelling headset for office calls', category: 'Peripherals', vendorName: 'IT Procurement', productBrand: null, baselineUnitPrice: 95.0, lastPaidPrice: 105.0, quantityPerOrder: 3, reorderIntervalDays: 180, difficulty: 'medium_ambiguous' },
      { name: 'Printer toner', category: 'Printing', vendorName: 'Generic Office Supplier', productBrand: null, baselineUnitPrice: 45.0, lastPaidPrice: 52.0, quantityPerOrder: 4, reorderIntervalDays: 60, difficulty: 'hard_not_found' },
      { name: 'Computer mouse', category: 'Peripherals', vendorName: 'Generic Office Supplier', productBrand: null, baselineUnitPrice: 18.0, lastPaidPrice: 21.0, quantityPerOrder: 8, reorderIntervalDays: 90, difficulty: 'hard_not_found' },
      { name: 'HDMI cable', category: 'Accessories', vendorName: 'Generic Office Supplier', productBrand: null, baselineUnitPrice: 9.0, lastPaidPrice: 11.0, quantityPerOrder: 10, reorderIntervalDays: 90, difficulty: 'hard_not_found' },
    ],
  },
];

/** In-memory progress for Amazon live batch (single-tenant dev / TEST_MODE). */
type AmazonLiveBatchProgress =
  | { phase: 'idle' }
  | {
      phase: 'running';
      currentIndex: number;
      total: number;
      itemId: number | null;
      itemNameShort: string;
      startedAt: number;
    };

let amazonLiveBatchProgress: AmazonLiveBatchProgress = { phase: 'idle' };

/**
 * GET /api/test/amazon-live-batch-progress
 * Poll while POST /amazon-live-batch runs (TEST_MODE only).
 */
router.get('/amazon-live-batch-progress', (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({ error: 'Test mode is not enabled' });
    }
    return res.json(amazonLiveBatchProgress);
  } catch (error) {
    return res.status(500).json({ error: 'progress failed' });
  }
});

async function ensureAmazonTestCleaningItems(companyId: number, userId: number): Promise<void> {
  for (const row of AMAZON_TEST_CLEANING_ITEMS) {
    const existing = await prisma.item.findFirst({
      where: { companyId, sku: row.sku },
    });
    const data = {
      name: row.name,
      lastPaidPrice: row.lastPaidPrice,
      category: AMAZON_TEST_CLEANING_CATEGORY,
      isMonitored: false,
    };
    if (existing) {
      await prisma.item.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.item.create({
        data: {
          userId,
          companyId,
          sku: row.sku,
          ...data,
        },
      });
    }
  }
}

const TEST_MODE = String(process.env.TEST_MODE || '').trim().toLowerCase() === 'true' || (appConfig.testing?.testMode as boolean) || false;

/**
 * GET /api/test/status
 * Get test mode status and company state
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;
    const testUserEmail = (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com';
    const companyId = (TEST_MODE && req.companyId != null) ? req.companyId : testCompanyId;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        users: true,
        _count: {
          select: {
            users: {
              where: {
                items: {
                  some: {
                    isMonitored: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!company) {
      return res.json({
        testMode: TEST_MODE,
        company: null,
        message: 'Test company not found. Run /api/test/setup first.',
      });
    }

    const monitoredItemsCount = await prisma.item.count({
      where: {
        userId: { in: company.users.map(u => u.id) },
        isMonitored: true,
      },
    });

    const lastAlert = await prisma.alert.findFirst({
      where: {
        item: {
          userId: { in: company.users.map(u => u.id) },
        },
      },
      orderBy: {
        alertDate: 'desc',
      },
    });

    // Get QuickBooks connection status (use context user when in test mode and switcher is used)
    const user = (TEST_MODE && req.companyContextUser) ? await prisma.user.findUnique({ where: { id: req.companyContextUser.id } }) : await prisma.user.findFirst({ where: { email: testUserEmail } });
    
    const isConnectionBroken = company.connectionBrokenAt 
      ? (new Date().getTime() - company.connectionBrokenAt.getTime()) < (7 * 24 * 60 * 60 * 1000)
      : false;

    res.json({
      testMode: TEST_MODE,
      company: {
        id: company.id,
        name: company.name,
        isSubscribed: company.isSubscribed,
        stripeCustomerId: company.stripeCustomerId,
        monitoredItemsCount,
        lastAlertGenerated: lastAlert?.alertDate || null,
        userCount: company.users.length,
        isQuickBooksConnected: company.isQuickBooksConnected || false,
        isConnectionBroken: isConnectionBroken,
        lastImportedItemCount: company.lastImportedItemCount || null,
        connectionBrokenAt: company.connectionBrokenAt || null,
      },
    });
  } catch (error) {
    console.error('Error fetching test status:', error);
    res.status(500).json({
      error: 'Failed to fetch test status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/test/amazon-preflight
 * Checklist before live Amazon (Bright Data) runs. TEST_MODE only. No Bright Data API calls.
 */
router.get('/amazon-preflight', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({ error: 'Test mode is not enabled' });
    }

    const explicitMock = process.env.USE_MOCK_PROVIDER?.trim().toLowerCase();
    const useMockProvider =
      explicitMock === 'true' || (explicitMock !== 'false' && process.env.NODE_ENV !== 'production');
    const discoverySimulate = process.env.DISCOVERY_SIMULATE === 'true';
    const bd = getBrightDataConfig();
    const companyId = req.companyId ?? null;
    const ctxUser = req.companyContextUser ?? null;

    let companyInDb: { id: number; name: string | null } | null = null;
    let itemCountForCompany: number | null = null;
    if (companyId != null) {
      companyInDb = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });
      itemCountForCompany = await prisma.item.count({ where: { companyId } });
    }

    const brightDataAmazonSearchReady = !!(bd.enabled && bd.apiKey && bd.amazonDatasetId);

    type Check = { id: string; ok: boolean; message: string; hint?: string };
    const checks: Check[] = [];

    checks.push({
      id: 'company_context',
      ok: companyId != null && ctxUser != null,
      message:
        companyId != null && ctxUser != null
          ? `Tenant context: companyId=${companyId}, user=${ctxUser.email} (id=${ctxUser.id})`
          : 'Missing company or user context.',
      hint: 'Run Setup Test Environment, or use X-Test-User-Email / X-Test-Company-Id in TEST_MODE.',
    });

    checks.push({
      id: 'company_in_database',
      ok: companyInDb != null,
      message: companyInDb
        ? `Company in DB: "${companyInDb.name ?? '(no name)'}" (id=${companyInDb.id})`
        : companyId != null
          ? `No Company row for id=${companyId}.`
          : 'No company id to verify.',
      hint: 'Seed or POST /api/test/setup.',
    });

    checks.push({
      id: 'items_for_company',
      ok: (itemCountForCompany ?? 0) > 0,
      message:
        itemCountForCompany != null
          ? `Items for this company: ${itemCountForCompany}`
          : 'Could not count items (no companyId).',
      hint: 'Optional for discovery-only tests; Amazon batch with Items needs rows.',
    });

    checks.push({
      id: 'bright_data_amazon_search',
      ok: brightDataAmazonSearchReady,
      message: brightDataAmazonSearchReady
        ? 'Bright Data configured for Amazon keyword discovery.'
        : 'Amazon keyword discovery not fully configured (see brightData config).',
      hint: 'BRIGHTDATA_ENABLED, BRIGHTDATA_API_KEY, BRIGHTDATA_DATASET_ID or BRIGHTDATA_AMAZON_DATASET_ID.',
    });

    checks.push({
      id: 'bright_data_product_url_dataset',
      ok: isBrightDataConfigured(),
      message: isBrightDataConfigured()
        ? 'Product-URL dataset vars present (debug PDP path).'
        : 'No product-URL dataset id (optional for keyword discovery).',
    });

    checks.push({
      id: 'discovery_simulate_off',
      ok: !discoverySimulate,
      message: discoverySimulate
        ? 'DISCOVERY_SIMULATE=true — worker uses simulate provider.'
        : 'DISCOVERY_SIMULATE is off.',
    });

    checks.push({
      id: 'use_mock_provider',
      ok: true,
      message: useMockProvider
        ? `USE_MOCK_PROVIDER effectively true (NODE_ENV=${process.env.NODE_ENV || 'undefined'}).`
        : 'USE_MOCK_PROVIDER false.',
      hint: 'Informational; set USE_MOCK_PROVIDER=false for production-like dev.',
    });

    const discoveryTimeoutMs = process.env.BRIGHTDATA_AMAZON_DISCOVERY_TIMEOUT_MS || '(default 120000)';

    const readyIds = ['company_context', 'company_in_database', 'bright_data_amazon_search'] as const;

    res.json({
      checks,
      summary: {
        readyForAmazonKeywordDiscovery: readyIds.every((id) => checks.find((c) => c.id === id)?.ok),
        allWarningsResolved: checks.every((c) => c.ok),
      },
      envHint: {
        NODE_ENV: process.env.NODE_ENV || null,
        useMockProvider,
        discoverySimulate,
        brightDataEnabled: bd.enabled,
        hasBrightDataApiKey: !!bd.apiKey,
        amazonDatasetIdConfigured: !!bd.amazonDatasetId,
        amazonDiscoveryTimeoutMs: discoveryTimeoutMs,
        limitPerInput: getLimitPerInput(),
      },
      costHint:
        'Compare summed raw row counts from a batch to your Bright Data usage dashboard; metered cost may differ from a flat $1.50/1k estimate.',
    });
  } catch (error) {
    console.error('Error in amazon-preflight:', error);
    res.status(500).json({
      error: 'Preflight failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/amazon-live-batch
 * Idempotent 20 cleaning Items + live Amazon keyword discovery per item (TEST_MODE only).
 */
router.post('/amazon-live-batch', async (req: Request, res: Response) => {
  let batchProgressActive = false;
  try {
    if (!TEST_MODE) {
      return res.status(403).json({ error: 'Test mode is not enabled' });
    }

    const bd = getBrightDataConfig();
    if (!bd.enabled || !bd.apiKey || !bd.amazonDatasetId) {
      return res.status(400).json({
        error: 'Bright Data is not configured for Amazon keyword discovery',
        hint: 'Set BRIGHTDATA_ENABLED=true, BRIGHTDATA_API_KEY, and dataset id env vars.',
      });
    }

    const bypassCache = req.body?.bypassCache !== false;
    const ensureItems = req.body?.ensureItems !== false;

    const companyId = req.companyId;
    const ctxUser = req.companyContextUser;
    if (companyId == null || !ctxUser) {
      return res.status(400).json({
        error: 'Missing company or user context',
        hint: 'Run Setup Test Environment, or use X-Test-User-Email so companyContext resolves a User with companyId.',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) {
      return res.status(400).json({ error: `Company ${companyId} not found in database` });
    }

    if (ensureItems) {
      await ensureAmazonTestCleaningItems(companyId, ctxUser.id);
    }

    const items = await prisma.item.findMany({
      where: { companyId, category: AMAZON_TEST_CLEANING_CATEGORY },
      orderBy: { sku: 'asc' },
      take: AMAZON_TEST_CLEANING_EXPECTED_COUNT,
    });

    if (items.length < AMAZON_TEST_CLEANING_EXPECTED_COUNT) {
      return res.status(500).json({
        error: `Expected ${AMAZON_TEST_CLEANING_EXPECTED_COUNT} test items, found ${items.length}`,
        hint: ensureItems
          ? 'Upsert failed or category/sku mismatch.'
          : 'Pass ensureItems: true or run seed path once.',
      });
    }

    const batchStartedAt = Date.now();
    batchProgressActive = true;
    amazonLiveBatchProgress = {
      phase: 'running',
      currentIndex: 0,
      total: items.length,
      itemId: null,
      itemNameShort: 'starting',
      startedAt: batchStartedAt,
    };

    type Outcome = 'ok' | 'no_api_rows' | 'matcher_rejected' | 'error' | 'skipped_needs_clarification';

    interface RowResult {
      itemId: number;
      itemName: string;
      outcome: Outcome;
      rawRowsReturned: number;
      rowsAfterProductFilter: number;
      normalizedRows: number;
      cacheHit: boolean;
      emptyReason?: string;
      errorMessage?: string;
      selectedUnitPrice?: number;
      selectedTitle?: string;
      selectedUrl?: string;
      selectedAsin?: string;
      discoveryKeyword?: string;
      matcherTopRejectionCode?: string;
      matcherTopRejectionDetail?: string;
      reviewHint?: string;
      failureKind?: 'infra' | 'data';
      topCandidates?: AmazonCandidatePreview[];
      usedFallbackKeyword?: boolean;
    }

    const results: RowResult[] = [];
    let successCount = 0;
    let noRowsCount = 0;
    let matcherRejectedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let totalBillableRecords = 0;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];
      amazonLiveBatchProgress = {
        phase: 'running',
        currentIndex: itemIndex,
        total: items.length,
        itemId: item.id,
        itemNameShort: item.name.length > 60 ? `${item.name.slice(0, 57)}...` : item.name,
        startedAt: batchStartedAt,
      };
      try {
        if (item.needsClarification) {
          skippedCount++;
          const { reviewHint, failureKind } = amazonBatchReviewHint('skipped_needs_clarification');
          results.push({
            itemId: item.id,
            itemName: item.name,
            outcome: 'skipped_needs_clarification',
            rawRowsReturned: 0,
            rowsAfterProductFilter: 0,
            normalizedRows: 0,
            cacheHit: false,
            reviewHint,
            failureKind,
          });
          continue;
        }

        const stats = await getAmazonDiscoveryQuotesWithStats(
          {
            name: item.name,
            lastPaidPrice: item.lastPaidPrice,
            productBrand: item.productBrand,
            amazonSearchHint: item.amazonSearchHint,
            amazonAsin: item.amazonAsin,
          },
          { bypassCache, allowFallbackSecondQuery: true }
        );

        if (!stats.cacheHit || bypassCache) {
          totalBillableRecords += stats.rawRowsReturned;
        }

        const quote = stats.quotes[0];
        const rawJson = quote?.rawJson as Record<string, unknown> | undefined;
        const asin =
          rawJson && typeof rawJson.asin === 'string' ? rawJson.asin : undefined;

        let outcome: Outcome;
        if (stats.normalizedRows === 0) {
          outcome = 'no_api_rows';
          noRowsCount++;
        } else if (!quote) {
          outcome = 'matcher_rejected';
          matcherRejectedCount++;
        } else {
          outcome = 'ok';
          successCount++;
        }

        const hint = amazonBatchReviewHint(outcome, stats);

        results.push({
          itemId: item.id,
          itemName: item.name,
          outcome,
          rawRowsReturned: stats.rawRowsReturned,
          rowsAfterProductFilter: stats.rowsAfterProductFilter,
          normalizedRows: stats.normalizedRows,
          cacheHit: stats.cacheHit,
          emptyReason: stats.emptyReason,
          selectedUnitPrice: quote?.unitPrice,
          selectedTitle: rawJson
            ? String(rawJson.title ?? rawJson.name ?? rawJson.product_title ?? '')
            : undefined,
          selectedUrl: quote?.url,
          selectedAsin: asin,
          discoveryKeyword: stats.discoveryKeyword,
          matcherTopRejectionCode: stats.matcherTopRejection?.code,
          matcherTopRejectionDetail: stats.matcherTopRejection?.detail,
          reviewHint: hint.reviewHint,
          failureKind: hint.failureKind,
          topCandidates: stats.topCandidates,
          usedFallbackKeyword: stats.usedFallbackKeyword,
        });
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        const hint = amazonBatchReviewHint('error', undefined, msg);
        results.push({
          itemId: item.id,
          itemName: item.name,
          outcome: 'error',
          rawRowsReturned: 0,
          rowsAfterProductFilter: 0,
          normalizedRows: 0,
          cacheHit: false,
          errorMessage: msg,
          reviewHint: hint.reviewHint,
          failureKind: hint.failureKind,
        });
      }
    }

    const estimatedCostUsd = (totalBillableRecords / 1000) * RATE_PER_THOUSAND_USD;

    const textLines: string[] = [
      `Company: ${company.name ?? '(no name)'} (id=${company.id})`,
      `ratePerThousandUsd: ${RATE_PER_THOUSAND_USD} | totalBillableRecords(raw rows, non-cache): ${totalBillableRecords} | estimatedCostUsd: ${estimatedCostUsd.toFixed(4)}`,
      '---',
    ];

    for (const r of results) {
      const base = `itemId=${r.itemId} | ${r.itemName.slice(0, 60)} | raw=${r.rawRowsReturned} filt=${r.rowsAfterProductFilter} norm=${r.normalizedRows} | ${r.outcome}`;
      const tail =
        r.matcherTopRejectionCode != null
          ? ` | topRejection=${r.matcherTopRejectionCode}`
          : '';
      const hint = r.reviewHint ? ` | hint=${r.reviewHint.replace(/\s+/g, ' ').slice(0, 120)}` : '';
      if (r.outcome === 'ok') {
        textLines.push(`${base} | $${r.selectedUnitPrice?.toFixed(2) ?? '?'} | ${r.selectedAsin ?? ''}${tail}`);
      } else if (r.outcome === 'error') {
        textLines.push(`${base} | ${r.errorMessage ?? ''}${hint}`);
      } else {
        textLines.push(
          `${base} | ${r.emptyReason ?? (r.outcome === 'matcher_rejected' ? 'matcher rejected all candidates' : '')}${tail}${hint}`
        );
      }
    }

    const textReport = textLines.join('\n');

    res.json({
      companyId: company.id,
      companyName: company.name ?? '',
      skipCache: bypassCache,
      ensureItems,
      summary: {
        totalItems: results.length,
        successCount,
        noRowsCount,
        matcherRejectedCount,
        errorCount,
        skippedNeedsClarificationCount: skippedCount,
        totalBillableRecords,
        ratePerThousandUsd: RATE_PER_THOUSAND_USD,
        estimatedCostUsd,
      },
      note: 'estimatedCostUsd uses summed raw row counts × rate; Bright Data billing may differ.',
      results,
      textReport,
    });
  } catch (error) {
    console.error('Error in amazon-live-batch:', error);
    res.status(500).json({
      error: 'Amazon live batch failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    if (batchProgressActive) {
      amazonLiveBatchProgress = { phase: 'idle' };
    }
  }
});

/**
 * GET /api/test/match-health
 * Aggregate Item matchStatus / clarification counts for the current company (TEST_MODE).
 */
router.get('/match-health', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({ error: 'Test mode is not enabled' });
    }
    const companyId = req.companyId;
    if (companyId == null) {
      return res.status(400).json({
        error: 'Missing company context',
        hint: 'Run Setup Test Environment, or use X-Test-User-Email so companyContext resolves.',
      });
    }
    const [byMatchStatus, needsClarificationCount, vagueNameCount] = await Promise.all([
      prisma.item.groupBy({
        by: ['matchStatus'],
        where: { companyId },
        _count: { _all: true },
      }),
      prisma.item.count({ where: { companyId, needsClarification: true } }),
      prisma.item.count({ where: { companyId, isVagueName: true } }),
    ]);
    res.json({
      companyId,
      byMatchStatus: byMatchStatus.map((r) => ({
        matchStatus: r.matchStatus,
        count: r._count._all,
      })),
      needsClarificationCount,
      vagueNameCount,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in match-health:', error);
    res.status(500).json({
      error: 'match-health failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/test/match-state-audit
 * List contradictory match states so stale records can be rematched/cleaned up.
 */
router.get('/match-state-audit', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({ error: 'Test mode is not enabled' });
    }
    const companyId = req.companyId;
    if (companyId == null) {
      return res.status(400).json({
        error: 'Missing company context',
        hint: 'Run Setup Test Environment, or use X-Test-User-Email so companyContext resolves.',
      });
    }

    const suspicious = await prisma.item.findMany({
      where: {
        companyId,
        OR: [
          {
            AND: [
              { matchStatus: 'unmatched' },
              { matchConfidence: null },
              {
                OR: [
                  { matchProvider: { not: null } },
                  { matchedRetailer: { not: null } },
                  { matchUrl: { not: null } },
                  { matchedUrl: { not: null } },
                  { matchTitle: { not: null } },
                  { matchPrice: { not: null } },
                  { matchedPrice: { not: null } },
                ],
              },
            ],
          },
          {
            AND: [
              { matchConfidence: { not: null } },
              {
                matchProvider: null,
                matchedRetailer: null,
                matchUrl: null,
                matchedUrl: null,
                matchTitle: null,
                matchPrice: null,
                matchedPrice: null,
              },
            ],
          },
        ],
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        matchStatus: true,
        matchConfidence: true,
        matchProvider: true,
        matchedRetailer: true,
        matchUrl: true,
        matchedUrl: true,
        matchTitle: true,
        matchPrice: true,
        matchedPrice: true,
        lastMatchedAt: true,
      },
    });

    res.json({
      companyId,
      count: suspicious.length,
      suspicious,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in match-state-audit:', error);
    res.status(500).json({
      error: 'match-state-audit failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/test/users
 * List test users for "View as" switcher (TEST_MODE only). Used to test multi-company and multi-user-per-company.
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({ error: 'Test mode is not enabled' });
    }

    // After full-reset setup, this returns all company-linked test users.
    // Full reset keeps only the curated company users in dev TEST_MODE.
    const users = await prisma.user.findMany({
      where: {
        companyId: { not: null },
      },
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: [{ companyId: 'asc' }, { email: 'asc' }],
    });
    const seen = new Set<number>();
    const unique = users.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
    res.json({
      users: unique.map((u) => ({
        email: u.email,
        name: u.name,
        companyId: u.companyId,
        companyName: u.company?.name ?? null,
      })),
    });
  } catch (error) {
    console.error('Error listing test users:', error);
    res.status(500).json({
      error: 'Failed to list test users',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/setup
 * Create test user and company
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({
        error: 'Test mode is not enabled. Set TEST_MODE=true in environment.',
      });
    }

    const now = new Date();
    const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;

    // Full reset for curated test scenarios.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        TRUNCATE TABLE
          "Alert",
          "Price",
          "PriceHistory",
          "SavingsSummary",
          "RetailerPriceQuote",
          "ItemRetailerMatch",
          "Item",
          "Invite",
          "User",
          "Company"
        RESTART IDENTITY CASCADE
      `);
    });

    type CreatedCompany = { id: number; name: string | null; realmId: string | null; userId: number; userEmail: string };
    const createdCompanies: CreatedCompany[] = [];
    let createdItems = 0;

    for (const blueprint of TEST_COMPANY_BLUEPRINTS) {
      const company = await prisma.company.create({
        data: {
          name: blueprint.name,
          realmId: blueprint.realmId,
          isSubscribed: true,
          stripeCustomerId: `test_customer_${blueprint.kind}`,
          stripeSubscriptionId: `test_subscription_${blueprint.kind}`,
          paymentMethodAddedAt: now,
          trialStartedAt: now,
          trialEndsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          importCompletedAt: now,
          importLastAttemptedAt: now,
          isQuickBooksConnected: true,
          lastImportedItemCount: blueprint.items.length,
        },
      });

      const user = await prisma.user.create({
        data: {
          email: blueprint.userEmail,
          name: blueprint.userName,
          companyId: company.id,
          quickbooksRealmId: company.realmId,
          quickbooksConnectedAt: now,
          onboardingCompleted: true,
        },
      });

      for (const row of blueprint.items) {
        let matchStatus: 'auto_matched' | 'needs_review' | 'unmatched' = 'auto_matched';
        let matchConfidence = 0.86;
        if (row.difficulty === 'medium_ambiguous') {
          matchStatus = 'needs_review';
          matchConfidence = 0.58;
        } else if (row.difficulty === 'hard_not_found') {
          matchStatus = 'unmatched';
          matchConfidence = 0.28;
        }
        const vague = isVagueName(row.name);
        const clarificationNeeded =
          row.difficulty === 'hard_not_found' ? true : needsClarification(row.name, matchConfidence);

        await prisma.item.create({
          data: {
            userId: user.id,
            companyId: company.id,
            name: row.name,
            category: row.category,
            vendorName: row.vendorName,
            productBrand: row.productBrand ?? null,
            amazonSearchHint: row.amazonSearchHint ?? null,
            baselinePrice: row.baselineUnitPrice,
            baselineUnitPrice: row.baselineUnitPrice,
            baselineSetAt: now,
            baselineSource: 'manual',
            lastPaidPrice: row.lastPaidPrice,
            quantityPerOrder: row.quantityPerOrder,
            reorderIntervalDays: row.reorderIntervalDays,
            purchaseCount: row.difficulty === 'easy_found' ? 7 : row.difficulty === 'medium_ambiguous' ? 4 : 2,
            estimatedMonthlyUnits: row.quantityPerOrder,
            firstPurchasedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
            lastPurchasedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
            isVagueName: vague,
            needsClarification: clarificationNeeded,
            matchStatus,
            matchConfidence,
            isMonitored: false,
            isPaused: false,
          },
        });
        createdItems += 1;
      }

      await recomputeMonitoringForCompany(company.id, maxMonitoredItems);
      createdCompanies.push({
        id: company.id,
        name: company.name,
        realmId: company.realmId,
        userId: user.id,
        userEmail: user.email,
      });
    }

    const defaultCompany =
      createdCompanies.find((c) => c.userEmail === ((appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com')) ||
      createdCompanies[0];
    const defaultUser = await prisma.user.findUnique({ where: { id: defaultCompany.userId } });

    res.json({
      success: true,
      resetPerformed: true,
      message: 'Full reset completed. Replaced existing data with 3 paid test companies.',
      company: {
        id: defaultCompany.id,
        name: defaultCompany.name,
        realmId: defaultCompany.realmId,
      },
      user: defaultUser
        ? {
            id: defaultUser.id,
            email: defaultUser.email,
            companyId: defaultUser.companyId,
          }
        : null,
      companies: createdCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        realmId: c.realmId,
        userEmail: c.userEmail,
      })),
      createdItems,
    });
  } catch (error) {
    console.error('Error setting up test environment:', error);
    res.status(500).json({
      error: 'Failed to setup test environment',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/skip-import
 * Mark import as completed so activation moves to READY. TEST_MODE only.
 * Use when stuck at "Analyzing Your Purchase History" during testing.
 */
router.post('/skip-import', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({
        error: 'Test mode is not enabled. Set TEST_MODE=true in environment.',
      });
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company context' });
    }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        importCompletedAt: new Date(),
        importLastAttemptedAt: new Date(),
        lastImportedItemCount: 1,
      },
    });

    res.json({ success: true, message: 'Import skipped. Refresh to continue.' });
  } catch (error) {
    console.error('Error skipping import:', error);
    res.status(500).json({
      error: 'Failed to skip import',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/import-sample-data
 * Import sample QuickBooks purchase data
 */
router.post('/import-sample-data', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({
        error: 'Test mode is not enabled. Set TEST_MODE=true in environment.',
      });
    }

    const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;
    const testUserEmail = (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com';

    // Get test user
    const user = await prisma.user.findUnique({
      where: { email: testUserEmail },
      include: { company: true },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'Test user not found. Run /api/test/setup first.' });
    }

    // Load sample data
    const purchasesPath = path.join(__dirname, '../../test-data/sample_purchases.json');
    const vendorsPath = path.join(__dirname, '../../test-data/sample_vendors.json');

    if (!fs.existsSync(purchasesPath) || !fs.existsSync(vendorsPath)) {
      return res.status(404).json({
        error: 'Sample data files not found',
        purchasesPath,
        vendorsPath,
      });
    }

    const purchases = JSON.parse(fs.readFileSync(purchasesPath, 'utf-8'));
    const vendors = JSON.parse(fs.readFileSync(vendorsPath, 'utf-8'));

    console.log(`📦 Importing ${purchases.length} sample purchases for test company ${testCompanyId}...`);

    // Process purchases similar to real QuickBooks import
    const uniqueItems = new Map<string, any>();

    for (const purchase of purchases) {
      const vendorName = purchase.VendorRef?.name || 'Unknown Vendor';
      const txnDate = new Date(purchase.TxnDate);

      for (const line of purchase.Line || []) {
        if (line.DetailType === 'ItemBasedExpenseLineDetail') {
          const detail = line.ItemBasedExpenseLineDetail;
          const itemName = detail.ItemRef?.name || line.Description || 'Unknown Item';
          const quantity = detail.Qty || 1;
          const unitPrice = detail.UnitPrice || line.Amount / quantity;
          const totalAmount = line.Amount || unitPrice * quantity;

          const key = `${itemName.toLowerCase()}_${vendorName.toLowerCase()}`;

          if (!uniqueItems.has(key)) {
            uniqueItems.set(key, {
              name: itemName,
              vendorName,
              lastPaidPrice: unitPrice,
              quantity,
              firstPurchasedAt: txnDate,
              lastPurchasedAt: txnDate,
              purchaseCount: 1,
              totalQuantity: quantity,
            });
          } else {
            const existing = uniqueItems.get(key)!;
            existing.purchaseCount += 1;
            existing.totalQuantity += quantity;
            existing.firstPurchasedAt = existing.firstPurchasedAt < txnDate ? existing.firstPurchasedAt : txnDate;
            existing.lastPurchasedAt = existing.lastPurchasedAt > txnDate ? existing.lastPurchasedAt : txnDate;
            // Update price to most recent
            existing.lastPaidPrice = unitPrice;
          }
        }
      }
    }

    // Create or update items
    let createdCount = 0;
    let updatedCount = 0;

    for (const [key, itemData] of uniqueItems.entries()) {
      const existingItem = await prisma.item.findFirst({
        where: {
          userId: user.id,
          name: itemData.name,
          vendorName: itemData.vendorName,
        },
      });

      if (existingItem) {
        // Calculate estimated monthly units
        const daysBetween = Math.max(
          1,
          Math.ceil((itemData.lastPurchasedAt.getTime() - itemData.firstPurchasedAt.getTime()) / (1000 * 60 * 60 * 24))
        );
        const estimatedMonthlyUnits = (itemData.totalQuantity / daysBetween) * 30;

        await prisma.item.update({
          where: { id: existingItem.id },
          data: {
            lastPaidPrice: itemData.lastPaidPrice,
            purchaseCount: { increment: itemData.purchaseCount },
            firstPurchasedAt: itemData.firstPurchasedAt < existingItem.firstPurchasedAt! 
              ? itemData.firstPurchasedAt 
              : existingItem.firstPurchasedAt,
            lastPurchasedAt: itemData.lastPurchasedAt > existingItem.lastPurchasedAt!
              ? itemData.lastPurchasedAt
              : existingItem.lastPurchasedAt,
            estimatedMonthlyUnits,
          },
        });
        updatedCount++;
      } else {
        // Calculate estimated monthly units
        const daysBetween = Math.max(
          1,
          Math.ceil((itemData.lastPurchasedAt.getTime() - itemData.firstPurchasedAt.getTime()) / (1000 * 60 * 60 * 24))
        );
        const estimatedMonthlyUnits = (itemData.totalQuantity / daysBetween) * 30;

        await prisma.item.create({
          data: {
            userId: user.id,
            companyId: testCompanyId,
            name: itemData.name,
            vendorName: itemData.vendorName,
            lastPaidPrice: itemData.lastPaidPrice,
            purchaseCount: itemData.purchaseCount,
            firstPurchasedAt: itemData.firstPurchasedAt,
            lastPurchasedAt: itemData.lastPurchasedAt,
            estimatedMonthlyUnits,
          },
        });
        createdCount++;
      }
    }

    console.log(`✅ Imported ${createdCount} new items, updated ${updatedCount} existing items`);

    // Recompute monitoring
    const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
    console.log(`🔄 Recomputing monitoring priorities for company ${testCompanyId}...`);
    await recomputeMonitoringForCompany(testCompanyId, maxMonitoredItems);

    const monitoredCount = await prisma.item.count({
      where: {
        userId: user.id,
        isMonitored: true,
      },
    });

    console.log(`✅ Monitoring recalculated. ${monitoredCount} items marked as monitored.`);

    res.json({
      success: true,
      itemsCreated: createdCount,
      itemsUpdated: updatedCount,
      totalItems: uniqueItems.size,
      monitoredItems: monitoredCount,
      message: `Imported ${uniqueItems.size} unique items. ${monitoredCount} items marked as monitored.`,
    });
  } catch (error) {
    console.error('Error importing sample data:', error);
    res.status(500).json({
      error: 'Failed to import sample data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/force-subscribe
 * Simulate Stripe subscription (test mode only)
 */
router.post('/force-subscribe', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({
        error: 'Test mode is not enabled. Set TEST_MODE=true in environment.',
      });
    }

    const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;

    const company = await prisma.company.findUnique({
      where: { id: testCompanyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Test company not found. Run /api/test/setup first.' });
    }

    await prisma.company.update({
      where: { id: testCompanyId },
      data: {
        isSubscribed: true,
        stripeCustomerId: company.stripeCustomerId || `test_customer_${testCompanyId}`,
        stripeSubscriptionId: company.stripeSubscriptionId || `test_sub_${testCompanyId}`,
      },
    });

    console.log(`✅ Subscription updated: company.isSubscribed = true | Source: Test Mode`);

    res.json({
      success: true,
      message: 'Company subscription activated (test mode)',
      company: {
        id: company.id,
        isSubscribed: true,
      },
    });
  } catch (error) {
    console.error('Error forcing subscription:', error);
    res.status(500).json({
      error: 'Failed to force subscription',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/force-unsubscribe
 * Simulate Stripe cancellation (test mode only)
 */
router.post('/force-unsubscribe', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({
        error: 'Test mode is not enabled. Set TEST_MODE=true in environment.',
      });
    }

    const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;

    const company = await prisma.company.findUnique({
      where: { id: testCompanyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Test company not found. Run /api/test/setup first.' });
    }

    await prisma.company.update({
      where: { id: testCompanyId },
      data: {
        isSubscribed: false,
        stripeSubscriptionId: null,
      },
    });

    console.log(`✅ Subscription updated: company.isSubscribed = false | Source: Test Mode`);

    res.json({
      success: true,
      message: 'Company subscription cancelled (test mode)',
      company: {
        id: company.id,
        isSubscribed: false,
      },
    });
  } catch (error) {
    console.error('Error forcing unsubscribe:', error);
    res.status(500).json({
      error: 'Failed to force unsubscribe',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/recompute-monitoring
 * Recompute monitoring priorities
 */
router.post('/recompute-monitoring', async (req: Request, res: Response) => {
  try {
    const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;
    const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;

    console.log(`🔄 Recomputing monitoring priorities for Company #${testCompanyId}...`);
    await recomputeMonitoringForCompany(testCompanyId, maxMonitoredItems);

    const monitoredCount = await prisma.item.count({
      where: {
        user: {
          companyId: testCompanyId,
        },
        isMonitored: true,
      },
    });

    console.log(`✅ Monitoring recalculated for Company #${testCompanyId}`);
    console.log(`   Monitored items: ${monitoredCount}`);

    res.json({
      success: true,
      monitoredItems: monitoredCount,
      message: `Monitoring recalculated. ${monitoredCount} items marked as monitored.`,
    });
  } catch (error) {
    console.error('Error recomputing monitoring:', error);
    res.status(500).json({
      error: 'Failed to recompute monitoring',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/run-price-check
 * Run a single price check cycle
 */
router.post('/run-price-check', async (req: Request, res: Response) => {
  try {
    const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;

    if (TEST_MODE) {
      console.log(`🔍 Running simulated price check cycle (test mode)...`);
      
      // Generate simulated price drops instead of real API calls
      const simulatedAlerts = await generateSimulatedPriceDrops(testCompanyId);
      
      const alertsCount = await prisma.alert.count({
        where: {
          item: {
            user: {
              companyId: testCompanyId,
            },
          },
        },
      });

      const recentAlerts = await prisma.alert.findMany({
        where: {
          item: {
            user: {
              companyId: testCompanyId,
            },
          },
        },
        orderBy: {
          alertDate: 'desc',
        },
        take: 5,
        include: {
          item: true,
        },
      });

      console.log(`✅ Simulated price check complete`);
      console.log(`   Simulated alerts created: ${simulatedAlerts}`);
      console.log(`   Total alerts for company: ${alertsCount}`);

      return res.json({
        success: true,
        alertsCount,
        simulatedAlertsCreated: simulatedAlerts,
        recentAlerts: recentAlerts.map(a => ({
          id: a.id,
          itemName: a.item.name,
          retailer: a.retailer,
          oldPrice: a.oldPrice,
          newPrice: a.newPrice,
          savingsPerOrder: a.savingsPerOrder,
          alertDate: a.alertDate,
        })),
        message: `Simulated price check complete. ${simulatedAlerts} new alerts created.`,
      });
    }

    console.log(`🔍 Running price check cycle...`);
    
    await runDailyPriceCheck();

    // testCompanyId already declared at top of function
    const alertsCount = await prisma.alert.count({
      where: {
        item: {
          user: {
            companyId: testCompanyId,
          },
        },
      },
    });

    const recentAlerts = await prisma.alert.findMany({
      where: {
        item: {
          user: {
            companyId: testCompanyId,
          },
        },
      },
      orderBy: {
        alertDate: 'desc',
      },
      take: 5,
      include: {
        item: true,
      },
    });

    console.log(`✅ Daily price check complete`);
    console.log(`   Total alerts for company: ${alertsCount}`);

    res.json({
      success: true,
      alertsCount,
      recentAlerts: recentAlerts.map(a => ({
        id: a.id,
        itemName: a.item.name,
        retailer: a.retailer,
        oldPrice: a.oldPrice,
        newPrice: a.newPrice,
        savingsPerOrder: a.savingsPerOrder,
        alertDate: a.alertDate,
      })),
      message: `Price check complete. ${alertsCount} total alerts.`,
    });
  } catch (error) {
    console.error('Error running price check:', error);
    res.status(500).json({
      error: 'Failed to run price check',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/test/price-history-status
 * Check if PriceHistory table exists and has data
 */
router.get('/price-history-status', async (req: Request, res: Response) => {
  try {
    // Try to query PriceHistory table
    const count = await prisma.priceHistory.count();
    const sample = await prisma.priceHistory.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        item: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      tableExists: true,
      totalRecords: count,
      sampleRecords: sample.map(s => ({
        id: s.id,
        itemId: s.itemId,
        itemName: s.item.name,
        price: s.price,
        retailer: s.retailer,
        createdAt: s.createdAt,
      })),
      message: count === 0 
        ? 'PriceHistory table exists but has no data. Run price checks to create history.'
        : `PriceHistory table exists with ${count} records.`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's a table doesn't exist error
    if (errorMessage.includes('PriceHistory') || errorMessage.includes('does not exist') || errorMessage.includes('no such table')) {
      return res.status(500).json({
        success: false,
        tableExists: false,
        error: 'PriceHistory table does not exist',
        message: 'Please run the Prisma migration: npx prisma migrate dev --name add_price_history',
        details: errorMessage,
      });
    }

    res.status(500).json({
      success: false,
      tableExists: false,
      error: 'Error checking PriceHistory table',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/test/break-qb-connection
 * Simulate a broken QuickBooks connection by setting connectionBrokenAt
 */
router.post('/break-qb-connection', async (req: Request, res: Response) => {
  try {
    const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;

    const company = await prisma.company.findUnique({
      where: { id: testCompanyId },
    });

    if (!company) {
      return res.status(404).json({
        error: 'Test company not found',
      });
    }

    // Set connectionBrokenAt to simulate a broken connection
    await prisma.company.update({
      where: { id: testCompanyId },
      data: {
        connectionBrokenAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'QuickBooks connection marked as broken for testing',
      companyId: testCompanyId,
      connectionBrokenAt: new Date(),
    });
  } catch (error) {
    console.error('Error breaking QB connection:', error);
    res.status(500).json({
      error: 'Failed to break connection',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/create-matching-edge-cases
 * Create test items with tricky matching cases (test mode only)
 */
router.post('/create-matching-edge-cases', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({
        error: 'Test mode is not enabled. Set TEST_MODE=true in environment.',
      });
    }

    const testUserEmail = (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com';

    // Get test user
    const user = await prisma.user.findUnique({
      where: { email: testUserEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Test user not found. Run /api/test/setup first.' });
    }

    // Import matching service
    const { matchItemToRetailers } = await import('../services/matchItem');
    const { normalizeItemName } = await import('../services/matching/normalize');

    // Create test items with various edge cases
    const edgeCaseItems = [
      { name: 'paper', lastPaidPrice: 15.99 }, // Vague name
      { name: 'coffee', lastPaidPrice: 12.99 }, // Vague name
      { name: 'HP printer paper 500 sheets', lastPaidPrice: 24.99 }, // Brand + size
      { name: 'Brother CF237A toner cartridge', lastPaidPrice: 45.99 }, // Model number
      { name: 'K-cups variety pack', lastPaidPrice: 18.99 }, // Ambiguous name
      { name: 'Georgia-Pacific 500 sheet copy paper', lastPaidPrice: 22.99 }, // Brand + size
      { name: 'Scotch tape 12-pack', lastPaidPrice: 16.99 }, // Brand + count
      { name: '3M Post-it Notes 5x8 inch 100 sheets', lastPaidPrice: 19.99 }, // Full specs
    ];

    const createdItems = [];

    for (const itemData of edgeCaseItems) {
      // Create item
      const item = await prisma.item.create({
        data: {
          userId: user.id,
          companyId: user.companyId!,
          name: itemData.name,
          lastPaidPrice: itemData.lastPaidPrice,
          category: 'Office Supplies',
        },
      });

      // Normalize name
      const itemMeta = normalizeItemName(item.name);
      
      // Match item
      const match = await matchItemToRetailers(item.name, item.lastPaidPrice, false, {
        productBrand: item.productBrand,
        amazonSearchHint: item.amazonSearchHint,
        amazonAsin: item.amazonAsin,
      });
      
      // Determine if clarification is needed
      const { isVagueName, needsClarification } = await import('../services/matchItem');
      const vagueName = isVagueName(item.name);
      const clarificationNeeded = needsClarification(item.name, match?.confidence || null);

      // Update with match data
      const updateData: any = {
        normalizedName: itemMeta.normalized,
        isVagueName: vagueName,
        needsClarification: clarificationNeeded,
      };

      if (match) {
        updateData.matchStatus = match.status;
        updateData.matchConfidence = match.confidence;
        
        if (match.retailer) {
          updateData.matchProvider = match.retailer;
          updateData.matchedRetailer = match.retailer.charAt(0).toUpperCase() + match.retailer.slice(1);
        }
        if (match.url) {
          updateData.matchUrl = match.url;
          updateData.matchedUrl = match.url;
        }
        if (match.title) {
          updateData.matchTitle = match.title;
        }
        if (match.price) {
          updateData.matchPrice = match.price;
          updateData.matchedPrice = match.price;
        }
        
        if (match.matchReasons || match.alternatives) {
          updateData.matchReasons = {
            ...(match.matchReasons || {}),
            alternatives: match.alternatives || [],
          };
        }
        
        updateData.lastMatchedAt = new Date();
      } else {
        updateData.matchStatus = 'unmatched';
        updateData.matchConfidence = null;
      }

      const updatedItem = await prisma.item.update({
        where: { id: item.id },
        data: updateData,
      });

      createdItems.push(updatedItem);
      console.log(`✅ Created edge case item: ${item.name} (status: ${updateData.matchStatus || 'unmatched'})`);
    }

    console.log(`✅ Created ${createdItems.length} edge case items for matching testing`);

    res.json({
      success: true,
      message: `Created ${createdItems.length} edge case items`,
      items: createdItems.map(item => ({
        id: item.id,
        name: item.name,
        matchStatus: item.matchStatus,
        matchConfidence: item.matchConfidence,
        isVagueName: item.isVagueName,
        needsClarification: item.needsClarification,
      })),
    });
  } catch (error) {
    console.error('Error creating matching edge cases:', error);
    res.status(500).json({
      error: 'Failed to create matching edge cases',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/test/create-baseline-scenarios
 * Create items for baseline/dealStatus testing: valid baseline+deal, valid baseline+no_deal, no baseline, and no price scenario.
 */
router.post('/create-baseline-scenarios', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({ error: 'Test mode is not enabled.' });
    }
    const testUserEmail = (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com';
    const testCompanyId = (appConfig.testing?.testCompanyId as number) || 1;
    const user = await prisma.user.findFirst({ where: { email: testUserEmail } });
    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'Test user not found. Run /api/test/setup first.' });
    }

    const scenarios = [
      { name: 'Baseline Deal Item', baselineUnitPrice: 100, baselineSource: 'manual' as const },
      { name: 'Baseline No-Deal Item', baselineUnitPrice: 50, baselineSource: 'manual' as const },
      { name: 'No Baseline Item', baselineUnitPrice: null, baselineSource: null },
      { name: 'Baseline For No-Price Item', baselineUnitPrice: 25, baselineSource: 'manual' as const },
    ];

    const created: { id: number; name: string; baselineUnitPrice: number | null; baselineSource: string | null }[] = [];
    for (const s of scenarios) {
      const item = await prisma.item.create({
        data: {
          userId: user.id,
          companyId: testCompanyId,
          name: s.name,
          lastPaidPrice: s.baselineUnitPrice ?? 20,
          baselinePrice: s.baselineUnitPrice ?? 20,
          baselineUnitPrice: s.baselineUnitPrice,
          baselineSetAt: s.baselineUnitPrice != null ? new Date() : null,
          baselineSource: s.baselineSource,
        },
      });
      created.push({
        id: item.id,
        name: item.name,
        baselineUnitPrice: item.baselineUnitPrice,
        baselineSource: item.baselineSource,
      });
    }

    res.json({
      success: true,
      message: 'Baseline scenario items created',
      items: created,
    });
  } catch (error) {
    console.error('Error creating baseline scenarios:', error);
    res.status(500).json({
      error: 'Failed to create baseline scenarios',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/test/verify-baseline
 * Assert: baseline P90/fallback, no price stored as 0, dealStatus shape.
 */
router.get('/verify-baseline', async (req: Request, res: Response) => {
  try {
    if (!TEST_MODE) {
      return res.status(403).json({ error: 'Test mode is not enabled.' });
    }

    const checks: { name: string; passed: boolean; detail?: string }[] = [];

    // 1) P90 and fallback
    const p90 = computeP90([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const p90Ok = p90 === 90; // 90th percentile of 10 values
    checks.push({ name: 'computeP90 returns 90 for 10 values', passed: p90Ok, detail: `got ${p90}` });

    const fallback = computeBaseline([12, 18]);
    const fallbackOk = fallback.baseline === 18 && fallback.source === 'qb_max_fallback';
    checks.push({ name: 'computeBaseline uses max when <5 prices', passed: fallbackOk, detail: JSON.stringify(fallback) });

    const p90Source = computeBaseline([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const p90SourceOk = p90Source.source === 'qb_p90' && p90Source.baseline === 9;
    checks.push({ name: 'computeBaseline uses qb_p90 when >=5 prices', passed: p90SourceOk, detail: JSON.stringify(p90Source) });

    // 2) No price stored as 0
    const zeroPrices = await prisma.price.count({ where: { price: { lte: 0 } } });
    const zeroAlerts = await prisma.alert.count({ where: { newPrice: { lte: 0 } } });
    checks.push({ name: 'No Price record with price <= 0', passed: zeroPrices === 0, detail: `count: ${zeroPrices}` });
    checks.push({ name: 'No Alert with newPrice <= 0', passed: zeroAlerts === 0, detail: `count: ${zeroAlerts}` });

    const allPassed = checks.every(c => c.passed);
    res.json({
      success: allPassed,
      checks,
      message: allPassed ? 'All baseline checks passed' : 'Some checks failed',
    });
  } catch (error) {
    console.error('Error verifying baseline:', error);
    res.status(500).json({
      error: 'Failed to verify baseline',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

