/**
 * Deletes every Company and tenant-scoped data. Bright Data tables have no FK to Company,
 * so they are cleared first. AdminAuditLog rows keep history with companyId set null.
 *
 * Usage (from server/): npx tsx scripts/wipe-all-companies.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.company.count();
  console.log(`Companies before: ${before}`);
  if (before === 0) {
    console.log('Nothing to delete.');
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const jobs = await tx.brightDataScrapeJob.deleteMany({});
    const samples = await tx.brightDataRawSample.deleteMany({});
    const companies = await tx.company.deleteMany({});
    return { jobs: jobs.count, samples: samples.count, companies: companies.count };
  });

  const users = await prisma.user.count();
  console.log('Deleted:', result);
  console.log(`Users remaining (orphan / no company): ${users}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
