import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.item.findFirst({
    where: { id: 51 },
    include: { user: { select: { email: true } } },
  });
  if (!item) {
    console.log('Item 51 not found');
    return;
  }
  console.log('Item 51:', JSON.stringify({
    id: item.id,
    name: item.name,
    companyId: item.companyId,
    matchedUrl: item.matchedUrl,
    matchUrl: item.matchUrl,
    manualMatchUrl: item.manualMatchUrl,
    user: item.user?.email,
  }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
