import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import appConfig from '../../../config/app.json';

const router = Router();

const TEST_MODE =
  String(process.env.TEST_MODE || '').trim().toLowerCase() === 'true' ||
  (appConfig.testing?.testMode as boolean) ||
  false;

type NextStep = 'CONNECT_QB' | 'ADD_PAYMENT' | 'IMPORTING' | 'READY';

async function resolveActivationCompany(req: Request) {
  if (req.companyId) {
    const direct = await prisma.company.findUnique({ where: { id: req.companyId } });
    if (direct) return direct;
  }

  // Fallback for production flows where request context user is not yet hydrated:
  // use the most recently connected/imported company so users do not get sent back to CONNECT_QB loops.
  return prisma.company.findFirst({
    where: {
      OR: [
        { isQuickBooksConnected: true },
        { realmId: { not: null } },
        { importCompletedAt: { not: null } },
      ],
    },
    orderBy: [
      { importCompletedAt: 'desc' },
      { importLastAttemptedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

/**
 * GET /api/company/activation
 * Returns company activation status for onboarding gating.
 *
 * Company resolution uses companyContext (req.companyId).
 */
router.get('/activation', async (req: Request, res: Response) => {
  try {
    const company = await resolveActivationCompany(req);
    if (!company) {
      return res.json({
        companyId: null,
        companyName: null,
        isQuickBooksConnected: false,
        hasPaymentMethod: false,
        trialActive: false,
        trialEndsAt: null,
        lastImportedItemCount: null,
        importCompleted: false,
        importLastAttemptedAt: null,
        nextStep: 'CONNECT_QB' as NextStep,
      });
    }

    const isQuickBooksConnected = company.isQuickBooksConnected || !!company.realmId;
    const hasPaymentMethod = company.paymentMethodAddedAt != null;
    const lastImportedItemCount = company.lastImportedItemCount ?? null;
    /** Import finished when we recorded a result — including 0 QB purchase lines (empty sandbox is valid). */
    const importCompleted =
      company.importCompletedAt != null ||
      (company.importLastAttemptedAt != null && lastImportedItemCount !== null);

    const now = new Date();
    const trialActive =
      (company.trialEndsAt != null && company.trialEndsAt > now) ||
      (company.trialStartedAt != null && company.isSubscribed);

    let nextStep: NextStep;
    if (!isQuickBooksConnected) {
      nextStep = 'CONNECT_QB';
    } else if (!hasPaymentMethod) {
      nextStep = 'ADD_PAYMENT';
    } else if (!importCompleted) {
      nextStep = 'IMPORTING';
    } else {
      nextStep = 'READY';
    }

    res.json({
      companyId: company.id,
      companyName: company.name,
      isQuickBooksConnected,
      hasPaymentMethod,
      trialActive,
      trialEndsAt: company.trialEndsAt?.toISOString() ?? null,
      lastImportedItemCount,
      importCompleted,
      importLastAttemptedAt: company.importLastAttemptedAt?.toISOString() ?? null,
      nextStep,
      testMode: TEST_MODE,
    });
  } catch (error) {
    console.error('Error fetching activation status:', error);
    res.status(500).json({
      error: 'Failed to fetch activation status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
