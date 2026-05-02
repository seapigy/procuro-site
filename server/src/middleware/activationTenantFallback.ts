/**
 * When browser requests have no TEST_MODE headers / session, `companyContext` leaves
 * `req.companyId` unset. Align with activation + billing: resolve the active QB company
 * and attach the first user so tenant-scoped APIs work on same-origin production.
 *
 * Skips OAuth callback (tenant established inside handler), Stripe webhook, and admin APIs.
 */
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { resolveActivationCompany } from '../services/activationCompany';

export async function activationTenantFallback(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.companyId != null && req.companyContextUser) {
      return next();
    }

    const url = req.originalUrl || '';
    if (
      url.includes('/api/admin') ||
      url.includes('/api/billing/webhook') ||
      url.includes('/api/qb/callback')
    ) {
      return next();
    }

    const company = await resolveActivationCompany(req);
    if (!company) {
      return next();
    }

    const user = await prisma.user.findFirst({
      where: { companyId: company.id },
      include: { company: true },
      orderBy: { id: 'asc' },
    });
    if (!user) {
      return next();
    }

    req.companyId = company.id;
    req.companyContextUser = {
      id: user.id,
      email: user.email,
      companyId: user.companyId,
    };
    next();
  } catch (e) {
    console.error('activationTenantFallback:', e);
    next();
  }
}
