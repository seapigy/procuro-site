/**
 * Run price check for item 51.
 * Run: npx ts-node server/scripts/run-price-check-51.ts
 */
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { PrismaClient } from '@prisma/client';
import { runPriceCheckForItem } from '../src/services/priceCheck';

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.item.findFirst({
    where: { id: 51 },
    select: { companyId: true, name: true },
  });
  if (!item) {
    console.error('Item 51 not found');
    process.exit(1);
  }
  console.log('Running price check for item 51 (companyId:', item.companyId, ')');
  const result = await runPriceCheckForItem(item.companyId, 51);
  console.log('Result:', JSON.stringify(result, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
