/**
 * Sets req.companyId (and req.user when available) for tenant isolation.
 * No JWT/session yet: resolves test user by email. Compatible with TEST_MODE.
 */
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import appConfig from '../../../config/app.json';

const TEST_MODE = String(process.env.TEST_MODE || '').trim().toLowerCase() === 'true' || (appConfig.testing?.testMode as boolean) || false;
const TEST_USER_EMAIL = (appConfig.testing?.testUserEmail as string) || 'test@procuroapp.com';

export interface CompanyContext {
  companyId: number | null;
  user?: { id: number; email: string; companyId: number | null };
}

declare global {
  namespace Express {
    interface Request {
      companyId: number | null;
      companyContextUser?: { id: number; email: string; companyId: number | null };
    }
  }
}

/**
 * Resolve company (and user) for this request. Sets req.companyId and optionally req.companyContextUser.
 * In TEST_MODE: X-Test-Company-Id overrides company; X-Test-User-Email overrides which user (and thus company) we act as.
 */
export async function companyContext(req: Request, res: Response, next: NextFunction) {
  try {
    if (TEST_MODE && req.headers['x-test-company-id']) {
      const id = parseInt(String(req.headers['x-test-company-id']), 10);
      if (!isNaN(id)) {
        req.companyId = id;
        return next();
      }
    }

    const emailToUse = (TEST_MODE && req.headers['x-test-user-email'])
      ? String(req.headers['x-test-user-email']).trim()
      : TEST_USER_EMAIL;
    if (!emailToUse) {
      req.companyId = null;
      return next();
    }

    const user = await prisma.user.findFirst({
      where: { email: emailToUse },
      include: { company: true },
    });

    if (user) {
      req.companyContextUser = { id: user.id, email: user.email, companyId: user.companyId };
      req.companyId = user.companyId ?? null;
    } else {
      req.companyId = null;
    }
    next();
  } catch (e) {
    console.error('companyContext error:', e);
    res.status(500).json({ error: 'Failed to resolve company context' });
  }
}
