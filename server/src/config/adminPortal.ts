import crypto from 'crypto';

const ONE_DAY_SECONDS = 60 * 60 * 24;

export function isAdminPortalEnabled(): boolean {
  return String(process.env.ADMIN_PORTAL_ENABLED || '').trim().toLowerCase() === 'true';
}

export function getAdminOwnerEmails(): string[] {
  return String(process.env.ADMIN_OWNER_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getGoogleClientId(): string {
  return String(process.env.GOOGLE_ADMIN_CLIENT_ID || '').trim();
}

export function getAdminSessionSecret(): string {
  const value = String(process.env.ADMIN_PORTAL_SESSION_SECRET || process.env.JWT_SECRET || '').trim();
  if (!value) {
    throw new Error('Missing ADMIN_PORTAL_SESSION_SECRET (or JWT_SECRET fallback)');
  }
  return value;
}

export function getAdminSessionMaxAgeSeconds(): number {
  const fromEnv = Number(process.env.ADMIN_PORTAL_SESSION_MAX_AGE_SECONDS || '');
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return ONE_DAY_SECONDS;
}

export function signAdminSession(payload: Record<string, unknown>): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getAdminSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSession(token: string): Record<string, unknown> | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = crypto.createHmac('sha256', getAdminSessionSecret()).update(encodedPayload).digest('base64url');
  if (signature !== expected) return null;

  const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<string, unknown>;
  const exp = typeof parsed.exp === 'number' ? parsed.exp : 0;
  if (!exp || Date.now() > exp) return null;
  return parsed;
}
