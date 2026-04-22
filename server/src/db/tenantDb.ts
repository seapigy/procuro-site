/**
 * Tenant-scoped DB access for RLS.
 * Use withCompany(companyId, fn) so that all queries in fn run with app.company_id set.
 */
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export { prisma };

/**
 * Run a function inside a transaction with app.company_id set for RLS.
 * Use the tx client for all DB operations inside fn so RLS applies.
 */
export async function withCompany<T>(
  companyId: number | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const value = companyId == null ? '' : String(companyId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config('app.company_id', $1, true)",
      value
    );
    return fn(tx);
  });
}

export type { Prisma };
