import { Router, Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import {
  getAdminOwnerEmails,
  getAdminSessionMaxAgeSeconds,
  getGoogleClientId,
  isAdminPortalEnabled,
  signAdminSession,
} from '../config/adminPortal';
import { requireAdminAuth, setAdminSessionCookie, writeAdminAudit } from '../middleware/adminAuth';

const router = Router();

async function verifyGoogleIdToken(idToken: string) {
  const tokenInfoUrl = 'https://oauth2.googleapis.com/tokeninfo';
  const response = await axios.get(tokenInfoUrl, { params: { id_token: idToken } });
  return response.data as {
    sub?: string;
    email?: string;
    email_verified?: string;
    aud?: string;
    exp?: string;
  };
}

router.get('/auth/config', (_req: Request, res: Response) => {
  if (!isAdminPortalEnabled()) return res.status(404).json({ error: 'Not found' });
  res.json({
    enabled: true,
    googleClientId: getGoogleClientId(),
  });
});

router.post('/auth/login', async (req: Request, res: Response) => {
  if (!isAdminPortalEnabled()) return res.status(404).json({ error: 'Not found' });
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) return res.status(400).json({ error: 'Missing idToken' });

    const tokenInfo = await verifyGoogleIdToken(idToken);
    const email = String(tokenInfo.email || '').trim().toLowerCase();
    const sub = String(tokenInfo.sub || '').trim();
    const aud = String(tokenInfo.aud || '').trim();
    const verified = String(tokenInfo.email_verified || '').toLowerCase() === 'true';
    const expMs = Number(tokenInfo.exp || '0') * 1000;
    if (!email || !sub || !verified || !aud || !expMs) {
      return res.status(404).json({ error: 'Not found' });
    }

    const expectedClientId = getGoogleClientId();
    if (!expectedClientId || aud !== expectedClientId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const allowedOwners = getAdminOwnerEmails();
    if (!allowedOwners.includes(email)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const expiresAt = Math.min(expMs, Date.now() + getAdminSessionMaxAgeSeconds() * 1000);
    const token = signAdminSession({ sub, email, exp: expiresAt });
    setAdminSessionCookie(res, token);

    req.adminUser = { email, sub };
    await writeAdminAudit(req, { action: 'admin_login', success: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin login failed', error);
    await writeAdminAudit(req, { action: 'admin_login', success: false, errorCode: 'oauth_token_exchange_failed' });
    res.status(404).json({ error: 'Not found' });
  }
});

router.post('/auth/logout', requireAdminAuth, async (req: Request, res: Response) => {
  res.setHeader(
    'Set-Cookie',
    `procuro_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
  await writeAdminAudit(req, { action: 'admin_logout', success: true });
  res.json({ success: true });
});

router.get('/session', requireAdminAuth, async (req: Request, res: Response) => {
  await writeAdminAudit(req, { action: 'admin_session_check', success: true });
  res.json({ authenticated: true, email: req.adminUser?.email || '' });
});

router.get('/import-runs', requireAdminAuth, async (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const companyId = Number(req.query.companyId || '');
  const hasCompanyFilter = Number.isFinite(companyId) && companyId > 0;

  const runs = await prisma.importRun.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(hasCompanyFilter ? { companyId } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      company: { select: { id: true, name: true } },
      user: { select: { id: true, email: true } },
    },
  });

  await writeAdminAudit(req, { action: 'admin_import_runs_read', success: true });
  res.json({ runs });
});

router.get('/import-summary', requireAdminAuth, async (req: Request, res: Response) => {
  const slowThresholdMs = Number(process.env.ADMIN_IMPORT_SLOW_THRESHOLD_MS || '60000');
  const runs = await prisma.importRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 400,
    include: { company: { select: { id: true, name: true } } },
  });

  const byCompany = new Map<number, typeof runs>();
  for (const run of runs) {
    const existing = byCompany.get(run.companyId) || [];
    existing.push(run);
    byCompany.set(run.companyId, existing);
  }

  const companyAlerts = Array.from(byCompany.values()).map((companyRuns) => {
    let consecutiveFailures = 0;
    for (const run of companyRuns) {
      if (run.status === 'error') consecutiveFailures += 1;
      else break;
    }
    const lastSuccess = companyRuns.find((run) => run.status === 'success' || run.status === 'empty')?.startedAt || null;
    const slowCount = companyRuns.filter((run) => (run.durationMs || 0) > slowThresholdMs).length;
    const company = companyRuns[0]?.company;
    return {
      companyId: company?.id || companyRuns[0]?.companyId,
      companyName: company?.name || null,
      consecutiveFailures,
      slowRunCount: slowCount,
      lastSuccessAt: lastSuccess,
      staleNoSuccess24h: !lastSuccess || Date.now() - new Date(lastSuccess).getTime() > 24 * 60 * 60 * 1000,
    };
  });

  const errorBreakdown = await prisma.importRun.groupBy({
    by: ['errorCode'],
    where: { status: 'error' },
    _count: { _all: true },
    orderBy: { _count: { errorCode: 'desc' } },
    take: 20,
  });

  await writeAdminAudit(req, { action: 'admin_import_summary_read', success: true });
  res.json({
    slowThresholdMs,
    companyAlerts,
    errorBreakdown: errorBreakdown.map((row) => ({
      errorCode: row.errorCode || 'unknown_internal_error',
      count: row._count._all,
    })),
  });
});

router.get('/audit/access', requireAdminAuth, async (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  await writeAdminAudit(req, { action: 'admin_audit_read', success: true });
  res.json({ logs });
});

export default router;
