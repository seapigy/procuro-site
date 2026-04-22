import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.item.update({
    where: { id: 51 },
    data: { matchedUrl: 'https://www.amazon.com/dp/B0798DVT68' },
  });
  console.log('Updated item 51:', JSON.stringify({
    id: updated.id,
    name: updated.name,
    matchedUrl: updated.matchedUrl,
    matchUrl: updated.matchUrl,
    manualMatchUrl: updated.manualMatchUrl,
  }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
