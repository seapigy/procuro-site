import '../loadEnv';
import { Router, Request, Response } from 'express';
import OAuthClient from 'intuit-oauth';
import axios from 'axios';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { computeBaseline, isValidUnitPrice } from '../services/baseline';
import { matchItemToRetailers, isVagueName, needsClarification } from '../services/matchItem';
import { recomputeMonitoringForCompany } from '../services/monitoring';
import { disconnectQuickBooksForRequest } from '../services/quickbooksDisconnect';
import { encryptTokens, getDecryptedQBTokens } from '../utils/crypto';
import { refreshQuickBooksToken } from '../workers/tokenRefresh';
import appConfig from '../../../config/app.json';
import { finishImportRun, mapImportErrorCode, safeErrorMessage, startImportRun } from '../services/importRun';

const router = Router();
const TEST_MODE =
  String(process.env.TEST_MODE || '').trim().toLowerCase() === 'true' ||
  (appConfig.testing?.testMode as boolean) ||
  false;
const TEST_USER_EMAIL = (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_STATE_PREFIX = 'procuro_qb';
const qbOAuthStates = new Map<string, { inviteToken?: string; mode: 'connect' | 'reconnect'; createdAt: number }>();

function clearPersistedMatchEvidence(target: Record<string, any>): void {
  target.matchProvider = null;
  target.matchedRetailer = null;
  target.matchUrl = null;
  target.matchedUrl = null;
  target.matchTitle = null;
  target.matchPrice = null;
  target.matchedPrice = null;
}

function applyUnmatchedState(target: Record<string, any>, itemName: string): void {
  target.matchStatus = 'unmatched';
  target.matchConfidence = null;
  target.normalizedName = itemName.toLowerCase().trim();
  clearPersistedMatchEvidence(target);
}

function hasConcreteMatchEvidence(match: any): boolean {
  if (!match) return false;
  const retailer = typeof match.retailer === 'string' ? match.retailer.trim() : '';
  const url = typeof match.url === 'string' ? match.url.trim() : '';
  const hasPrice = typeof match.price === 'number' && Number.isFinite(match.price) && match.price > 0;
  return retailer.length > 0 && url.length > 0 && hasPrice;
}

function buildOAuthState(mode: 'connect' | 'reconnect', inviteToken?: string): string {
  const nonce = crypto.randomBytes(24).toString('base64url');
  qbOAuthStates.set(nonce, { mode, inviteToken, createdAt: Date.now() });
  return `${OAUTH_STATE_PREFIX}:${nonce}`;
}

function consumeOAuthState(state: string | undefined): { inviteToken?: string; mode: 'connect' | 'reconnect' } {
  if (!state || !state.startsWith(`${OAUTH_STATE_PREFIX}:`)) {
    throw new Error('Invalid OAuth state');
  }
  const nonce = state.slice(`${OAUTH_STATE_PREFIX}:`.length);
  const saved = qbOAuthStates.get(nonce);
  qbOAuthStates.delete(nonce);
  if (!saved) {
    throw new Error('OAuth state not found or already used');
  }
  if (Date.now() - saved.createdAt > OAUTH_STATE_TTL_MS) {
    throw new Error('OAuth state expired');
  }
  return { inviteToken: saved.inviteToken, mode: saved.mode };
}

function isTokenExpiredError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status ?? 0;
  const authHeader = String(error.response?.headers?.['www-authenticate'] || '').toLowerCase();
  return status === 401 || authHeader.includes('invalid_token') || authHeader.includes('token expired');
}

async function resolveQuickBooksUser(req: Request): Promise<{
  user: any;
  companyId: number;
} | null> {
  let user =
    req.companyContextUser
      ? await prisma.user.findUnique({
          where: { id: req.companyContextUser.id },
          include: { company: true },
        })
      : null;

  if (!user && req.companyId) {
    user = await prisma.user.findFirst({
      where: { companyId: req.companyId },
      include: { company: true },
    });
  }

  if (!user && TEST_MODE) {
    user = await prisma.user.findFirst({
      where: { email: TEST_USER_EMAIL },
      include: { company: true },
    });
  }

  if (!user || !user.companyId) return null;
  return { user, companyId: user.companyId };
}

/** Lazy singleton so QUICKBOOKS_* from server/.env is loaded after import './loadEnv' in index.ts */
let oauthClientSingleton: any = null;
function getOAuthClient() {
  if (!oauthClientSingleton) {
    const clientId = (process.env.QUICKBOOKS_CLIENT_ID || '').trim();
    const clientSecret = (process.env.QUICKBOOKS_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
      throw new Error(
        'Missing QUICKBOOKS_CLIENT_ID or QUICKBOOKS_CLIENT_SECRET — check server/.env (ensure loadEnv runs before QuickBooks routes).'
      );
    }
    oauthClientSingleton = new OAuthClient({
      clientId,
      clientSecret,
      environment: (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:5000/api/qb/callback',
    });
  }
  return oauthClientSingleton;
}

/**
 * GET /api/qb/connect
 * Initiates the QuickBooks OAuth 2.0 flow
 * Supports inviteToken parameter for joining existing companies
 */
router.get('/connect', (req: Request, res: Response) => {
  try {
    const { inviteToken } = req.query;
    const state = buildOAuthState(
      'connect',
      typeof inviteToken === 'string' && inviteToken.trim() ? inviteToken.trim() : undefined
    );
    
    // Generate authorization URI
    const authUri = getOAuthClient().authorizeUri({
      scope: [
        OAuthClient.scopes.Accounting,
        OAuthClient.scopes.OpenId,
        OAuthClient.scopes.Profile,
        OAuthClient.scopes.Email,
      ],
      state,
    });

    // Redirect user to QuickBooks authorization page
    res.redirect(authUri);
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    const details = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to initiate QuickBooks connection',
      ...(process.env.NODE_ENV !== 'production' ? { details } : {}),
    });
  }
});

/**
 * GET /api/qb/callback
 * Handles the OAuth callback and token exchange
 */
router.get('/callback', async (req: Request, res: Response) => {
  let runId: number | null = null;
  try {
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const parsedState = consumeOAuthState(state);
    const parseRedirect = req.url;

    // Exchange authorization code for access token
    const authResponse = await getOAuthClient().createToken(parseRedirect);
    const token = authResponse.getJson();

    // Extract realm ID (company ID)
    const realmId = getOAuthClient().getToken().realmId;
    
    const inviteToken = parsedState.inviteToken || null;

    // If invite token present, validate and use it
    let invitedCompany = null;
    if (inviteToken) {
      const invite = await prisma.invite.findUnique({
        where: { token: inviteToken },
        include: { company: true },
      });

      if (invite && !invite.used && new Date() < invite.expiresAt) {
        invitedCompany = invite.company;
        console.log(`✅ Valid invite found for: ${invitedCompany.name}`);
        
        // Mark invite as used
        await prisma.invite.update({
          where: { id: invite.id },
          data: { used: true },
        });
        console.log(`✅ Invite marked as used: ${inviteToken}`);
      } else {
        console.warn(`⚠️ Invalid or expired invite: ${inviteToken}`);
      }
    }

    // Determine company to use
    let company;
    
    if (invitedCompany) {
      // Use the company from the invite and update connection status
      company = await prisma.company.update({
        where: { id: invitedCompany.id },
        data: {
          realmId: realmId,
          isQuickBooksConnected: true,
        },
      });
      console.log(`✅ Using invited company: ${company.name}`);
    } else {
      // Normal flow: fetch company info from QuickBooks API
      let companyName = null;
      try {
        const apiUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
          ? 'https://quickbooks.api.intuit.com'
          : 'https://sandbox-quickbooks.api.intuit.com';
        
        const companyInfoResponse = await axios.get(
          `${apiUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
          {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Accept': 'application/json',
            },
          }
        );
        companyName = companyInfoResponse.data?.CompanyInfo?.CompanyName || null;
      } catch (error) {
        console.warn('Could not fetch company name, using realmId');
        companyName = `Company ${realmId}`;
      }

      // Find or create company
      company = await prisma.company.findUnique({
        where: { realmId: realmId },
      });

      if (!company) {
        company = await prisma.company.create({
          data: {
            realmId: realmId,
            name: companyName,
            isQuickBooksConnected: true,
          },
        });
        console.log(`✅ Created new company: ${company.name} (${company.realmId})`);
      } else {
        // Update company name and connection status
        company = await prisma.company.update({
          where: { id: company.id },
          data: {
            realmId: realmId,
            isQuickBooksConnected: true,
            ...(companyName && company.name !== companyName ? { name: companyName } : {}),
          },
        });
        console.log(`✅ Found existing company: ${company.name} (${company.realmId})`);
      }
    }

    let current = await resolveQuickBooksUser(req);
    if (!current?.user && TEST_MODE) {
      const fallback = await prisma.user.findFirst({ where: { email: TEST_USER_EMAIL } });
      if (!fallback) {
        const created = await prisma.user.create({
          data: {
            email: TEST_USER_EMAIL,
            name: 'Test User',
            companyId: company.id,
          },
        });
        current = {
          user: await prisma.user.findUnique({ where: { id: created.id }, include: { company: true } }),
          companyId: company.id,
        };
      }
    }

    if (!current?.user) {
      // Live OAuth callback may not carry app user context yet; fall back to a stable company user.
      const existingCompanyUser = await prisma.user.findFirst({
        where: { companyId: company.id },
        include: { company: true },
      });

      if (existingCompanyUser) {
        current = { user: existingCompanyUser, companyId: company.id };
      } else {
        const fallbackEmail = `qb-${company.id}-${realmId}@procuroapp.local`;
        const createdFallbackUser = await prisma.user.create({
          data: {
            email: fallbackEmail,
            name: 'QuickBooks Connected User',
            companyId: company.id,
          },
        });
        const hydratedFallbackUser = await prisma.user.findUnique({
          where: { id: createdFallbackUser.id },
          include: { company: true },
        });
        current = { user: hydratedFallbackUser, companyId: company.id };
      }
    }

    if (!current?.user) {
      throw new Error('No authenticated user context available for QuickBooks callback');
    }

    const encrypted = encryptTokens(token.access_token ?? null, token.refresh_token ?? null);
    const user = await prisma.user.update({
      where: { id: current.user.id },
      data: {
        companyId: company.id,
        quickbooksAccessToken: encrypted.accessToken,
        quickbooksRefreshToken: encrypted.refreshToken,
        quickbooksRealmId: realmId,
        quickbooksConnectedAt: new Date(),
      },
    });
    console.log(`✅ Updated user: ${user.email} → linked to company ${company.name}`);

    // Fetch and store purchase items with error handling
    let importedCount = 0;
    let importError: Error | null = null;
    
    try {
      if (realmId && token.access_token) {
        runId = await startImportRun({
          companyId: company.id,
          userId: user.id,
          source: 'oauth_callback',
          realmId,
          metadata: { mode: parsedState.mode },
        });
        importedCount = await fetchAndStoreItems(user.id, company.id, token.access_token, realmId);
        await finishImportRun(runId, {
          status: importedCount > 0 ? 'success' : 'empty',
          importedItemCount: importedCount,
        });
      }
    } catch (importErr) {
      console.error('Error during import:', importErr);
      importError = importErr instanceof Error ? importErr : new Error('Unknown import error');
      if (runId) {
        await finishImportRun(runId, {
          status: 'error',
          importedItemCount: 0,
          errorCode: mapImportErrorCode(importErr),
          errorMessage: safeErrorMessage(importErr),
        });
      }
      // Continue with connection success, but mark import as failed
    }

    // Redirect to frontend success page with query params
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const params = new URLSearchParams({
      success: 'true',
      companyName: company.name || '',
      importedCount: importedCount.toString(),
      ...(importError ? { error: 'IMPORT_FAILED', errorMessage: importError.message } : {}),
      ...(inviteToken ? { inviteToken: 'true' } : {}),
    });

    res.redirect(`${frontendUrl}/qb-success?${params.toString()}`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    if (runId) {
      await finishImportRun(runId, {
        status: 'error',
        importedItemCount: 0,
        errorCode: mapImportErrorCode(error),
        errorMessage: safeErrorMessage(error),
      });
    }
    
    // Redirect to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const params = new URLSearchParams({
      success: 'false',
      error: 'AUTHORIZATION_FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.redirect(`${frontendUrl}/qb-success?${params.toString()}`);
  }
});

/**
 * GET /api/qb/items
 * List imported items for the current company-context user
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const current = await resolveQuickBooksUser(req);
    if (!current?.user) {
      return res.status(404).json({ 
        error: 'User context not found. Please connect to QuickBooks first.',
        connectUrl: '/api/qb/connect'
      });
    }
    const user = current.user;

    // Fetch items for this user
    const items = await prisma.item.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        quickbooksConnected: !!user.quickbooksRealmId,
        connectedAt: user.quickbooksConnectedAt,
      },
      itemCount: items.length,
      items: items,
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ 
      error: 'Failed to fetch items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Helper function to fetch purchase/bill items from QuickBooks
 * and store them in the database
 * Returns the count of unique items imported
 */
async function fetchAndStoreItems(
  userId: number,
  companyId: number,
  accessToken: string,
  realmId: string
): Promise<number> {
  if (!realmId || realmId.trim() === '') {
    console.error('fetchAndStoreItems: realmId is required for Intuit API calls');
    throw new Error('realmId is required');
  }
  console.log(`📦 Importing from QuickBooks realmId=${realmId} (companyId=${companyId})`);
  /** Default true: do not call Bright Data / retailer matching on every QB line (slow, costly, poor keywords from bills). */
  const skipRetailerMatchOnQbImport =
    String(process.env.QB_IMPORT_SKIP_RETAILER_MATCH ?? 'true').trim().toLowerCase() !== 'false';
  if (skipRetailerMatchOnQbImport) {
    console.log(
      '🛑 QB import: skipping retailer/Amazon matching (QB_IMPORT_SKIP_RETAILER_MATCH default true). Set to false only if you need legacy per-item matching on import.'
    );
  }
  try {
    const apiUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    // Query for Purchase transactions
    // QuickBooks API query to get last 100 purchases/bills
    const query = `SELECT * FROM Purchase MAXRESULTS 100`;
    
    const response = await axios.get(
      `${apiUrl}/v3/company/${realmId}/query`,
      {
        params: { query, minorversion: 65 },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    const purchases = response.data?.QueryResponse?.Purchase || [];

    // Process and store items
    const itemsToCreate = [];

    for (const purchase of purchases) {
      // Extract line items from the purchase
      const lines = purchase.Line || [];
      
      // Get vendor name from the purchase
      const vendorName = purchase.VendorRef?.name || null;
      
      // Extract purchase date from transaction
      const purchaseDate = purchase.TxnDate 
        ? new Date(purchase.TxnDate)
        : new Date();
      
      for (const line of lines) {
        if (line.DetailType === 'ItemBasedExpenseLineDetail' && line.ItemBasedExpenseLineDetail) {
          const detail = line.ItemBasedExpenseLineDetail;
          const item = detail.ItemRef;
          const qty = detail.Qty || 1;
          const amount = line.Amount ?? 0;
          /** Per-unit paid price (matches retail unit prices for Amazon / matcher sanity checks). */
          const unitPrice = qty > 0 ? amount / qty : 0;
          itemsToCreate.push({
            userId: userId,
            name: item?.name || line.Description || 'Unnamed Item',
            category: detail.ClassRef?.name || null,
            lastPaidPrice: unitPrice,
            unitPrice,
            vendorName: vendorName,
            purchaseDate: purchaseDate, // Include purchase date
            quantity: qty, // Include quantity if available
          });
        } else if (line.DetailType === 'AccountBasedExpenseLineDetail' && line.AccountBasedExpenseLineDetail) {
          // Handle account-based expenses as well
          const amount = line.Amount ?? 0;
          itemsToCreate.push({
            userId: userId,
            name: line.Description || 'Unnamed Expense',
            category: line.AccountBasedExpenseLineDetail.AccountRef?.name || null,
            lastPaidPrice: amount,
            unitPrice: amount,
            vendorName: vendorName,
            purchaseDate: purchaseDate,
            quantity: 1,
          });
        }
      }
    }

    // Process items and track purchase stats
    if (itemsToCreate.length > 0) {
      console.log(`📦 Processing ${itemsToCreate.length} purchase items...`);
      
      // Track purchase dates, quantities, and valid unit prices per item
      const itemPurchaseMap = new Map<string, {
        itemData: Omit<typeof itemsToCreate[0], 'purchaseDate' | 'quantity' | 'unitPrice'>;
        purchaseDates: Date[];
        quantities: number[];
        unitPrices: number[];
        /** Most recent TxnDate used to pick lastPaidPrice (must not be spread into Prisma — not a model field). */
        lastPurchaseDateForPrice?: Date;
      }>();

      // Group items by name and track purchase dates + valid unit prices
      for (const itemData of itemsToCreate) {
        const key = itemData.name.toLowerCase().trim();
        const purchaseDate = (itemData as any).purchaseDate || new Date();
        const quantity = (itemData as any).quantity || 1;
        const unitPrice = (itemData as any).unitPrice as number | undefined;
        
        if (!itemPurchaseMap.has(key)) {
          itemPurchaseMap.set(key, {
            itemData: {
              userId: itemData.userId,
              name: itemData.name,
              category: itemData.category,
              lastPaidPrice: itemData.lastPaidPrice,
              vendorName: itemData.vendorName,
            },
            purchaseDates: [],
            quantities: [],
            unitPrices: [],
          });
        }
        
        const entry = itemPurchaseMap.get(key)!;
        entry.purchaseDates.push(purchaseDate);
        entry.quantities.push(quantity);
        if (isValidUnitPrice(unitPrice, quantity)) {
          entry.unitPrices.push(unitPrice!);
        }
        
        // Update lastPaidPrice to the price from the most recent purchase (TxnDate)
        const prevForPrice = entry.lastPurchaseDateForPrice;
        if (!prevForPrice || purchaseDate > prevForPrice) {
          entry.itemData.lastPaidPrice = itemData.lastPaidPrice;
          entry.lastPurchaseDateForPrice = purchaseDate;
        }
      }

      // Process each unique item
      for (const [key, entry] of itemPurchaseMap) {
        const { itemData, purchaseDates, quantities } = entry;
        
        // Resolve existing item per company + user + name (tenant-safe)
        const existingItems = await prisma.item.findMany({
          where: {
            userId,
            companyId,
          },
        });
        let item = existingItems.find(i => i.name.toLowerCase().trim() === itemData.name.toLowerCase().trim());

        // Calculate purchase stats
        const purchaseCount = purchaseDates.length;
        const totalQuantity = quantities.reduce((sum, qty) => sum + qty, 0);
        const firstPurchasedAt = purchaseDates.length > 0 
          ? new Date(Math.min(...purchaseDates.map(d => d.getTime())))
          : new Date();
        const lastPurchasedAt = purchaseDates.length > 0
          ? new Date(Math.max(...purchaseDates.map(d => d.getTime())))
          : new Date();

        // Calculate estimatedMonthlyUnits
        let estimatedMonthlyUnits = 0;
        if (firstPurchasedAt && lastPurchasedAt) {
          const daysBetween = Math.max(1, Math.ceil(
            (lastPurchasedAt.getTime() - firstPurchasedAt.getTime()) / (1000 * 60 * 60 * 24)
          ));
          estimatedMonthlyUnits = (totalQuantity / daysBetween) * 30;
        } else if (purchaseCount >= 2) {
          estimatedMonthlyUnits = purchaseCount; // Rough fallback
        } else if (purchaseCount === 1) {
          estimatedMonthlyUnits = 1;
        }

        if (item) {
          // Update existing item with purchase stats
          const existingPurchaseCount = item.purchaseCount || 0;
          const existingFirstPurchasedAt = item.firstPurchasedAt;
          const existingLastPurchasedAt = item.lastPurchasedAt;
          
          // Update purchase count
          const newPurchaseCount = existingPurchaseCount + purchaseCount;
          
          // Update first purchased date (earliest)
          const newFirstPurchasedAt = existingFirstPurchasedAt
            ? new Date(Math.min(existingFirstPurchasedAt.getTime(), firstPurchasedAt.getTime()))
            : firstPurchasedAt;
          
          // Update last purchased date (most recent)
          const newLastPurchasedAt = existingLastPurchasedAt
            ? new Date(Math.max(existingLastPurchasedAt.getTime(), lastPurchasedAt.getTime()))
            : lastPurchasedAt;
          
          // Recalculate estimatedMonthlyUnits with all purchases
          let newEstimatedMonthlyUnits = estimatedMonthlyUnits;
          if (newFirstPurchasedAt && newLastPurchasedAt) {
            const totalDays = Math.max(1, Math.ceil(
              (newLastPurchasedAt.getTime() - newFirstPurchasedAt.getTime()) / (1000 * 60 * 60 * 24)
            ));
            // Estimate total quantity across all purchases
            const estimatedTotalQuantity = newPurchaseCount; // Simplified: assume 1 unit per purchase
            newEstimatedMonthlyUnits = (estimatedTotalQuantity / totalDays) * 30;
          }

          // Prepare update data
          const updateData: any = {
            // Per-unit most recent paid (from QB); aligns with retail unit prices / Amazon matcher
            lastPaidPrice: itemData.lastPaidPrice,
            purchaseCount: newPurchaseCount,
            firstPurchasedAt: newFirstPurchasedAt,
            lastPurchasedAt: newLastPurchasedAt,
            estimatedMonthlyUnits: newEstimatedMonthlyUnits,
            ...(itemData.vendorName && { vendorName: itemData.vendorName }),
            ...(itemData.category && { category: itemData.category }),
          };

          // Legacy baselinePrice (backward compatibility): init if missing
          if (!item.baselinePrice || item.baselinePrice <= 0) {
            updateData.baselinePrice = itemData.lastPaidPrice;
          }
          // Sticky baselineUnitPrice: set only if not already set, from QB history (P90 or max)
          if (item.baselineUnitPrice == null && entry.unitPrices.length > 0) {
            const { baseline, source } = computeBaseline(entry.unitPrices);
            if (baseline > 0) {
              updateData.baselineUnitPrice = baseline;
              updateData.baselineSetAt = new Date();
              updateData.baselineSource = source;
              console.log(`   📌 Baseline set for ${item.name}: $${baseline.toFixed(2)} (${source})`);
            }
          }

          // Update item with latest price and purchase stats
          item = await prisma.item.update({
            where: { id: item.id },
            data: updateData,
          });
          
          console.log(`   ✓ Updated item: ${item.name} (purchases: ${newPurchaseCount})`);
        } else {
          const createData: any = {
            ...itemData,
            companyId,
            baselinePrice: itemData.lastPaidPrice,
            purchaseCount,
            firstPurchasedAt,
            lastPurchasedAt,
            estimatedMonthlyUnits,
          };
          if (entry.unitPrices.length > 0) {
            const { baseline, source } = computeBaseline(entry.unitPrices);
            if (baseline > 0) {
              createData.baselineUnitPrice = baseline;
              createData.baselineSetAt = new Date();
              createData.baselineSource = source;
            }
          }
          item = await prisma.item.create({
            data: createData,
          });
          const bl = item.baselineUnitPrice != null ? ` baseline: $${item.baselineUnitPrice.toFixed(2)}` : '';
          console.log(`   ✓ Created item: ${item.name} (purchases: ${purchaseCount}${bl})`);
        }

        // Detect if name is vague
        const vagueName = isVagueName(item.name);

        if (skipRetailerMatchOnQbImport) {
          const matchUpdateData: Record<string, unknown> = {
            isVagueName: vagueName,
            needsClarification: needsClarification(item.name, null),
          };
          applyUnmatchedState(matchUpdateData, item.name);
          await prisma.item.update({
            where: { id: item.id },
            data: matchUpdateData as any,
          });
        } else {
          // Only match if item is not manually matched (respect user overrides)
          const shouldRematch =
            !item.isManuallyMatched &&
            (!item.matchedRetailer ||
              Math.abs((item.matchedPrice || 0) - item.lastPaidPrice) > item.lastPaidPrice * 0.1);

          if (shouldRematch) {
            console.log(`🔗 Matching: ${item.name}...`);
            const match = await matchItemToRetailers(item.name, item.lastPaidPrice, item.isManuallyMatched || false, {
              productBrand: item.productBrand,
              amazonSearchHint: item.amazonSearchHint,
              amazonAsin: item.amazonAsin,
            });

            // Determine if clarification is needed
            const clarificationNeeded = needsClarification(item.name, match?.confidence || null);

            // Prepare update data with new matching fields
            const matchUpdateData: any = {
              isVagueName: vagueName,
              needsClarification: clarificationNeeded,
            };

            if (match && hasConcreteMatchEvidence(match)) {
              // Store normalized name
              if (match.normalizedName) {
                matchUpdateData.normalizedName = match.normalizedName;
              }

              // Store match status and details
              matchUpdateData.matchStatus = match.status;
              matchUpdateData.matchConfidence = match.confidence;

              // Store match provider, url, title, price
              if (match.retailer) {
                matchUpdateData.matchProvider = match.retailer;
                matchUpdateData.matchedRetailer = match.retailer.charAt(0).toUpperCase() + match.retailer.slice(1);
              }
              if (match.url) {
                matchUpdateData.matchUrl = match.url;
                matchUpdateData.matchedUrl = match.url;
              }
              if (match.title) {
                matchUpdateData.matchTitle = match.title;
              }
              if (match.price) {
                matchUpdateData.matchPrice = match.price;
                matchUpdateData.matchedPrice = match.price;
              }

              // Store match reasons
              if (match.matchReasons || match.alternatives) {
                matchUpdateData.matchReasons = {
                  ...(match.matchReasons || {}),
                  alternatives: match.alternatives || [],
                };
              }

              matchUpdateData.lastMatchedAt = new Date();
            } else {
              // No match found
              applyUnmatchedState(matchUpdateData, item.name);
            }

            // Update item with match data and flags
            await prisma.item.update({
              where: { id: item.id },
              data: matchUpdateData,
            });

            if (vagueName) {
              console.log(`   ⚠️ Vague name detected - may need clarification`);
            }
            if (match && hasConcreteMatchEvidence(match) && match.confidence < 0.5) {
              console.log(`   ⚠️ Low confidence match (${(match.confidence * 100).toFixed(1)}%)`);
            }
            if (match && hasConcreteMatchEvidence(match) && match.status === 'needs_review') {
              console.log(`   ⚠️ Match needs review (status: ${match.status})`);
            }
          } else if (item.isManuallyMatched) {
            console.log(`   ✓ Skipping rematch - item is manually matched`);
          }
        }
      }
      
      const uniqueItemCount = itemPurchaseMap.size;
      console.log(`✅ Processed ${uniqueItemCount} unique items for user ${userId}`);
      
      // Recompute monitoring priorities after import
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { company: true },
      });
      
      if (user?.companyId) {
        const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
        console.log(`🔄 Recomputing monitoring priorities for company ${user.companyId}...`);
        await recomputeMonitoringForCompany(user.companyId, maxMonitoredItems);
        
        // Update company with imported count
        await prisma.company.update({
          where: { id: user.companyId },
          data: {
            lastImportedItemCount: uniqueItemCount,
            importLastAttemptedAt: new Date(),
            importCompletedAt: new Date(),
          },
        });
      }
      
      return uniqueItemCount;
    } else {
      console.log('⚠️ No purchase items found in QuickBooks');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { company: true },
      });
      if (user?.companyId) {
        await prisma.company.update({
          where: { id: user.companyId },
          data: {
            lastImportedItemCount: 0,
            importLastAttemptedAt: new Date(),
            importCompletedAt: new Date(),
          },
        });
      }
      return 0;
    }

  } catch (error) {
    console.error('Error fetching/storing QuickBooks items:', error);
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data);
    }
    throw error;
  }
}

/**
 * POST /api/qb/import
 * Manually trigger QuickBooks import. Uses stored tokens (decrypted).
 */
router.post('/import', async (req: Request, res: Response) => {
  let runId: number | null = null;
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const current = await resolveQuickBooksUser(req);
    const user = current?.user;
    if (!user || !user.companyId || !user.company || user.companyId !== companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const realmId = user.company.realmId || user.quickbooksRealmId;
    if (!realmId) {
      return res.status(400).json({ error: 'QuickBooks not connected' });
    }

    const { accessToken, refreshToken } = getDecryptedQBTokens(user);
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing or invalid QuickBooks token' });
    }

    runId = await startImportRun({
      companyId: user.companyId,
      userId: user.id,
      source: 'manual_import',
      realmId,
      metadata: { trigger: 'api' },
    });

    let tokenToUse = accessToken;
    let importedCount: number;
    try {
      importedCount = await fetchAndStoreItems(user.id, user.companyId, tokenToUse, realmId);
    } catch (error) {
      if (!isTokenExpiredError(error) || !refreshToken) {
        throw error;
      }
      const refreshed = await refreshQuickBooksToken(refreshToken, realmId);
      if (!refreshed) {
        throw new Error('QuickBooks token expired and refresh failed');
      }
      const encrypted = encryptTokens(refreshed.accessToken, refreshed.refreshToken);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          quickbooksAccessToken: encrypted.accessToken,
          quickbooksRefreshToken: encrypted.refreshToken,
          quickbooksConnectedAt: new Date(),
        },
      });
      tokenToUse = refreshed.accessToken;
      importedCount = await fetchAndStoreItems(user.id, user.companyId, tokenToUse, realmId);
    }

    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        lastImportedItemCount: importedCount,
        importLastAttemptedAt: new Date(),
        importCompletedAt: new Date(),
      },
    });

    await finishImportRun(runId, {
      status: importedCount > 0 ? 'success' : 'empty',
      importedItemCount: importedCount,
    });
    res.json({
      success: true,
      importedCount,
    });
  } catch (error) {
    console.error('Error during import:', error);
    if (runId) {
      await finishImportRun(runId, {
        status: 'error',
        importedItemCount: 0,
        errorCode: mapImportErrorCode(error),
        errorMessage: safeErrorMessage(error),
      });
    }
    res.status(500).json({
      error: 'Failed to import',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/qb/status
 * Get QuickBooks connection status for the current user's company
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const current = await resolveQuickBooksUser(req);
    const user = current?.user;

    if (!user || !user.companyId) {
      return res.status(404).json({ 
        error: 'User or company not found',
        isQuickBooksConnected: false,
        isConnectionBroken: false,
      });
    }

    const company = user.company;

    if (!company) {
      return res.status(404).json({ 
        error: 'Company not found',
        isQuickBooksConnected: false,
        isConnectionBroken: false,
      });
    }

    const isConnected = company.isQuickBooksConnected || !!company.realmId || !!user.quickbooksRealmId;
    
    // Check if connection is broken (token refresh failed recently)
    // A connection is considered broken if connectionBrokenAt is set and within last 7 days
    const isConnectionBroken = company.connectionBrokenAt 
      ? (new Date().getTime() - company.connectionBrokenAt.getTime()) < (7 * 24 * 60 * 60 * 1000)
      : false;

    res.json({
      success: true,
      isQuickBooksConnected: isConnected,
      isConnectionBroken: isConnectionBroken && isConnected, // Only broken if connected
      companyId: company.id,
      companyName: company.name,
      realmId: company.realmId || user.quickbooksRealmId || null,
      connectedAt: user.quickbooksConnectedAt || null,
      lastImportedItemCount: company.lastImportedItemCount || null,
    });
  } catch (error) {
    console.error('Error fetching QuickBooks status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch QuickBooks status',
      details: error instanceof Error ? error.message : 'Unknown error',
      isQuickBooksConnected: false,
      isConnectionBroken: false,
    });
  }
});

/**
 * POST /api/qb/reconnect
 * Generate a new OAuth connect URL for reconnecting QuickBooks
 */
router.post('/reconnect', (req: Request, res: Response) => {
  try {
    const { inviteToken } = req.query;
    const state = buildOAuthState(
      'reconnect',
      typeof inviteToken === 'string' && inviteToken.trim() ? inviteToken.trim() : undefined
    );
    
    // Generate authorization URI
    const authUri = getOAuthClient().authorizeUri({
      scope: [
        OAuthClient.scopes.Accounting,
        OAuthClient.scopes.OpenId,
        OAuthClient.scopes.Profile,
        OAuthClient.scopes.Email,
      ],
      state,
    });

    res.json({
      success: true,
      connectUrl: authUri,
    });
  } catch (error) {
    console.error('Error generating reconnect URL:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate reconnect URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/qb/disconnect
 * Disconnects QuickBooks integration for the current user's company
 * Revokes tokens, clears QuickBooks data, and stops monitoring
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const result = await disconnectQuickBooksForRequest(req);
    
    res.json({
      ...result,
      success: true,
      message: 'QuickBooks disconnected successfully.',
    });
  } catch (err: any) {
    console.error('Error disconnecting QuickBooks:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect QuickBooks.',
      error: err?.message || 'Unknown error',
    });
  }
});

export const __quickbooksTestUtils = {
  buildOAuthState,
  consumeOAuthState,
  isTokenExpiredError,
};

export default router;




