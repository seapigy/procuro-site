-- CreateTable
CREATE TABLE "BrightDataRawSample" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputUrl" TEXT,
    "rowsJson" JSONB,
    "statusCode" INTEGER,
    "notes" TEXT,

    CONSTRAINT "BrightDataRawSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrightDataRawSample_provider_itemId_idx" ON "BrightDataRawSample"("provider", "itemId");

-- CreateIndex
CREATE INDEX "BrightDataRawSample_companyId_idx" ON "BrightDataRawSample"("companyId");
