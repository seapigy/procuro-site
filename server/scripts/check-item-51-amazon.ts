import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.item.findFirst({
    where: { id: 51 },
    select: {
      id: true,
      name: true,
      amazonAsin: true,
      amazonProductUrl: true,
      amazonMatchedAt: true,
      matchedUrl: true,
    },
  });
  console.log(JSON.stringify(item, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
