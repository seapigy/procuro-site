/**
 * Backfill ItemRetailerMatch from existing Item Amazon identity columns.
 * Safe to run multiple times (upsert by itemId+retailer).
 */
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';
import { buildCanonicalProductUrl } from '../src/utils/amazonIdentity';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.item.findMany({
    where: {
      OR: [{ amazonAsin: { not: null } }, { amazonProductUrl: { not: null } }],
    },
    select: {
      id: true,
      companyId: true,
      amazonAsin: true,
      amazonProductUrl: true,
      amazonMatchedAt: true,
    },
  });

  let amazonCreated = 0;
  let amazonSkipped = 0;

  for (const item of items) {
    const hasAmazon =
      (item.amazonAsin != null && item.amazonAsin.trim() !== '') ||
      (item.amazonProductUrl != null && item.amazonProductUrl.trim() !== '');
    if (hasAmazon) {
      const retailerProductId = item.amazonAsin?.trim() || null;
      const productUrl =
        item.amazonProductUrl?.trim() ||
        (retailerProductId ? buildCanonicalProductUrl(retailerProductId) : null);
      const existing = await prisma.itemRetailerMatch.findUnique({
        where: { itemId_retailer: { itemId: item.id, retailer: 'Amazon' } },
      });
      if (existing) {
        amazonSkipped += 1;
      } else {
        await prisma.itemRetailerMatch.create({
          data: {
            itemId: item.id,
            companyId: item.companyId,
            retailer: 'Amazon',
            retailerProductId: retailerProductId,
            productUrl,
            matchedAt: item.amazonMatchedAt ?? new Date(),
            isActive: true,
          },
        });
        amazonCreated += 1;
      }
    }
  }

  console.log('Backfill complete:');
  console.log('  Amazon: created', amazonCreated, ', skipped (existing)', amazonSkipped);
  console.log('  Items processed:', items.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
