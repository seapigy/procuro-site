-- AlterTable: Add sticky baseline and best-deal fields to Item (savings based on baseline unit price)
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "baselineUnitPrice" DOUBLE PRECISION;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "baselineSetAt" TIMESTAMP(3);
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "baselineSource" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "bestDealUnitPrice" DOUBLE PRECISION;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "bestDealFoundAt" TIMESTAMP(3);
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "bestDealRetailer" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "bestDealUrl" TEXT;
