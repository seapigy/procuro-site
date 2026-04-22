-- Add companyId to tenant tables for RLS isolation. Backfill from existing relations then set NOT NULL.

-- Item: add companyId, backfill from User.companyId via userId
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
UPDATE "Item" i SET "companyId" = u."companyId" FROM "User" u WHERE i."userId" = u.id AND u."companyId" IS NOT NULL;
UPDATE "Item" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
ALTER TABLE "Item" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Item_companyId_idx" ON "Item"("companyId");
DO $$ BEGIN
  ALTER TABLE "Item" ADD CONSTRAINT "Item_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Price: add companyId, backfill from Item.companyId
ALTER TABLE "Price" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
UPDATE "Price" p SET "companyId" = i."companyId" FROM "Item" i WHERE p."itemId" = i.id;
UPDATE "Price" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
ALTER TABLE "Price" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Price_companyId_idx" ON "Price"("companyId");

-- Alert: add companyId, backfill from User.companyId via userId
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
UPDATE "Alert" a SET "companyId" = u."companyId" FROM "User" u WHERE a."userId" = u.id AND u."companyId" IS NOT NULL;
UPDATE "Alert" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
ALTER TABLE "Alert" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Alert_companyId_idx" ON "Alert"("companyId");

-- SavingsSummary: add companyId, backfill from User.companyId
ALTER TABLE "SavingsSummary" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
UPDATE "SavingsSummary" s SET "companyId" = u."companyId" FROM "User" u WHERE s."userId" = u.id AND u."companyId" IS NOT NULL;
UPDATE "SavingsSummary" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
ALTER TABLE "SavingsSummary" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "SavingsSummary_companyId_idx" ON "SavingsSummary"("companyId");

-- PriceHistory: add companyId, backfill from Item.companyId
ALTER TABLE "PriceHistory" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
UPDATE "PriceHistory" ph SET "companyId" = i."companyId" FROM "Item" i WHERE ph."itemId" = i.id;
UPDATE "PriceHistory" SET "companyId" = (SELECT id FROM "Company" LIMIT 1) WHERE "companyId" IS NULL;
ALTER TABLE "PriceHistory" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "PriceHistory_companyId_idx" ON "PriceHistory"("companyId");
