export type SchedulerRole = 'api' | 'worker' | 'all' | 'off';

const VALID_ROLES: SchedulerRole[] = ['api', 'worker', 'all', 'off'];
const DEBUG_ENDPOINT = 'http://127.0.0.1:7545/ingest/f4bfa72e-90fa-47b6-884e-f6553cda177d';

function emitRuntimeDebugLog(runId: string, hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9538fe' },
    body: JSON.stringify({
      sessionId: '9538fe',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

export function getSchedulerRole(): SchedulerRole {
  const raw = (process.env.SCHEDULER_ROLE || '').trim().toLowerCase();
  emitRuntimeDebugLog('render-startup', 'H4', 'runtime.ts:getSchedulerRole', 'Scheduler role raw env read', {
    hasValue: !!raw,
    rawValue: raw || null,
    nodeEnv: process.env.NODE_ENV || null,
  });
  if (!raw) {
    // Safe default for local/dev and single-instance deployments.
    return process.env.NODE_ENV === 'production' ? 'api' : 'all';
  }
  if (VALID_ROLES.includes(raw as SchedulerRole)) {
    return raw as SchedulerRole;
  }
  throw new Error(
    `Invalid SCHEDULER_ROLE="${process.env.SCHEDULER_ROLE}". Valid values: ${VALID_ROLES.join(', ')}`
  );
}

export function shouldStartCronSchedulers(role: SchedulerRole): boolean {
  return role === 'all' || role === 'worker';
}

export function validateRequiredEnvForRuntime(): void {
  emitRuntimeDebugLog('render-startup', 'H1', 'runtime.ts:validateRequiredEnvForRuntime:entry', 'Runtime validation entered', {
    nodeEnv: process.env.NODE_ENV || null,
  });
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'DATABASE_URL',
    'ENCRYPTION_KEY',
    'MONITORING_ADMIN_TOKEN',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_ID_MONTHLY',
    'QUICKBOOKS_CLIENT_ID',
    'QUICKBOOKS_CLIENT_SECRET',
    'QUICKBOOKS_REDIRECT_URI',
    'FRONTEND_URL',
    'SCHEDULER_ROLE',
  ];

  const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  emitRuntimeDebugLog(
    'render-startup',
    'H2',
    'runtime.ts:validateRequiredEnvForRuntime:missing',
    'Required env presence check computed',
    {
      missing,
      presentFlags: Object.fromEntries(required.map((k) => [k, !!(process.env[k] && String(process.env[k]).trim())])),
    }
  );
  if (missing.length > 0) {
    emitRuntimeDebugLog(
      'render-startup',
      'H3',
      'runtime.ts:validateRequiredEnvForRuntime:throw',
      'Throwing for missing required production env vars',
      { missingCount: missing.length, missing }
    );
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`
    );
  }
}

