-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "lastPaidPrice" REAL NOT NULL,
    "lastCheckedPrice" REAL,
    "quantityPerOrder" INTEGER NOT NULL DEFAULT 1,
    "reorderIntervalDays" INTEGER NOT NULL DEFAULT 30,
    "vendorName" TEXT,
    "upc" TEXT,
    "matchedRetailer" TEXT,
    "matchedUrl" TEXT,
    "matchedPrice" REAL,
    "matchConfidence" REAL,
    "isVagueName" BOOLEAN NOT NULL DEFAULT false,
    "needsClarification" BOOLEAN NOT NULL DEFAULT false,
    "normalizedName" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchProvider" TEXT,
    "matchUrl" TEXT,
    "matchTitle" TEXT,
    "matchPrice" REAL,
    "matchReasons" JSONB,
    "isManuallyMatched" BOOLEAN NOT NULL DEFAULT false,
    "manualMatchProvider" TEXT,
    "manualMatchUrl" TEXT,
    "manualMatchTitle" TEXT,
    "manualMatchNotes" TEXT,
    "lastMatchedAt" DATETIME,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "firstPurchasedAt" DATETIME,
    "lastPurchasedAt" DATETIME,
    "estimatedMonthlyUnits" REAL DEFAULT 0,
    "priorityScore" REAL NOT NULL DEFAULT 0,
    "isMonitored" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("category", "createdAt", "estimatedMonthlyUnits", "firstPurchasedAt", "id", "isMonitored", "isPaused", "isVagueName", "lastCheckedPrice", "lastPaidPrice", "lastPurchasedAt", "matchConfidence", "matchedPrice", "matchedRetailer", "matchedUrl", "name", "needsClarification", "priorityScore", "purchaseCount", "quantityPerOrder", "reorderIntervalDays", "sku", "upc", "updatedAt", "userId", "vendorName") SELECT "category", "createdAt", "estimatedMonthlyUnits", "firstPurchasedAt", "id", "isMonitored", "isPaused", "isVagueName", "lastCheckedPrice", "lastPaidPrice", "lastPurchasedAt", "matchConfidence", "matchedPrice", "matchedRetailer", "matchedUrl", "name", "needsClarification", "priorityScore", "purchaseCount", "quantityPerOrder", "reorderIntervalDays", "sku", "upc", "updatedAt", "userId", "vendorName" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
