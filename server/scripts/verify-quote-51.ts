import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const q = await prisma.retailerPriceQuote.findFirst({
    where: { itemId: 51 },
    orderBy: { capturedAt: 'desc' },
    select: { id: true, retailer: true, unitPrice: true, rawJson: true },
  });
  if (!q) {
    console.log('No quote found');
    return;
  }
  const j = q.rawJson as Record<string, unknown> | null;
  console.log(
    JSON.stringify(
      {
        id: q.id,
        retailer: q.retailer,
        unitPrice: q.unitPrice,
        hasAsin: !!j?.asin,
        hasSource: !!j?.source,
        sampleKeys: j ? Object.keys(j).slice(0, 12) : [],
      },
      null,
      2
    )
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
