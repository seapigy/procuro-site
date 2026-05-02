import type { Request } from 'express';
import prisma from '../lib/prisma';

/**
 * Same company resolution as onboarding activation when `req.companyId` is unset
 * (e.g. non–TEST_MODE without session headers): pick the most recently active connected/imported company.
 */
export async function resolveActivationCompany(req: Request) {
  if (req.companyId) {
    const direct = await prisma.company.findUnique({ where: { id: req.companyId } });
    if (direct) return direct;
  }

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
