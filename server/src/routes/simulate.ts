/**
 * Simulate QuickBooks connected: return real data from DB for the test user.
 * Mounted before companyContext so it doesn't require tenant resolution.
 * Used when frontend has "Simulate QuickBooks connected" active so the dashboard can show Supabase data.
 */
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { withCompany } from '../db/tenantDb';
import { computeDealState } from '../services/dealState';
import { buildSavingsSummaryPayload } from '../services/savingsSummary';
import appConfig from '../../../config/app.json';

const router = Router();
const TEST_USER_EMAIL = (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com';

/** Resolve test user and company for simulate mode (no companyContext). */
async function getTestUserContext() {
  const user = await prisma.user.findFirst({
    where: { email: TEST_USER_EMAIL },
    include: { company: true },
  });
  if (!user) return null;
  return { user, companyId: user.companyId };
}

/**
 * GET /api/simulate/items
 * Same shape as GET /api/items
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const ctx = await getTestUserContext();
    if (!ctx || ctx.companyId == null) {
      return res.json({ success: true, count: 0, items: [] });
    }
    const rawItems = await withCompany(ctx.companyId, async (tx) => {
      return tx.item.findMany({
        where: { userId: ctx!.user.id, companyId: ctx.companyId! },
        include: {
          prices: { orderBy: { date: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
    const items = rawItems.map((item) => {
      const deal = computeDealState({
        baselineUnitPrice: item.baselineUnitPrice,
        bestDealUnitPrice: item.bestDealUnitPrice,
      });
      return {
        ...item,
        dealState: deal.dealState,
        bestPriceToday: deal.bestPriceToday,
        savingsAmount: deal.savingsAmount,
        savingsPct: deal.savingsPct,
      };
    });
    res.json({ success: true, count: items.length, items });
  } catch (error) {
    console.error('Error in simulate/items:', error);
    res.status(500).json({
      error: 'Failed to fetch items',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/simulate/alerts
 * Same shape as GET /api/alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const ctx = await getTestUserContext();
    if (!ctx || ctx.companyId == null) {
      return res.json({ success: true, count: 0, alerts: [] });
    }
    const alerts = await withCompany(ctx.companyId, async (tx) => {
      return tx.alert.findMany({
        where: { userId: ctx!.user.id, companyId: ctx.companyId! },
        include: { item: true },
        orderBy: { alertDate: 'desc' },
        take: 50,
      });
    });
    res.json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    console.error('Error in simulate/alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/simulate/alerts/unreadCount
 * Same shape as GET /api/alerts/unreadCount
 */
router.get('/alerts/unreadCount', async (req: Request, res: Response) => {
  try {
    const ctx = await getTestUserContext();
    if (!ctx || ctx.companyId == null) {
      return res.json({ success: true, unreadCount: 0 });
    }
    const unreadCount = await withCompany(ctx.companyId, async (tx) => {
      return tx.alert.count({
        where: { userId: ctx!.user.id, companyId: ctx.companyId!, seen: false },
      });
    });
    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error('Error in simulate/alerts/unreadCount:', error);
    res.status(500).json({
      error: 'Failed to fetch unread count',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/simulate/savings-summary
 * Same shape as GET /api/savings-summary
 */
router.get('/savings-summary', async (req: Request, res: Response) => {
  try {
    const metricsWindowDays = 30;
    const metricsWindow = 'last_30_days';
    const metricsWindowLabel = 'Last 30 days';
    const ctx = await getTestUserContext();
    if (!ctx || ctx.companyId == null) {
      return res.json({
        success: true,
        totalMonthlySavings: 0,
        fromAlertsMonthly: 0,
        trackedDealsSupplementMonthly: 0,
        trackedDealsWithoutAlert: [],
        totalItemsMonitored: 0,
        alertsThisMonth: 0,
        topSavingsItem: null,
        estimatedAnnualSavings: 0,
        metricsWindow,
        metricsWindowDays,
        metricsWindowLabel,
      });
    }
    const payload = await withCompany(ctx.companyId, async (tx) =>
      buildSavingsSummaryPayload(tx, ctx.companyId!, ctx.user.id)
    );

    res.json(payload);
  } catch (error) {
    console.error('Error in simulate/savings-summary:', error);
    res.status(500).json({
      error: 'Failed to fetch savings summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
