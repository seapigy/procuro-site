export type SchedulerRole = 'api' | 'worker' | 'all' | 'off';

const VALID_ROLES: SchedulerRole[] = ['api', 'worker', 'all', 'off'];

export function getSchedulerRole(): SchedulerRole {
  const raw = (process.env.SCHEDULER_ROLE || '').trim().toLowerCase();
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
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`
    );
  }
}

