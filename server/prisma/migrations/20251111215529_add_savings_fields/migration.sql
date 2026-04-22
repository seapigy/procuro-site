/*
  Warnings:

  - Added the required column `estimatedMonthlySavings` to the `Alert` table without a default value. This is not possible if the table is not empty.
  - Added the required column `savingsPerOrder` to the `Alert` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "retailer" TEXT NOT NULL,
    "newPrice" REAL NOT NULL,
    "oldPrice" REAL NOT NULL,
    "url" TEXT,
    "savingsPerOrder" REAL NOT NULL,
    "estimatedMonthlySavings" REAL NOT NULL,
    "alertDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Alert" ("alertDate", "id", "itemId", "newPrice", "oldPrice", "retailer", "url", "userId") SELECT "alertDate", "id", "itemId", "newPrice", "oldPrice", "retailer", "url", "userId" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE INDEX "Alert_itemId_idx" ON "Alert"("itemId");
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX "Alert_alertDate_idx" ON "Alert"("alertDate");
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "lastPaidPrice" REAL NOT NULL,
    "quantityPerOrder" INTEGER NOT NULL DEFAULT 1,
    "reorderIntervalDays" INTEGER NOT NULL DEFAULT 30,
    "upc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("category", "createdAt", "id", "lastPaidPrice", "name", "upc", "updatedAt", "userId") SELECT "category", "createdAt", "id", "lastPaidPrice", "name", "upc", "updatedAt", "userId" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
