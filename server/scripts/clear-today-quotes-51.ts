import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const deleted = await prisma.retailerPriceQuote.deleteMany({
    where: {
      itemId: 51,
      capturedAt: { gte: start, lt: end },
    },
  });
  console.log('Deleted', deleted.count, 'quotes for item 51 today');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
