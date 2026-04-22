-- Optional product brand and Amazon search hint for discovery/matching (Supabase/Postgres)
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "productBrand" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "amazonSearchHint" TEXT;
