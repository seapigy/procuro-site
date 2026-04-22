/*
  Warnings:

  - Added the required column `priceDropAmount` to the `Alert` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Item" ADD COLUMN "lastCheckedPrice" REAL;
ALTER TABLE "Item" ADD COLUMN "sku" TEXT;
ALTER TABLE "Item" ADD COLUMN "vendorName" TEXT;

-- AlterTable
ALTER TABLE "Price" ADD COLUMN "url" TEXT;

-- CreateTable
CREATE TABLE "SavingsSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "monthlyTotal" REAL NOT NULL DEFAULT 0,
    "yearToDate" REAL NOT NULL DEFAULT 0,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingsSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "priceDropAmount" REAL NOT NULL,
    "url" TEXT,
    "savingsPerOrder" REAL NOT NULL,
    "estimatedMonthlySavings" REAL NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "alertDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateTriggered" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Alert" ("alertDate", "estimatedMonthlySavings", "id", "itemId", "newPrice", "oldPrice", "retailer", "savingsPerOrder", "seen", "url", "userId") SELECT "alertDate", "estimatedMonthlySavings", "id", "itemId", "newPrice", "oldPrice", "retailer", "savingsPerOrder", "seen", "url", "userId" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE INDEX "Alert_itemId_idx" ON "Alert"("itemId");
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX "Alert_alertDate_idx" ON "Alert"("alertDate");
CREATE INDEX "Alert_seen_idx" ON "Alert"("seen");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "quickbooksId" TEXT,
    "quickbooksAccessToken" TEXT,
    "quickbooksRefreshToken" TEXT,
    "quickbooksRealmId" TEXT,
    "quickbooksConnectedAt" DATETIME,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "quickbooksAccessToken", "quickbooksConnectedAt", "quickbooksRealmId", "quickbooksRefreshToken", "updatedAt") SELECT "createdAt", "email", "id", "name", "quickbooksAccessToken", "quickbooksConnectedAt", "quickbooksRealmId", "quickbooksRefreshToken", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SavingsSummary_userId_idx" ON "SavingsSummary"("userId");
