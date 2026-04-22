-- CreateTable
CREATE TABLE "ItemRetailerMatch" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "retailer" TEXT NOT NULL,
    "retailerProductId" TEXT,
    "productUrl" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchConfidence" DOUBLE PRECISION,
    "matchTitle" TEXT,
    "matchBrand" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemRetailerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemRetailerMatch_itemId_retailer_key" ON "ItemRetailerMatch"("itemId", "retailer");

-- CreateIndex
CREATE INDEX "ItemRetailerMatch_itemId_retailer_idx" ON "ItemRetailerMatch"("itemId", "retailer");

-- CreateIndex
CREATE INDEX "ItemRetailerMatch_companyId_retailer_idx" ON "ItemRetailerMatch"("companyId", "retailer");

-- AddForeignKey
ALTER TABLE "ItemRetailerMatch" ADD CONSTRAINT "ItemRetailerMatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRetailerMatch" ADD CONSTRAINT "ItemRetailerMatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
