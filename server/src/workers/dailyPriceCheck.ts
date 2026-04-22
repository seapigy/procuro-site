import cron from 'node-cron';
import prisma from '../lib/prisma';
import appConfig from '../../../config/app.json';
import {
  recomputeMonitoringForAllCompanies,
  getTopItemsForDiscovery,
} from '../services/monitoring';
import { runPriceCheckForItem } from '../services/priceCheck';
import { computeDealState } from '../services/dealState';

/**
 * Daily price check worker
 * Runs every night at configured time (default 3 AM)
 *
 * 1. Recomputes Top 20 per company (by QuickBooks purchase quantity/spend)
 * 2. Runs retailer discovery for Top 20 only (Bright Data cost control)
 * 3. Creates alerts for deals
 */

let isRunning = false;
let lastSuccessfulRunAt: string | null = null;

type RunTrigger = 'scheduled' | 'manual';
type RunStatus = 'success' | 'failed' | 'skipped';

interface RunMetrics {
  companiesEligible: number;
  companiesProcessed: number;
  totalDiscovery: number;
  alertsCreated: number;
  errors: number;
  retriedItems: number;
  retriedAttempts: number;
}

export interface DailyPriceCheckRunSummary {
  status: RunStatus;
  trigger: RunTrigger;
  reason?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  lockMode: 'postgres_advisory' | 'process_only';
  schedulerInstance: string;
  runId?: number;
  metrics: RunMetrics;
}

const SCHEDULER_INSTANCE = process.env.SCHEDULER_INSTANCE_ID || process.env.HOSTNAME || `pid-${process.pid}`;
const JOB_NAME = 'daily_price_check';
const ADVISORY_LOCK_KEY = 42424201;

const SAVINGS_PCT_THRESHOLD = (appConfig.pricing?.priceDropThreshold as number) ?? 0.05;
const MIN_SAVINGS_DOLLARS = (appConfig.pricing?.minimumSavingsAmount as number) ?? 0.5;
const DEDUPE_HOURS = 24;

function isPostgresDatabase(): boolean {
  const url = process.env.DATABASE_URL || '';
  return url.includes('postgres') || url.includes('supabase') || url.includes('pooler');
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('fetch failed')
  );
}

async function runPriceCheckForItemWithRetry(
  companyId: number,
  itemId: number
): Promise<{ retriedAttempts: number }> {
  const maxAttempts = 3;
  let attempt = 0;
  let retriedAttempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      await runPriceCheckForItem(companyId, itemId);
      return { retriedAttempts };
    } catch (err) {
      const retryable = isRetryableError(err);
      if (!retryable || attempt >= maxAttempts) {
        throw err;
      }
      retriedAttempts += 1;
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      console.warn(
        `⚠️ Retryable error for item ${itemId} (attempt ${attempt}/${maxAttempts}), retrying in ${backoffMs}ms`
      );
      await delay(backoffMs);
    }
  }
}

async function ensureRunTable(): Promise<void> {
  if (!isPostgresDatabase()) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "JobRun" (
      "id" BIGSERIAL PRIMARY KEY,
      "jobName" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "triggerType" TEXT NOT NULL,
      "schedulerInstance" TEXT NOT NULL,
      "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "finishedAt" TIMESTAMPTZ,
      "durationMs" INTEGER,
      "metrics" JSONB,
      "error" TEXT
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "idx_jobrun_job_started" ON "JobRun" ("jobName", "startedAt" DESC)`
  );
}

async function markAbandonedRuns(): Promise<void> {
  if (!isPostgresDatabase()) return;
  await ensureRunTable();
  await prisma.$executeRawUnsafe(
    `UPDATE "JobRun"
     SET "status" = 'failed',
         "finishedAt" = NOW(),
         "error" = COALESCE("error", 'abandoned_after_restart_or_timeout')
     WHERE "jobName" = $1
       AND "status" = 'running'
       AND ("schedulerInstance" <> $2 OR "startedAt" < NOW() - INTERVAL '30 minutes')`,
    JOB_NAME,
    SCHEDULER_INSTANCE
  );
}

async function insertRunRecord(trigger: RunTrigger): Promise<number | undefined> {
  if (!isPostgresDatabase()) return undefined;
  await ensureRunTable();
  const rows = (await prisma.$queryRawUnsafe(
    `INSERT INTO "JobRun" ("jobName","status","triggerType","schedulerInstance")
     VALUES ($1, $2, $3, $4)
     RETURNING "id"`,
    JOB_NAME,
    'running',
    trigger,
    SCHEDULER_INSTANCE
  )) as Array<{ id: number }>;
  return rows[0]?.id;
}

async function finishRunRecord(
  runId: number | undefined,
  status: RunStatus,
  durationMs: number,
  metrics: RunMetrics,
  errorText?: string
): Promise<void> {
  if (!isPostgresDatabase() || runId == null) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "JobRun"
     SET "status" = $1, "finishedAt" = NOW(), "durationMs" = $2, "metrics" = $3::jsonb, "error" = $4
     WHERE "id" = $5`,
    status,
    durationMs,
    JSON.stringify(metrics),
    errorText || null,
    runId
  );
}

async function acquireDistributedLock(): Promise<{
  acquired: boolean;
  lockMode: 'postgres_advisory' | 'process_only';
  release: () => Promise<void>;
}> {
  if (!isPostgresDatabase()) {
    return {
      acquired: true,
      lockMode: 'process_only',
      release: async () => {},
    };
  }
  const rows = (await prisma.$queryRawUnsafe(
    'SELECT pg_try_advisory_lock($1) AS locked',
    ADVISORY_LOCK_KEY
  )) as Array<{ locked: boolean }>;
  const locked = Boolean(rows[0]?.locked);
  return {
    acquired: locked,
    lockMode: 'postgres_advisory',
    release: async () => {
      if (locked) {
        await prisma.$queryRawUnsafe('SELECT pg_advisory_unlock($1)', ADVISORY_LOCK_KEY);
      }
    },
  };
}

export async function getLatestDailyPriceCheckRun(): Promise<Record<string, unknown> | null> {
  if (!isPostgresDatabase()) return null;
  await ensureRunTable();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT "id","jobName","status","triggerType","schedulerInstance","startedAt","finishedAt","durationMs","metrics","error"
     FROM "JobRun"
     WHERE "jobName" = $1
     ORDER BY "startedAt" DESC
     LIMIT 1`,
    JOB_NAME
  )) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function getDailyPriceCheckRuntimeStatus(): Record<string, unknown> {
  return {
    isRunning,
    schedulerInstance: SCHEDULER_INSTANCE,
    lastSuccessfulRunAt,
    lockMode: isPostgresDatabase() ? 'postgres_advisory' : 'process_only',
  };
}

export async function runDailyPriceCheck(trigger: RunTrigger = 'scheduled'): Promise<DailyPriceCheckRunSummary> {
  const startedAt = new Date();
  const baseMetrics: RunMetrics = {
    companiesEligible: 0,
    companiesProcessed: 0,
    totalDiscovery: 0,
    alertsCreated: 0,
    errors: 0,
    retriedItems: 0,
    retriedAttempts: 0,
  };
  if (isRunning) {
    console.log('⏸️  Daily price check already running, skipping...');
    return {
      status: 'skipped',
      trigger,
      reason: 'already_running',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      lockMode: isPostgresDatabase() ? 'postgres_advisory' : 'process_only',
      schedulerInstance: SCHEDULER_INSTANCE,
      metrics: baseMetrics,
    };
  }

  if (!appConfig.features.enableDailyPriceCheck) {
    console.log('⏸️  Daily price check disabled in config, skipping...');
    return {
      status: 'skipped',
      trigger,
      reason: 'feature_disabled',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      lockMode: isPostgresDatabase() ? 'postgres_advisory' : 'process_only',
      schedulerInstance: SCHEDULER_INSTANCE,
      metrics: baseMetrics,
    };
  }

  const lock = await acquireDistributedLock();
  if (!lock.acquired) {
    console.log('⏸️  Daily price check lock held by another process, skipping...');
    return {
      status: 'skipped',
      trigger,
      reason: 'lock_not_acquired',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      lockMode: lock.lockMode,
      schedulerInstance: SCHEDULER_INSTANCE,
      metrics: baseMetrics,
    };
  }

  isRunning = true;
  await markAbandonedRuns();
  const runId = await insertRunRecord(trigger);
  console.log(`\n🔍 Starting daily price check at ${startedAt.toISOString()} (trigger=${trigger}, instance=${SCHEDULER_INSTANCE})`);

  try {
    const maxMonitoredItems = (appConfig.monitoring?.maxMonitoredItemsPerCompany as number) || 20;
    console.log(`🔄 Recomputing Top ${maxMonitoredItems} per company (by QuickBooks quantity/spend)...`);
    await recomputeMonitoringForAllCompanies(maxMonitoredItems);

    // Get companies that are subscribed and QuickBooks connected
    const companies = await prisma.company.findMany({
      where: { isSubscribed: true, isQuickBooksConnected: true },
      select: { id: true },
    });

    let totalDiscovery = 0;
    let alertsCreated = 0;
    let errors = 0;
    let retriedItems = 0;
    let retriedAttempts = 0;
    let companiesProcessed = 0;
    const companiesEligible = companies.length;

    for (const company of companies) {
      const items = await getTopItemsForDiscovery(company.id, maxMonitoredItems);
      if (items.length === 0) continue;
      companiesProcessed += 1;

      console.log(`📦 Company ${company.id}: running discovery for ${items.length} items (Top ${maxMonitoredItems})`);

      for (const item of items) {
        try {
          const retryInfo = await runPriceCheckForItemWithRetry(item.companyId, item.id);
          if (retryInfo.retriedAttempts > 0) {
            retriedItems += 1;
            retriedAttempts += retryInfo.retriedAttempts;
          }
          totalDiscovery++;

          const baselineUnitPrice = item.baselineUnitPrice;
          if (baselineUnitPrice == null || baselineUnitPrice <= 0) continue;

          const itemAfter = await prisma.item.findUnique({
            where: { id: item.id },
            select: { bestDealUnitPrice: true, bestDealRetailer: true, bestDealUrl: true, userId: true },
          });

          const deal = computeDealState({
            baselineUnitPrice,
            bestDealUnitPrice: itemAfter?.bestDealUnitPrice ?? null,
          });

          const meetsPct =
            deal.dealState === 'deal' &&
            deal.savingsPct != null &&
            deal.savingsPct >= SAVINGS_PCT_THRESHOLD &&
            deal.savingsAmount != null &&
            deal.savingsAmount > 0 &&
            deal.bestPriceToday != null;
          const meetsDollars =
            deal.dealState === 'deal' &&
            deal.savingsAmount != null &&
            deal.savingsAmount >= MIN_SAVINGS_DOLLARS &&
            deal.bestPriceToday != null;

          if ((meetsPct || meetsDollars) && deal.bestPriceToday != null && deal.savingsAmount != null) {
            const bestToday = deal.bestPriceToday;
            const savingsAmt = deal.savingsAmount;
            const retailer = itemAfter?.bestDealRetailer ?? 'Unknown';
            const dedupeSince = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000);
            const existing = await prisma.alert.findFirst({
              where: {
                companyId: item.companyId,
                itemId: item.id,
                retailer,
                newPrice: bestToday,
                alertDate: { gte: dedupeSince },
              },
            });

            if (!existing) {
              await prisma.alert.create({
                data: {
                  itemId: item.id,
                  userId: itemAfter?.userId ?? item.userId,
                  companyId: item.companyId,
                  retailer,
                  newPrice: bestToday,
                  oldPrice: baselineUnitPrice,
                  priceDropAmount: savingsAmt,
                  url: itemAfter?.bestDealUrl ?? null,
                  savingsPerOrder: savingsAmt,
                  estimatedMonthlySavings: savingsAmt,
                  seen: false,
                  viewed: false,
                },
              });
              alertsCreated++;
              console.log(`✅ Alert: ${item.name} ($${baselineUnitPrice.toFixed(2)} → $${bestToday.toFixed(2)})`);
            }

            if (itemAfter?.userId) {
              await updateSavingsSummary(itemAfter.userId, item.companyId, savingsAmt);
            }
          }
        } catch (err) {
          console.error(`Error checking item ${item.id}:`, err);
          errors++;
        }
      }
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startedAt.getTime();
    const duration = durationMs / 1000;
    const metrics: RunMetrics = {
      companiesEligible,
      companiesProcessed,
      totalDiscovery,
      alertsCreated,
      errors,
      retriedItems,
      retriedAttempts,
    };

    console.log(`\n✅ Daily price check completed in ${duration}s`);
    console.log(`   📊 Items checked (discovery): ${totalDiscovery}`);
    console.log(`   🔔 Alerts created: ${alertsCreated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   🔁 Retried items/attempts: ${retriedItems}/${retriedAttempts}`);
    console.log(`   🏢 Companies processed: ${companiesProcessed}/${companiesEligible}`);

    await finishRunRecord(runId, 'success', durationMs, metrics);
    lastSuccessfulRunAt = endTime.toISOString();
    return {
      status: 'success',
      trigger,
      startedAt: startedAt.toISOString(),
      finishedAt: endTime.toISOString(),
      durationMs,
      lockMode: lock.lockMode,
      schedulerInstance: SCHEDULER_INSTANCE,
      runId,
      metrics,
    };

  } catch (error) {
    console.error('❌ Daily price check failed:', error);
    const endTime = new Date();
    const durationMs = endTime.getTime() - startedAt.getTime();
    await finishRunRecord(
      runId,
      'failed',
      durationMs,
      baseMetrics,
      error instanceof Error ? error.message : 'unknown_error'
    );
    return {
      status: 'failed',
      trigger,
      reason: error instanceof Error ? error.message : 'unknown_error',
      startedAt: startedAt.toISOString(),
      finishedAt: endTime.toISOString(),
      durationMs,
      lockMode: lock.lockMode,
      schedulerInstance: SCHEDULER_INSTANCE,
      runId,
      metrics: baseMetrics,
    };
  } finally {
    await lock.release().catch((e) => {
      console.error('Failed to release advisory lock:', e);
    });
    isRunning = false;
  }
}

/**
 * Update savings summary for a user (tenant-scoped)
 */
async function updateSavingsSummary(userId: number, companyId: number, savingsAmount: number) {
  try {
    const existing = await prisma.savingsSummary.findFirst({
      where: { userId, companyId }
    });

    if (existing) {
      await prisma.savingsSummary.update({
        where: { id: existing.id },
        data: {
          monthlyTotal: { increment: savingsAmount },
          lastCalculated: new Date()
        }
      });
    } else {
      await prisma.savingsSummary.create({
        data: {
          userId,
          companyId,
          monthlyTotal: savingsAmount,
          yearToDate: savingsAmount,
          lastCalculated: new Date()
        }
      });
    }
  } catch (error) {
    console.error('Error updating savings summary:', error);
  }
}

/**
 * Start the daily price check cron job
 */
export function startDailyPriceCheckCron() {
  if (!appConfig.features.enableDailyPriceCheck) {
    console.log('⏸️  Daily price check disabled in config');
    return;
  }

  const cronExpression = appConfig.scheduling.priceCheckCron || '0 3 * * *';
  
  cron.schedule(cronExpression, () => {
    console.log(`\n⏰ Triggered scheduled price check (${new Date().toISOString()})`);
    runDailyPriceCheck();
  });

  console.log(`✅ Daily price check scheduled: ${cronExpression} (${appConfig.scheduling.priceCheckTime})`);
}

