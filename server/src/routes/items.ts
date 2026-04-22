import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { withCompany } from '../db/tenantDb';
import {
  matchCatalogForItem,
  formatMatchedRetailerDisplay,
  isVagueName,
  needsClarification,
  amazonDiscoveryReady,
  homeDepotDiscoveryReady,
} from '../services/matchItem';
import { recomputeMonitoringForCompany } from '../services/monitoring';
import { syncCatalogMatchIntoDealPipeline } from '../services/catalogMatchDeal';
import {
  computeDealState,
  effectiveBaselineForSavings,
  effectiveBestRetailUnitPrice,
} from '../services/dealState';
import { ensureSubscribed } from '../middleware/subscription';
import { buildAggregateProviderKeyword } from '../services/amazonDiscoveryKeyword';
import { runPriceCheckForItem } from '../services/priceCheck';
import appConfig from '../../../config/app.json';

const router = Router();

/** Omit legacy Item.sku from JSON (column may remain in DB). */
function itemForApi<T extends { sku?: string | null }>(row: T): Omit<T, 'sku'> {
  const { sku: _omit, ...rest } = row;
  return rest;
}

type MatchHistoryEntry = {
  action: string;
  at: string;
  note?: string;
  status?: string;
  confidence?: number | null;
};

function asMatchReasons(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
}

function withMatchHistory(
  current: unknown,
  entry: MatchHistoryEntry
): Record<string, any> {
  const reasons = asMatchReasons(current);
  const existing = Array.isArray(reasons.history) ? (reasons.history as unknown[]) : [];
  const nextHistory = [...existing, entry].slice(-8);
  return {
    ...reasons,
    history: nextHistory,
  };
}

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
  // Require a priced match so baseline / savings comparisons are meaningful
  return retailer.length > 0 && url.length > 0 && hasPrice;
}

function warnIfSuspiciousMatchState(itemId: number, target: Record<string, any>, source: string): void {
  const hasEvidence = Boolean(
    target.matchProvider ||
      target.matchedRetailer ||
      target.matchUrl ||
      target.matchedUrl ||
      target.matchTitle ||
      target.matchPrice != null ||
      target.matchedPrice != null
  );
  const hasConfidence = target.matchConfidence != null;

  if (target.matchStatus === 'unmatched' && !hasConfidence && hasEvidence) {
    console.warn(`[match-state] ${source}: item ${itemId} unmatched with stale evidence fields`);
  }
  if (hasConfidence && !hasEvidence) {
    console.warn(`[match-state] ${source}: item ${itemId} has confidence without concrete evidence`);
  }
}

/**
 * GET /api/items
 * Get all items for the test user (tenant-scoped via RLS)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const rawItems = await withCompany(companyId, async (tx) => {
      return tx.item.findMany({
        where: { userId: contextUser.id, companyId },
        include: {
          prices: { orderBy: { date: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    const items = rawItems.map((item) => {
      const deal = computeDealState({
        baselineUnitPrice: effectiveBaselineForSavings(item),
        bestDealUnitPrice: effectiveBestRetailUnitPrice(item),
      });
      return {
        ...itemForApi(item),
        dealState: deal.dealState,
        bestPriceToday: deal.bestPriceToday,
        savingsAmount: deal.savingsAmount,
        savingsPct: deal.savingsPct,
      };
    });

    res.json({
      success: true,
      count: items.length,
      items,
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
 * POST /api/items
 * Create a new item and match it to retailers (tenant-scoped)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      category,
      lastPaidPrice,
      quantityPerOrder,
      reorderIntervalDays,
      upc,
      vendorName,
      productBrand,
      amazonSearchHint,
    } = req.body;

    if (!name || lastPaidPrice === undefined) {
      return res.status(400).json({ error: 'Missing required fields: name and lastPaidPrice are required' });
    }

    if (!productBrand || !String(productBrand).trim()) {
      return res.status(400).json({ error: 'Missing required field: productBrand is required' });
    }

    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const parsedLastPaidPrice = parseFloat(lastPaidPrice);
    const item = await withCompany(companyId, async (tx) => {
      return tx.item.create({
        data: {
          userId: contextUser.id,
          companyId,
          name,
          category: category || null,
          baselinePrice: parsedLastPaidPrice,
          lastPaidPrice: parsedLastPaidPrice,
          quantityPerOrder: quantityPerOrder || 1,
          reorderIntervalDays: reorderIntervalDays || 30,
          upc: upc || null,
          vendorName: vendorName || null,
          productBrand: productBrand?.trim() || null,
          amazonSearchHint: amazonSearchHint?.trim() || null,
        },
      });
    });

    // Detect if name is vague
    const vagueName = isVagueName(item.name);
    
    // Catalog match (Amazon and/or Home Depot per retailer policy — same as Fix Match rematch)
    console.log(`🔗 Matching new item: ${item.name}...`);
    const { match } = await matchCatalogForItem({
      name: item.name,
      category: item.category,
      lastPaidPrice: item.lastPaidPrice,
      isManuallyMatched: false,
      companyId,
      itemId: item.id,
      productBrand: item.productBrand,
      amazonSearchHint: item.amazonSearchHint,
      amazonAsin: item.amazonAsin,
    });
    
    // Determine if clarification is needed
    const clarificationNeeded = needsClarification(item.name, match?.confidence || null);
    
    // Prepare update data with new matching fields
    const updateData: any = {
      isVagueName: vagueName,
      needsClarification: clarificationNeeded,
    };
    
    if (match && hasConcreteMatchEvidence(match)) {
      // Store normalized name
      if (match.normalizedName) {
        updateData.normalizedName = match.normalizedName;
      }
      
      // Store match status and details
      updateData.matchStatus = match.status;
      updateData.matchConfidence = match.confidence;
      
      // Store match provider, url, title, price (new fields)
      if (match.retailer) {
        updateData.matchProvider = match.retailer;
        updateData.matchedRetailer = formatMatchedRetailerDisplay(match.retailer);
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

      // Store match reasons (alternatives and scoring details) + provenance history.
      const autoReasons = {
        ...(match.matchReasons || {}),
        alternatives: match.alternatives || [],
        source: 'auto_match',
        sourceLabel: 'Automatic match',
      };
      updateData.matchReasons = withMatchHistory(autoReasons, {
        action: 'Auto matched',
        at: new Date().toISOString(),
        status: match.status,
        confidence: match.confidence ?? null,
      });

      updateData.lastMatchedAt = new Date();
    } else {
      // No match found
      applyUnmatchedState(updateData, item.name);
      updateData.matchReasons = withMatchHistory(updateData.matchReasons, {
        action: 'No match found',
        at: new Date().toISOString(),
        status: 'unmatched',
        confidence: null,
        note: 'Active providers returned no product results for this query',
      });
    }
    warnIfSuspiciousMatchState(item.id, updateData, 'create-item');
    
    const updatedItem = await withCompany(companyId, async (tx) =>
      tx.item.update({
        where: { id: item.id },
        data: updateData,
        include: { prices: true, alerts: true },
      })
    );

    const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
    await recomputeMonitoringForCompany(companyId, maxMonitoredItems).catch(err => {
      console.warn('Failed to recompute monitoring after item creation:', err);
    });

    if (match && hasConcreteMatchEvidence(match)) {
      await syncCatalogMatchIntoDealPipeline({
        companyId,
        itemId: updatedItem.id,
        userId: contextUser.id,
        retailer: match.retailer,
        unitPrice: match.price,
        url: match.url,
      }).catch((err) => console.warn('[catalogMatchDeal] after create:', err));
    }

    res.json({
      success: true,
      item: itemForApi(updatedItem),
      matched: match ? match.status === 'auto_matched' : false,
      match: match ? {
        retailer: match.retailer,
        price: match.price,
        url: match.url,
        confidence: match.confidence,
        status: match.status,
      } : null,
      warnings: {
        isVagueName: vagueName,
        needsClarification: clarificationNeeded,
        lowConfidence: match && hasConcreteMatchEvidence(match) ? match.confidence < 0.5 : false,
        needsReview: match && hasConcreteMatchEvidence(match) ? match.status === 'needs_review' : false,
      },
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ 
      error: 'Failed to create item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/items/:itemId/quotes
 * Return the most recent 20 quotes for that item scoped to company (debugging)
 */
router.get('/:itemId/quotes', async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId },
    });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const quotes = await prisma.retailerPriceQuote.findMany({
      where: { companyId, itemId },
      orderBy: { capturedAt: 'desc' },
      take: 20,
    });

    res.json({
      success: true,
      itemId,
      count: quotes.length,
      quotes: quotes.map(q => ({
        id: q.id,
        retailer: q.retailer,
        url: q.url,
        unitPrice: q.unitPrice,
        currency: q.currency,
        capturedAt: q.capturedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({
      error: 'Failed to fetch quotes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/items/:id/price-history
 * Get price history stats for an item (last 30 days)
 */
router.get('/:id/price-history', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);

    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    // Verify item exists
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Get price history stats
    const { getPriceHistoryStats } = await import('../services/priceHistory');
    const stats = await getPriceHistoryStats(itemId);

    res.json({
      success: true,
      itemId,
      bestPrice30Days: stats.bestPrice30Days,
      avgPrice30Days: stats.avgPrice30Days,
      history: stats.history.map(h => ({
        date: h.date.toISOString(),
        price: h.price,
        retailer: h.retailer,
      })),
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Check if it's a Prisma error about missing table
    if (errorMessage.includes('PriceHistory') || 
        errorMessage.includes('does not exist') || 
        errorMessage.includes('no such table') ||
        errorMessage.includes('Unknown arg') ||
        errorMessage.includes('model does not exist')) {
      return res.status(500).json({
        error: 'PriceHistory table does not exist',
        details: 'Please run the Prisma migration: cd server && npx prisma migrate dev --name add_price_history',
        message: errorMessage,
        migrationNeeded: true,
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch price history',
      details: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    });
  }
});

/**
 * GET /api/items/:id
 * Get single item with full details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        prices: {
          orderBy: { date: 'desc' },
        },
        alerts: {
          orderBy: { alertDate: 'desc' },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({
      success: true,
      item: itemForApi(item),
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ 
      error: 'Failed to fetch item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/items/:id
 * Update item details (inline editing)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);
    const { name, vendorName, category, lastPaidPrice, quantityPerOrder, reorderIntervalDays, productBrand, amazonSearchHint } =
      req.body;

    // Validate item exists
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};
    
    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      updateData.name = name.trim();
    }
    
    if (vendorName !== undefined) updateData.vendorName = vendorName?.trim() || null;
    if (productBrand !== undefined) updateData.productBrand = productBrand?.trim() || null;
    if (amazonSearchHint !== undefined) updateData.amazonSearchHint = amazonSearchHint?.trim() || null;
    if (category !== undefined) updateData.category = category?.trim() || null;

    // Require product brand in user-driven edits to improve matching quality.
    const resolvedBrand =
      productBrand !== undefined
        ? String(productBrand).trim()
        : (existingItem.productBrand || '').trim();
    if (!resolvedBrand) {
      return res.status(400).json({ error: 'Product brand is required' });
    }
    
    if (lastPaidPrice !== undefined) {
      const price = parseFloat(lastPaidPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'Invalid price value' });
      }
      updateData.lastPaidPrice = price;
      
      // Smart baselinePrice update: initialize if missing, or update if price increased >10%
      if (!existingItem.baselinePrice || existingItem.baselinePrice <= 0) {
        // Initialize baselinePrice if missing (backward compatibility)
        updateData.baselinePrice = price;
      } else {
        // Only update baselinePrice if price increased significantly (>10%)
        const priceIncrease = price / existingItem.baselinePrice;
        if (priceIncrease > 1.10) {
          updateData.baselinePrice = price;
        }
        // If price decreased or increased <10%, baselinePrice stays the same
      }
    }
    
    if (quantityPerOrder !== undefined) {
      const qty = parseInt(quantityPerOrder);
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({ error: 'Quantity must be at least 1' });
      }
      updateData.quantityPerOrder = qty;
    }
    
    if (reorderIntervalDays !== undefined) {
      const days = parseInt(reorderIntervalDays);
      if (isNaN(days) || days < 1) {
        return res.status(400).json({ error: 'Reorder interval must be at least 1 day' });
      }
      updateData.reorderIntervalDays = days;
    }

    // Update the item
    let updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: updateData,
      include: {
        prices: {
          orderBy: { date: 'desc' },
          take: 5
        }
      }
    });

    console.log(`✅ Item updated: ${updatedItem.name} (ID: ${itemId})`);

    // AUTO RE-MATCHING: If name was updated, re-match to retailers (unless manually matched)
    if (updateData.name) {
      // Recompute normalizedName
      const itemMeta = await import('../services/matching/normalize').then(m => m.normalizeItemName(updatedItem.name));
      
      const matchUpdateData: any = {
        normalizedName: itemMeta.normalized,
      };

      // If item is manually matched, don't auto-rematch
      if (existingItem.isManuallyMatched) {
        console.log(`🔄 Name changed but item is manually matched - preserving manual match`);
        // Set flag in matchReasons that name changed while manual
        const currentReasons = (existingItem.matchReasons as any) || {};
        matchUpdateData.matchReasons = withMatchHistory({
          ...currentReasons,
          nameChangedWhileManual: true,
        }, {
          action: 'Name updated',
          at: new Date().toISOString(),
          note: 'Manual match preserved',
          status: existingItem.matchStatus,
          confidence: existingItem.matchConfidence ?? null,
        });
        // Keep status as verified/overridden (don't change)
        
        updatedItem = await prisma.item.update({
          where: { id: itemId },
          data: matchUpdateData,
          include: {
            prices: {
              orderBy: { date: 'desc' },
              take: 5
            }
          }
        });
      } else {
        // Perform rematch
        console.log(`🔄 Name changed, re-matching item: "${updatedItem.name}"...`);
        
        // Detect if new name is vague
        const vagueName = isVagueName(updatedItem.name);
        
        // Re-match with new name (same catalog policy as create / Fix Match)
        const { match } = await matchCatalogForItem({
          name: updatedItem.name,
          category: updatedItem.category,
          lastPaidPrice: updatedItem.lastPaidPrice,
          isManuallyMatched: false,
          companyId: existingItem.companyId,
          itemId: updatedItem.id,
          productBrand: updatedItem.productBrand,
          amazonSearchHint: updatedItem.amazonSearchHint,
          amazonAsin: updatedItem.amazonAsin,
        });
        
        // Determine if clarification is needed
        const clarificationNeeded = needsClarification(updatedItem.name, match?.confidence || null);
        
        // Update match fields
        matchUpdateData.isVagueName = vagueName;
        matchUpdateData.needsClarification = clarificationNeeded;
        
        if (match && hasConcreteMatchEvidence(match)) {
          // Store match status and details
          matchUpdateData.matchStatus = match.status;
          matchUpdateData.matchConfidence = match.confidence;
          
          // Store match provider, url, title, price
          if (match.retailer) {
            matchUpdateData.matchProvider = match.retailer;
            matchUpdateData.matchedRetailer = formatMatchedRetailerDisplay(match.retailer);
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

          const autoReasons = {
            ...(match.matchReasons || {}),
            alternatives: match.alternatives || [],
            source: 'auto_match',
            sourceLabel: 'Automatic rematch',
          };
          matchUpdateData.matchReasons = withMatchHistory(autoReasons, {
            action: 'Rematched',
            at: new Date().toISOString(),
            status: match.status,
            confidence: match.confidence ?? null,
          });

          matchUpdateData.lastMatchedAt = new Date();
        } else {
          // No match found
          applyUnmatchedState(matchUpdateData, updatedItem.name);
          matchUpdateData.matchReasons = withMatchHistory(existingItem.matchReasons, {
            action: 'Rematched',
            at: new Date().toISOString(),
            note: 'Active providers returned no product results for this query',
            status: 'unmatched',
            confidence: null,
          });
        }
        warnIfSuspiciousMatchState(itemId, matchUpdateData, 'update-item-name-rematch');
        
        // Update item with new match data and flags
        updatedItem = await prisma.item.update({
          where: { id: itemId },
          data: matchUpdateData,
          include: {
            prices: {
              orderBy: { date: 'desc' },
              take: 5
            }
          }
        });

        if (match && hasConcreteMatchEvidence(match)) {
          await syncCatalogMatchIntoDealPipeline({
            companyId: existingItem.companyId,
            itemId: updatedItem.id,
            userId: existingItem.userId,
            retailer: match.retailer,
            unitPrice: match.price,
            url: match.url,
          }).catch((err) => console.warn('[catalogMatchDeal] after name rematch:', err));
        }

        console.log(`✅ Re-matched: ${match ? `${match.retailer} - $${match.price.toFixed(2)} (confidence: ${(match.confidence * 100).toFixed(1)}%, status: ${match.status})` : 'No match found'}`);
        
        // If clarification status changed, recompute monitoring (item may now be eligible or ineligible)
        const wasNeedingClarification = existingItem.needsClarification;
        if (wasNeedingClarification !== clarificationNeeded) {
          console.log(`🔄 Clarification status changed (was: ${wasNeedingClarification}, now: ${clarificationNeeded}) - recomputing monitoring`);
          const user = await prisma.user.findUnique({
            where: { id: existingItem.userId },
            include: { company: true },
          });
          if (user?.companyId) {
            const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
            await recomputeMonitoringForCompany(user.companyId, maxMonitoredItems).catch(err => {
              console.warn('Failed to recompute monitoring after item clarification change:', err);
            });
          }
        }
      }
    } else if (updateData.lastPaidPrice !== undefined) {
      // If only price changed, re-check vague name and clarification status
      const vagueName = isVagueName(updatedItem.name);
      const clarificationNeeded = needsClarification(updatedItem.name, updatedItem.matchConfidence);
      
      updatedItem = await prisma.item.update({
        where: { id: itemId },
        data: {
          isVagueName: vagueName,
          needsClarification: clarificationNeeded,
        },
        include: {
          prices: {
            orderBy: { date: 'desc' },
            take: 5
          }
        }
      });
      
      // If clarification status changed, recompute monitoring
      const wasNeedingClarification = existingItem.needsClarification;
      if (wasNeedingClarification !== clarificationNeeded) {
        console.log(`🔄 Clarification status changed (was: ${wasNeedingClarification}, now: ${clarificationNeeded}) - recomputing monitoring`);
        const user = await prisma.user.findUnique({
          where: { id: existingItem.userId },
          include: { company: true },
        });
        if (user?.companyId) {
          const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
          await recomputeMonitoringForCompany(user.companyId, maxMonitoredItems).catch(err => {
            console.warn('Failed to recompute monitoring after clarification status change:', err);
          });
        }
      }
    }

    res.json({
      success: true,
      item: itemForApi(updatedItem),
      message: 'Item updated successfully',
      ...(updateData.name && {
        reMatched: true,
        warnings: {
          isVagueName: updatedItem.isVagueName,
          needsClarification: updatedItem.needsClarification,
          lowConfidence: updatedItem.matchConfidence !== null && updatedItem.matchConfidence < 0.5,
        },
      }),
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ 
      error: 'Failed to update item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/items/:id/match/override
 * Apply manual override for item match
 */
router.post('/:id/match/override', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);
    const { provider, url, title, price, upc, notes, updateItemName } = req.body;

    if (!provider || !url) {
      return res.status(400).json({ error: 'provider and url are required' });
    }

    // Get item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Prepare match reasons with product details
    const matchReasons: any = {
      manual: true,
      notes: notes || null,
      source: 'manual_override',
      sourceLabel: 'Manual override',
    };
    
    if (price) matchReasons.price = price;
    if (upc) matchReasons.upc = upc;

    // Helper to capitalize retailer name for display
    const capitalizeRetailer = (retailer: string): string => {
      const retailerMap: { [key: string]: string } = {
        'officedepot': 'Office Depot',
        'homedepot': 'Home Depot',
        'amazon': 'Amazon',
        'target': 'Target',
        'uline': 'Uline',
        'microsoft': 'Microsoft Store',
        'staples': 'Staples',
      };
      return retailerMap[retailer.toLowerCase()] || retailer.charAt(0).toUpperCase() + retailer.slice(1);
    };

    // Set manual match fields
    const updateData: any = {
      isManuallyMatched: true,
      matchStatus: 'overridden',
      manualMatchProvider: provider,
      manualMatchUrl: url,
      manualMatchTitle: title || null,
      manualMatchNotes: notes || null,
      // Copy into match fields for consistency (UI reads one source)
      matchProvider: provider,
      matchUrl: url,
      matchTitle: title || null,
      matchConfidence: 1.0,
      matchReasons: withMatchHistory(matchReasons, {
        action: 'Manual override',
        at: new Date().toISOString(),
        status: 'overridden',
        confidence: 1.0,
      }),
      lastMatchedAt: new Date(),
      // Also update legacy fields for backward compatibility (UI card display)
      matchedRetailer: capitalizeRetailer(provider),
      matchedUrl: url,
    };

    // Update item name if requested
    const nameToEvaluate = updateItemName && typeof updateItemName === 'string' && updateItemName.trim() 
      ? updateItemName.trim() 
      : item.name;
    
    if (updateItemName && typeof updateItemName === 'string' && updateItemName.trim()) {
      updateData.name = updateItemName.trim();
      console.log(`   📝 Updating item name to: ${updateItemName.trim()}`);
    }

    // Re-evaluate vague name and clarification status
    // Use the matched product title if available (it's more specific than the item name)
    const nameForEvaluation = title && title.trim() ? title.trim() : nameToEvaluate;
    const vagueName = isVagueName(nameForEvaluation);
    // Since this is a manual override with confidence 1.0, we consider it verified and no longer needs clarification
    const clarificationNeeded = false; // Manual override means user has verified the match
    
    updateData.isVagueName = vagueName;
    updateData.needsClarification = clarificationNeeded;
    
    console.log(`   🔍 Re-evaluated: isVagueName=${vagueName}, needsClarification=${clarificationNeeded} (based on: "${nameForEvaluation}")`);

    // Update matched price if provided
    if (price !== undefined && price !== null) {
      const parsedPrice = parseFloat(price);
      updateData.matchedPrice = parsedPrice;
      updateData.matchPrice = parsedPrice;
    }

    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: updateData,
    });

    // If clarification status changed, recompute monitoring
    const wasNeedingClarification = item.needsClarification;
    if (wasNeedingClarification !== clarificationNeeded) {
      console.log(`🔄 Clarification status changed (was: ${wasNeedingClarification}, now: ${clarificationNeeded}) - recomputing monitoring`);
      const user = await prisma.user.findUnique({
        where: { id: item.userId },
        include: { company: true },
      });
      if (user?.companyId) {
        const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
        await recomputeMonitoringForCompany(user.companyId, maxMonitoredItems).catch(err => {
          console.warn('Failed to recompute monitoring after clarification status change:', err);
        });
      }
    }

    console.log(`✅ Item ${itemId} match overridden manually: ${provider}${price ? ` ($${price})` : ''}`);

    res.json({
      success: true,
      item: itemForApi(updatedItem),
    });
  } catch (error) {
    console.error('Error overriding match:', error);
    res.status(500).json({
      error: 'Failed to override match',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/items/:id/match/verify
 * Verify current match (marks as verified and prevents auto-overwrites)
 */
router.post('/:id/match/verify', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);

    // Get item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check if item has a match to verify
    if (!item.matchProvider || !item.matchUrl) {
      return res.status(400).json({ 
        error: 'Item does not have a match to verify',
        message: 'Item must have a match before it can be verified'
      });
    }

    // Verify the match
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: {
        matchStatus: 'verified',
        isManuallyMatched: true, // Prevent auto-overwrites
        // Copy current match fields into manual fields
        manualMatchProvider: item.matchProvider,
        manualMatchUrl: item.matchUrl,
        manualMatchTitle: item.matchTitle || null,
        // Update confidence to at least 0.9
        matchConfidence: Math.max(item.matchConfidence || 0, 0.9),
        matchReasons: withMatchHistory(item.matchReasons, {
          action: 'Verified',
          at: new Date().toISOString(),
          status: 'verified',
          confidence: Math.max(item.matchConfidence || 0, 0.9),
        }),
        lastMatchedAt: new Date(),
      },
    });

    console.log(`✅ Item ${itemId} match verified`);

    if (
      hasConcreteMatchEvidence({
        retailer: item.matchProvider,
        url: item.matchUrl,
        price: item.matchedPrice,
      })
    ) {
      await syncCatalogMatchIntoDealPipeline({
        companyId: item.companyId,
        itemId: item.id,
        userId: item.userId,
        retailer: item.matchProvider!,
        unitPrice: item.matchedPrice!,
        url: item.matchUrl!,
      }).catch((err) => console.warn('[catalogMatchDeal] after verify:', err));
    }

    res.json({
      success: true,
      item: itemForApi(updatedItem),
    });
  } catch (error) {
    console.error('Error verifying match:', error);
    res.status(500).json({
      error: 'Failed to verify match',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/items/:id
 * Delete an item
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);

    // Validate item exists
    const existingItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete the item (cascade will delete related prices and alerts)
    await prisma.item.delete({
      where: { id: itemId }
    });

    console.log(`🗑️ Item deleted: ${existingItem.name} (ID: ${itemId})`);
    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ 
      error: 'Failed to delete item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/items/:id/rematch
 * Re-run matching for an item
 * If item is manually matched, returns current state with suggested candidates but doesn't change persisted match
 */
router.post('/:id/rematch', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isFinite(itemId)) {
      return res.status(400).json({ error: 'Invalid item id' });
    }

    const companyId = req.companyId;
    const contextUser = req.companyContextUser;
    if (companyId == null || !contextUser) {
      return res.status(400).json({
        error: 'Company context required',
        message: 'Sign in or use test mode user headers so the server knows which company this item belongs to.',
      });
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const amazonCfg = amazonDiscoveryReady();
    const hdCfg = homeDepotDiscoveryReady();

    // If manually matched, return current state with suggested candidates but don't change persisted match
    if (item.isManuallyMatched) {
      const { match, diagnostics } = await matchCatalogForItem({
        name: item.name,
        category: item.category,
        lastPaidPrice: item.lastPaidPrice,
        isManuallyMatched: true,
        companyId,
        itemId,
        productBrand: item.productBrand,
        amazonSearchHint: item.amazonSearchHint,
        amazonAsin: item.amazonAsin,
      });

      console.log(`[rematch] item ${itemId} company ${companyId} manual lock`, diagnostics);

      // Still feed deal pipeline + alerts from fresh catalog prices (does not overwrite verified match fields).
      if (match && hasConcreteMatchEvidence(match)) {
        await syncCatalogMatchIntoDealPipeline({
          companyId,
          itemId,
          userId: item.userId,
          retailer: match.retailer,
          unitPrice: match.price,
          url: match.url,
        }).catch((err) => console.warn('[catalogMatchDeal] manual rematch:', err));
      }

      return res.json({
        success: true,
        item: itemForApi(item),
        message:
          match != null
            ? 'Item is manually matched. Suggestions below (not persisted).'
            : 'No catalog suggestion for this query (check retailer policy and Bright Data env).',
        suggestedMatch: match,
        isManuallyMatched: true,
        rematchDiagnostics: {
          retailerPolicy: {
            amazon: diagnostics.visibility.amazon,
            homeDepot: diagnostics.visibility.homeDepot,
            reason: diagnostics.visibility.reason,
          },
          amazon: {
            configured: amazonCfg.ok,
            ran: diagnostics.amazonAttempted,
            skippedReason: !diagnostics.visibility.amazon
              ? 'excluded_by_policy'
              : !amazonCfg.ok
                ? amazonCfg.reason
                : undefined,
          },
          homeDepot: {
            configured: hdCfg.ok,
            ran: diagnostics.homeDepotAttempted,
            skippedReason: !diagnostics.visibility.homeDepot
              ? 'excluded_by_policy'
              : !hdCfg.ok
                ? hdCfg.reason
                : undefined,
          },
        },
      });
    }

    const { match, diagnostics } = await matchCatalogForItem({
      name: item.name,
      category: item.category,
      lastPaidPrice: item.lastPaidPrice,
      isManuallyMatched: false,
      companyId,
      itemId,
      productBrand: item.productBrand,
      amazonSearchHint: item.amazonSearchHint,
      amazonAsin: item.amazonAsin,
    });

    console.log(`[rematch] item ${itemId} company ${companyId}`, diagnostics);

    // Detect if name is vague
    const vagueName = isVagueName(item.name);
    const clarificationNeeded = needsClarification(item.name, match?.confidence || null);

    // Prepare update data
    const updateData: any = {
      isVagueName: vagueName,
      needsClarification: clarificationNeeded,
    };

    if (match && hasConcreteMatchEvidence(match)) {
      // Store normalized name
      if (match.normalizedName) {
        updateData.normalizedName = match.normalizedName;
      }
      
      // Store match status and details
      updateData.matchStatus = match.status;
      updateData.matchConfidence = match.confidence;
      
      // Store match provider, url, title, price
      if (match.retailer) {
        updateData.matchProvider = match.retailer;
        updateData.matchedRetailer = formatMatchedRetailerDisplay(match.retailer);
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
      
      // Store match reasons
      if (match.matchReasons || match.alternatives) {
        updateData.matchReasons = withMatchHistory({
          ...(match.matchReasons || {}),
          alternatives: match.alternatives || [],
          source: 'auto_match',
          sourceLabel: 'Automatic rematch',
        }, {
          action: 'Rematched',
          at: new Date().toISOString(),
          status: match.status,
          confidence: match.confidence ?? null,
        });
      }
      
      updateData.lastMatchedAt = new Date();
    } else {
      // No match found
      applyUnmatchedState(updateData, item.name);
      updateData.matchReasons = withMatchHistory(item.matchReasons, {
        action: 'Rematched',
        at: new Date().toISOString(),
        note: 'Active providers returned no product results for this query',
        status: 'unmatched',
        confidence: null,
      });
    }
    warnIfSuspiciousMatchState(itemId, updateData, 'manual-rematch');

    // Update item with new match results
    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: updateData,
    });

    console.log(`✅ Item ${itemId} re-matched (status: ${updateData.matchStatus || 'unmatched'})`);

    if (match && hasConcreteMatchEvidence(match)) {
      await syncCatalogMatchIntoDealPipeline({
        companyId,
        itemId,
        userId: item.userId,
        retailer: match.retailer,
        unitPrice: match.price,
        url: match.url,
      }).catch((err) => console.warn('[catalogMatchDeal] after rematch:', err));
    }

    res.json({
      success: true,
      item: itemForApi(updatedItem),
      match,
      rematchDiagnostics: {
        retailerPolicy: {
          amazon: diagnostics.visibility.amazon,
          homeDepot: diagnostics.visibility.homeDepot,
          reason: diagnostics.visibility.reason,
        },
        amazon: {
          configured: amazonCfg.ok,
          ran: diagnostics.amazonAttempted,
          skippedReason: !diagnostics.visibility.amazon
            ? 'excluded_by_policy'
            : !amazonCfg.ok
              ? amazonCfg.reason
              : undefined,
        },
        homeDepot: {
          configured: hdCfg.ok,
          ran: diagnostics.homeDepotAttempted,
          skippedReason: !diagnostics.visibility.homeDepot
            ? 'excluded_by_policy'
            : !hdCfg.ok
              ? hdCfg.reason
              : undefined,
        },
      },
    });
  } catch (error) {
    console.error('Error re-matching item:', error);
    res.status(500).json({
      error: 'Failed to re-match item',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/items/check-price/:id
 * Check current prices across all retailers for an item
 * Requires active subscription
 */
router.get('/check-price/:id', ensureSubscribed, async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (!Number.isFinite(itemId)) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const companyId = req.companyId;
    if (companyId == null) {
      return res.status(400).json({ error: 'Company context required' });
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check if item needs clarification - cannot check prices for vague items
    if (item.needsClarification) {
      return res.status(400).json({ 
        error: 'Cannot check prices',
        reason: 'Item name is too vague and needs clarification',
        message: `The item "${item.name}" cannot have prices checked because the name is too generic (e.g., "paper" has too many possibilities). Please edit the item name to add more specific details (brand, size, model, specifications) before checking prices.`
      });
    }

    console.log(`\n🔍 Checking prices for: ${item.name} (ID: ${itemId})`);

    const keyword = buildAggregateProviderKeyword({
      name: item.name,
      productBrand: item.productBrand,
      amazonSearchHint: item.amazonSearchHint,
    });

    const priceRun = await runPriceCheckForItem(companyId, item.id, { bypassTodayGuard: true });

    const validQuotes = priceRun.quotes.filter((q) => q.unitPrice > 0 && q.unitPrice < 100000);
    const bestPriceToday =
      validQuotes.length > 0 ? Math.min(...validQuotes.map((q) => q.unitPrice)) : null;
    const bestQuote =
      validQuotes.length > 0
        ? validQuotes.find((q) => q.unitPrice === bestPriceToday) ?? validQuotes[0]
        : null;

    const validResults = validQuotes.map((q) => ({
      retailer: q.retailer,
      price: q.unitPrice,
      url: q.url ?? null,
      stock: false as boolean | undefined,
      title: item.name,
      image: null as string | null,
    }));
    const bestResult = bestQuote
      ? {
          retailer: bestQuote.retailer,
          price: bestQuote.unitPrice,
          url: bestQuote.url ?? null,
          stock: false,
          title: item.name,
          image: null,
        }
      : null;

    // Savings use baselineUnitPrice only (sticky baseline); never lastPaidPrice for savings
    const baselineUnitPrice =
      item.baselineUnitPrice != null && item.baselineUnitPrice > 0
        ? item.baselineUnitPrice
        : null;

    type DealStatus = 'deal' | 'no_deal' | 'no_price' | 'no_baseline';
    let dealStatus: DealStatus;
    let savingsAmount: number | null = null;
    let savingsPercent: number | null = null;

    if (baselineUnitPrice == null) {
      dealStatus = 'no_baseline';
    } else if (bestPriceToday == null) {
      dealStatus = 'no_price';
    } else if (bestPriceToday < baselineUnitPrice) {
      dealStatus = 'deal';
      savingsAmount = baselineUnitPrice - bestPriceToday;
      savingsPercent = (savingsAmount / baselineUnitPrice) * 100;
    } else {
      dealStatus = 'no_deal';
    }

    // Per-result list: only include savings when there is a real deal vs baseline
    const resultsWithSavings = validResults.map((result) => {
      const price = result.price;
      const baseline = baselineUnitPrice;
      const hasDeal = baseline != null && price < baseline;
      const savings = hasDeal ? baseline - price : null;
      const savingsPercentVal = hasDeal && baseline > 0 ? (savings! / baseline) * 100 : null;
      return {
        retailer: result.retailer,
        price,
        url: result.url,
        stock: result.stock,
        title: result.title,
        image: result.image,
        savings: savings,
        savingsPercent: savingsPercentVal,
      };
    });

    console.log(`\n✅ Price check complete: ${validQuotes.length} retailers found, dealStatus=${dealStatus}\n`);

    const newLowSinceLastCheck =
      bestPriceToday != null &&
      item.bestDealUnitPrice != null &&
      item.bestDealUnitPrice > 0 &&
      bestPriceToday < item.bestDealUnitPrice;

    const priceCheckHint =
      validQuotes.length === 0
        ? {
            kind: 'no_retailer_prices' as const,
            message:
              'No retailer prices were returned this run. Edit the item to add product brand, pack size, or an Amazon search hint, then try again. Use Fix Match if the linked product is wrong.',
          }
        : undefined;

    res.json({
      success: true,
      item: {
        id: item.id,
        name: item.name,
        lastPaidPrice: item.lastPaidPrice,
        baselineUnitPrice: item.baselineUnitPrice ?? undefined,
        baselineSetAt: item.baselineSetAt ?? undefined,
        baselineSource: item.baselineSource ?? undefined,
      },
      results: resultsWithSavings,
      count: validQuotes.length,
      bestPrice: bestResult,
      // Normalized payload for baseline-based savings
      bestPriceToday: bestPriceToday,
      baselineUnitPrice: baselineUnitPrice,
      savingsAmount,
      savingsPercent,
      dealStatus,
      newLowSinceLastCheck,
      priceCheckHint,
      searchKeywordUsed: keyword,
      baselineHelp:
        'A deal means today’s best price is below your baseline (usually from QuickBooks purchase history), not below your last search.',
    });
  } catch (error) {
    console.error('Error checking prices:', error);
    res.status(500).json({
      error: 'Failed to check prices',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/items/:id/pause
 * Pause monitoring for an item
 */
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);

    // Get item to find company
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        user: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Pause monitoring and remove from monitored set immediately
    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        isPaused: true,
        isMonitored: false, // remove from monitoring immediately
      },
    });

    console.log(`⏸️ Item "${updated.name}" (ID: ${itemId}) paused from monitoring`);

    res.json({ success: true, item: itemForApi(updated) });
  } catch (error) {
    console.error('Error pausing item:', error);
    res.status(500).json({
      error: 'Failed to pause monitoring',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/items/:id/resume
 * Resume monitoring for an item
 */
router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);

    // Get item to find company
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        user: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Check if item needs clarification - cannot resume monitoring for vague items
    if (item.needsClarification) {
      return res.status(400).json({ 
        error: 'Cannot resume monitoring',
        reason: 'Item name is too vague and needs clarification',
        message: `The item "${item.name}" cannot be monitored because the name is too generic (e.g., "paper" has too many possibilities). Please edit the item name to add more specific details (brand, size, model, specifications) before enabling monitoring.`
      });
    }

    // Resume monitoring
    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        isPaused: false,
      },
    });

    console.log(`▶️ Item "${updated.name}" (ID: ${itemId}) resumed - will recompute monitoring`);

    // Recompute company monitoring so it can re-enter top-N if needed
    if (item.user.companyId) {
      const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
      await recomputeMonitoringForCompany(item.user.companyId, maxMonitoredItems).catch(err => {
        console.warn('Failed to recompute monitoring after resume:', err);
        // Don't fail the request if monitoring recomputation fails
      });
    }

    res.json({ success: true, item: itemForApi(updated) });
  } catch (error) {
    console.error('Error resuming item:', error);
    res.status(500).json({
      error: 'Failed to resume monitoring',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
