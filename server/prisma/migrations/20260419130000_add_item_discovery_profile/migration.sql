-- CreateTable
CREATE TABLE "ItemDiscoveryProfile" (
    "key" VARCHAR(64) NOT NULL,
    "hdWinCount" INTEGER NOT NULL DEFAULT 0,
    "amazonWinCount" INTEGER NOT NULL DEFAULT 0,
    "homeDepotSearchHint" TEXT,
    "amazonSearchHint" TEXT,
    "lastReinforcedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemDiscoveryProfile_pkey" PRIMARY KEY ("key")
);
