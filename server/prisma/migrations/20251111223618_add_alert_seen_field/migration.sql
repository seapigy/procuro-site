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
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "alertDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Alert" ("alertDate", "estimatedMonthlySavings", "id", "itemId", "newPrice", "oldPrice", "retailer", "savingsPerOrder", "url", "userId") SELECT "alertDate", "estimatedMonthlySavings", "id", "itemId", "newPrice", "oldPrice", "retailer", "savingsPerOrder", "url", "userId" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE INDEX "Alert_itemId_idx" ON "Alert"("itemId");
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX "Alert_alertDate_idx" ON "Alert"("alertDate");
CREATE INDEX "Alert_seen_idx" ON "Alert"("seen");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
