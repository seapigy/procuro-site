import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

/**
 * Middleware to ensure the user's company has an active subscription
 * Blocks access to premium features if not subscribed
 *
 * Prefers `req.companyId` from `companyContext` (TEST_MODE + X-Test-User-Email, or default test user).
 * Falls back to legacy lookup by `test@procuroapp.com` when companyId is missing (sub-routers in tests).
 */
export async function ensureSubscribed(req: Request, res: Response, next: NextFunction) {
  try {
    let company =
      req.companyId != null
        ? await prisma.company.findUnique({ where: { id: req.companyId } })
        : null;

    if (!company) {
      const user = await prisma.user.findFirst({
        where: { email: 'test@procuroapp.com' },
        include: { company: true },
      });

      if (!user || !user.company) {
        return res.status(404).json({
          error: 'User or company not found',
          requiresSubscription: true,
        });
      }
      company = user.company;
    }

    if (!company.isSubscribed) {
      return res.status(403).json({
        error: 'Subscription required',
        requiresSubscription: true,
        message: 'This feature requires an active subscription. Please upgrade to continue.',
      });
    }

    (req as Request & { company?: typeof company }).company = company;
    next();
  } catch (error) {
    console.error('Error in ensureSubscribed middleware:', error);
    res.status(500).json({
      error: 'Failed to verify subscription',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

