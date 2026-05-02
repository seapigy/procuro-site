import '../src/loadEnv';
import prisma from '../src/lib/prisma';

async function main() {
  const count = await prisma.company.count();
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      realmId: true,
      isQuickBooksConnected: true,
      paymentMethodAddedAt: true,
      lastImportedItemCount: true,
      importCompletedAt: true,
      importLastAttemptedAt: true,
    },
    orderBy: { id: 'asc' },
  });
  console.log(JSON.stringify({ count, companies }, null, 2));
}

main().finally(() => prisma.$disconnect());
