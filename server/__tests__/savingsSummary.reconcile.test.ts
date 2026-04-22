import type { Prisma } from '@prisma/client';
import { buildSavingsSummaryPayload } from '../src/services/savingsSummary';

/**
 * Minimal in-memory tx mock for buildSavingsSummaryPayload + createDealAlertIfEligible.
 */
function createMockTx(opts: {
  items: Array<{
    id: number;
    companyId: number;
    name: string;
    userId: number;
    baselineUnitPrice: number | null;
    baselinePrice: number | null;
    bestDealUnitPrice: number | null;
    bestDealRetailer: string | null;
    bestDealUrl: string | null;
    matchedPrice: number | null;
    matchProvider: string | null;
    matchUrl: string | null;
    reorderIntervalDays: number;
  }>;
  initialAlerts: Array<{
    id: number;
    itemId: number;
    userId: number;
    companyId: number;
    retailer: string;
    newPrice: number;
    oldPrice: number;
    savingsPerOrder: number;
    estimatedMonthlySavings: number;
    alertDate: Date;
    url?: string | null;
  }>;
}) {
  const items = opts.items.map((i) => ({ ...i }));
  let alerts = opts.initialAlerts.map((a) => ({
    ...a,
    item: items.find((it) => it.id === a.itemId)!,
  }));
  let nextAlertId =
    alerts.length > 0 ? Math.max(...alerts.map((a) => a.id)) + 1 : 1;

  const tx = {
    alert: {
      findMany: async (args: { where: { userId: number; companyId: number; alertDate: { gte: Date } }; include?: { item: boolean } }) => {
        const min = args.where.alertDate.gte;
        const rows = alerts.filter(
          (a) =>
            a.userId === args.where.userId &&
            a.companyId === args.where.companyId &&
            a.alertDate >= min
        );
        if (args.include?.item) {
          return rows.map((a) => ({
            ...a,
            item: items.find((it) => it.id === a.itemId) ?? { name: '?' },
          }));
        }
        return rows;
      },
      findFirst: async (args: {
        where: {
          itemId: number;
          companyId: number;
          retailer: string;
          alertDate: { gte: Date };
          newPrice: { gte: number; lte: number };
        };
      }) => {
        const w = args.where;
        return (
          alerts.find(
            (a) =>
              a.itemId === w.itemId &&
              a.companyId === w.companyId &&
              a.retailer === w.retailer &&
              a.alertDate >= w.alertDate.gte &&
              a.newPrice >= w.newPrice.gte &&
              a.newPrice <= w.newPrice.lte
          ) ?? null
        );
      },
      create: async ({
        data,
      }: {
        data: {
          userId: number;
          itemId: number;
          companyId: number;
          retailer: string;
          oldPrice: number;
          newPrice: number;
          priceDropAmount: number;
          savingsPerOrder: number;
          estimatedMonthlySavings: number;
          url: string;
          alertDate: Date;
        };
      }) => {
        const it = items.find((i) => i.id === data.itemId);
        const row = {
          id: nextAlertId++,
          ...data,
          item: it ?? { name: '?' },
        };
        alerts.push(row as (typeof alerts)[0]);
        return row;
      },
    },
    item: {
      findMany: async () => items,
      count: async () => items.length,
      findFirst: async ({
        where: { id, companyId: cid },
      }: {
        where: { id: number; companyId: number };
      }) => items.find((i) => i.id === id && i.companyId === cid) ?? null,
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, getAlerts: () => alerts };
}

describe('buildSavingsSummaryPayload reconcile', () => {
  const companyId = 1;
  const userId = 42;

  it('creates an Alert for an open deal with no alert in the last 30 days and returns empty supplemental fields', async () => {
    const { tx, getAlerts } = createMockTx({
      items: [
        {
          id: 7,
          companyId,
          name: 'Framing nails',
          userId,
          baselineUnitPrice: 100,
          baselinePrice: null,
          bestDealUnitPrice: 90,
          bestDealRetailer: 'Home Depot',
          bestDealUrl: 'https://example.com/p',
          matchedPrice: 90,
          matchProvider: 'homedepot',
          matchUrl: 'https://example.com/p',
          reorderIntervalDays: 30,
        },
      ],
      initialAlerts: [],
    });

    const payload = await buildSavingsSummaryPayload(tx, companyId, userId);

    expect(getAlerts().length).toBe(1);
    expect(payload.trackedDealsWithoutAlert).toEqual([]);
    expect(payload.trackedDealsSupplementMonthly).toBe(0);
    expect(payload.alertsThisMonth).toBe(1);
    expect(payload.fromAlertsMonthly).toBeGreaterThan(0);
    expect(payload.totalMonthlySavings).toBe(payload.fromAlertsMonthly);
  });

  it('does not duplicate when an alert already exists in the window', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 10);

    const { tx, getAlerts } = createMockTx({
      items: [
        {
          id: 7,
          companyId,
          name: 'Framing nails',
          userId,
          baselineUnitPrice: 100,
          baselinePrice: null,
          bestDealUnitPrice: 90,
          bestDealRetailer: 'Home Depot',
          bestDealUrl: 'https://example.com/p',
          matchedPrice: 90,
          matchProvider: 'homedepot',
          matchUrl: 'https://example.com/p',
          reorderIntervalDays: 30,
        },
      ],
      initialAlerts: [
        {
          id: 1,
          itemId: 7,
          userId,
          companyId,
          retailer: 'Home Depot',
          newPrice: 90,
          oldPrice: 100,
          savingsPerOrder: 10,
          estimatedMonthlySavings: 10,
          alertDate: thirtyDaysAgo,
          url: '',
        },
      ],
    });

    const before = getAlerts().length;
    const payload = await buildSavingsSummaryPayload(tx, companyId, userId);

    expect(getAlerts().length).toBe(before);
    expect(payload.alertsThisMonth).toBe(1);
    expect(payload.trackedDealsWithoutAlert).toEqual([]);
  });
});
