import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ id: number; retailer: string; unitPrice: number; capturedAt: Date; rawJson: unknown }>
  >`
    select id, retailer, "unitPrice", "capturedAt", "rawJson"
    from "RetailerPriceQuote"
    order by "capturedAt" desc
    limit 5
  `;
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
