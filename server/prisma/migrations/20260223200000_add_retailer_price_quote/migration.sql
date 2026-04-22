-- CreateTable
CREATE TABLE "RetailerPriceQuote" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "retailer" TEXT NOT NULL,
    "url" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" JSONB,

    CONSTRAINT "RetailerPriceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetailerPriceQuote_companyId_itemId_capturedAt_idx" ON "RetailerPriceQuote"("companyId", "itemId", "capturedAt");

-- CreateIndex
CREATE INDEX "RetailerPriceQuote_companyId_capturedAt_idx" ON "RetailerPriceQuote"("companyId", "capturedAt");

-- AddForeignKey
ALTER TABLE "RetailerPriceQuote" ADD CONSTRAINT "RetailerPriceQuote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerPriceQuote" ADD CONSTRAINT "RetailerPriceQuote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
