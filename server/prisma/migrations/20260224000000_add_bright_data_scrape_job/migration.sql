-- CreateTable
CREATE TABLE "BrightDataScrapeJob" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "BrightDataScrapeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrightDataScrapeJob_snapshotId_key" ON "BrightDataScrapeJob"("snapshotId");

-- CreateIndex
CREATE INDEX "BrightDataScrapeJob_companyId_status_idx" ON "BrightDataScrapeJob"("companyId", "status");

-- CreateIndex
CREATE INDEX "BrightDataScrapeJob_itemId_status_idx" ON "BrightDataScrapeJob"("itemId", "status");
