-- AlterTable
-- Columns were added manually; IF NOT EXISTS makes this migration idempotent (no-op if columns exist)
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "walmartProductId" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "walmartProductUrl" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "walmartMatchedAt" TIMESTAMP(3);
