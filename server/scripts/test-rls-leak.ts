/**
 * RLS leak test: proves that Company A cannot read or write Company B's data.
 * Run: npm run test:rls (from server dir). Requires DATABASE_URL and existing schema + RLS.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import prisma from '../src/lib/prisma';
import { withCompany } from '../src/db/tenantDb';

async function main() {
  console.log('🔒 RLS leak test: creating two companies and one item each...\n');

  // Create Company A and B (no RLS on Company table)
  const companyA = await prisma.company.upsert({
    where: { realmId: 'rls-test-realm-a' },
    create: { realmId: 'rls-test-realm-a', name: 'RLS Test Company A' },
    update: {},
  });
  const companyB = await prisma.company.upsert({
    where: { realmId: 'rls-test-realm-b' },
    create: { realmId: 'rls-test-realm-b', name: 'RLS Test Company B' },
    update: {},
  });

  const userA = await prisma.user.upsert({
    where: { email: 'rls-test-a@test.local' },
    create: { email: 'rls-test-a@test.local', name: 'User A', companyId: companyA.id },
    update: { companyId: companyA.id },
  });
  const userB = await prisma.user.upsert({
    where: { email: 'rls-test-b@test.local' },
    create: { email: 'rls-test-b@test.local', name: 'User B', companyId: companyB.id },
    update: { companyId: companyB.id },
  });

  await prisma.item.deleteMany({ where: { name: 'RLS Test Item A' } });
  await prisma.item.deleteMany({ where: { name: 'RLS Test Item B' } });

  await withCompany(companyA.id, async (tx) => {
    await tx.item.create({
      data: {
        userId: userA.id,
        companyId: companyA.id,
        name: 'RLS Test Item A',
        lastPaidPrice: 10,
      },
    });
  });
  await withCompany(companyB.id, async (tx) => {
    await tx.item.create({
      data: {
        userId: userB.id,
        companyId: companyB.id,
        name: 'RLS Test Item B',
        lastPaidPrice: 20,
      },
    });
  });

  let passed = true;

  // Test 1: In company A context, only A's item should be returned
  const itemsInA = await withCompany(companyA.id, async (tx) => {
    return tx.item.findMany({ where: { name: { contains: 'RLS Test Item' } } });
  });
  const hasB = itemsInA.some((i) => i.name === 'RLS Test Item B');
  if (hasB) {
    console.log('❌ FAIL: In Company A context, Company B\'s item was returned (leak).');
    passed = false;
  } else {
    console.log('✅ PASS: In Company A context, only A\'s rows returned.');
  }

  // Test 2: In company B context, only B's item
  const itemsInB = await withCompany(companyB.id, async (tx) => {
    return tx.item.findMany({ where: { name: { contains: 'RLS Test Item' } } });
  });
  const hasAInB = itemsInB.some((i) => i.name === 'RLS Test Item A');
  if (hasAInB) {
    console.log('❌ FAIL: In Company B context, Company A\'s item was returned (leak).');
    passed = false;
  } else {
    console.log('✅ PASS: In Company B context, only B\'s rows returned.');
  }

  // Test 3: Insert with wrong companyId in A context should be blocked by RLS (or app must not do it)
  try {
    await withCompany(companyA.id, async (tx) => {
      await tx.item.create({
        data: {
          userId: userA.id,
          companyId: companyB.id,
          name: 'RLS Forbidden Cross-tenant Item',
          lastPaidPrice: 99,
        },
      });
    });
    console.log('❌ FAIL: Insert with companyId=B inside A context succeeded (RLS should block).');
    passed = false;
  } catch (e: any) {
    if (e.message?.includes('violates row-level security') || e.code === 'P2003' || e.code === '42501') {
      console.log('✅ PASS: Insert with wrong companyId in A context was blocked.');
    } else {
      console.log('⚠️  Insert failed with:', e.message || e.code, '(expected RLS or FK block)');
    }
  }

  // Cleanup
  await prisma.item.deleteMany({ where: { name: { contains: 'RLS Test Item' } } });
  await prisma.item.deleteMany({ where: { name: 'RLS Forbidden Cross-tenant Item' } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { in: ['rls-test-a@test.local', 'rls-test-b@test.local'] } } }).catch(() => {});
  await prisma.company.deleteMany({ where: { realmId: { in: ['rls-test-realm-a', 'rls-test-realm-b'] } } }).catch(() => {});

  console.log('\n' + (passed ? '✅ All RLS leak tests PASSED.' : '❌ Some tests FAILED.'));
  process.exit(passed ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
