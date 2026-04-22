/* Run this ENTIRE file ONCE in Supabase SQL Editor. Creates Procuro tables and marks migration applied. */

CREATE TABLE IF NOT EXISTS "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "realmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "isQuickBooksConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastImportedItemCount" INTEGER,
    "connectionBrokenAt" TIMESTAMP(3),
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" INTEGER,
    "quickbooksId" TEXT,
    "quickbooksAccessToken" TEXT,
    "quickbooksRefreshToken" TEXT,
    "quickbooksRealmId" TEXT,
    "quickbooksConnectedAt" TIMESTAMP(3),
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Item" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "baselinePrice" DOUBLE PRECISION,
    "lastPaidPrice" DOUBLE PRECISION NOT NULL,
    "lastCheckedPrice" DOUBLE PRECISION,
    "quantityPerOrder" INTEGER NOT NULL DEFAULT 1,
    "reorderIntervalDays" INTEGER NOT NULL DEFAULT 30,
    "vendorName" TEXT,
    "upc" TEXT,
    "matchedRetailer" TEXT,
    "matchedUrl" TEXT,
    "matchedPrice" DOUBLE PRECISION,
    "matchConfidence" DOUBLE PRECISION,
    "isVagueName" BOOLEAN NOT NULL DEFAULT false,
    "needsClarification" BOOLEAN NOT NULL DEFAULT false,
    "normalizedName" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchProvider" TEXT,
    "matchUrl" TEXT,
    "matchTitle" TEXT,
    "matchPrice" DOUBLE PRECISION,
    "matchReasons" JSONB,
    "isManuallyMatched" BOOLEAN NOT NULL DEFAULT false,
    "manualMatchProvider" TEXT,
    "manualMatchUrl" TEXT,
    "manualMatchTitle" TEXT,
    "manualMatchNotes" TEXT,
    "lastMatchedAt" TIMESTAMP(3),
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "firstPurchasedAt" TIMESTAMP(3),
    "lastPurchasedAt" TIMESTAMP(3),
    "estimatedMonthlyUnits" DOUBLE PRECISION DEFAULT 0,
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isMonitored" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Price" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "retailer" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "url" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Alert" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "retailer" TEXT NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "oldPrice" DOUBLE PRECISION NOT NULL,
    "priceDropAmount" DOUBLE PRECISION NOT NULL,
    "url" TEXT,
    "savingsPerOrder" DOUBLE PRECISION NOT NULL,
    "estimatedMonthlySavings" DOUBLE PRECISION NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "alertDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateTriggered" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "SavingsSummary" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthlyTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearToDate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingsSummary_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Invite" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "PriceHistory" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "retailer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

/* Indexes (ignore errors if already exist) */
CREATE UNIQUE INDEX IF NOT EXISTS "Company_realmId_key" ON "Company"("realmId");
CREATE INDEX IF NOT EXISTS "Company_realmId_idx" ON "Company"("realmId");
CREATE INDEX IF NOT EXISTS "Company_stripeCustomerId_idx" ON "Company"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_companyId_idx" ON "User"("companyId");
CREATE INDEX IF NOT EXISTS "Item_userId_idx" ON "Item"("userId");
CREATE INDEX IF NOT EXISTS "Price_itemId_idx" ON "Price"("itemId");
CREATE INDEX IF NOT EXISTS "Price_retailer_idx" ON "Price"("retailer");
CREATE INDEX IF NOT EXISTS "Price_date_idx" ON "Price"("date");
CREATE INDEX IF NOT EXISTS "Alert_itemId_idx" ON "Alert"("itemId");
CREATE INDEX IF NOT EXISTS "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX IF NOT EXISTS "Alert_alertDate_idx" ON "Alert"("alertDate");
CREATE INDEX IF NOT EXISTS "Alert_seen_idx" ON "Alert"("seen");
CREATE INDEX IF NOT EXISTS "SavingsSummary_userId_idx" ON "SavingsSummary"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invite_token_key" ON "Invite"("token");
CREATE INDEX IF NOT EXISTS "Invite_token_idx" ON "Invite"("token");
CREATE INDEX IF NOT EXISTS "Invite_expiresAt_idx" ON "Invite"("expiresAt");
CREATE INDEX IF NOT EXISTS "Invite_companyId_idx" ON "Invite"("companyId");
CREATE INDEX IF NOT EXISTS "PriceHistory_itemId_idx" ON "PriceHistory"("itemId");
CREATE INDEX IF NOT EXISTS "PriceHistory_createdAt_idx" ON "PriceHistory"("createdAt");

/* Foreign keys (only add if not present) */
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Price" ADD CONSTRAINT "Price_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Alert" ADD CONSTRAINT "Alert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SavingsSummary" ADD CONSTRAINT "SavingsSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Invite" ADD CONSTRAINT "Invite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* Mark Prisma migration as applied (safe to run every time) */
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "_prisma_migrations" (
  "id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count"
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '3df70847f82dad04bacda99bfb8643f79eed75bbd57a923af1f5488ca1966f08',
  now(),
  '20260206150037_init',
  NULL,
  NULL,
  now(),
  1
) ON CONFLICT (id) DO NOTHING;
