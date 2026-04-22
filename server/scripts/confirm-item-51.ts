import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ id: number; name: string; matchedUrl: string | null; matchUrl: string | null; manualMatchUrl: string | null }>
  >`
    select id, name, "matchedUrl", "matchUrl", "manualMatchUrl"
    from "Item"
    where id = 51
  `;
  console.log(JSON.stringify(rows[0], null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
