/*
  Warnings:

  - You are about to drop the column `price` on the `Alert` table. All the data in the column will be lost.
  - Added the required column `newPrice` to the `Alert` table without a default value. This is not possible if the table is not empty.
  - Added the required column `oldPrice` to the `Alert` table without a default value. This is not possible if the table is not empty.

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
    "alertDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Alert" ("alertDate", "id", "itemId", "retailer", "userId") SELECT "alertDate", "id", "itemId", "retailer", "userId" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE INDEX "Alert_itemId_idx" ON "Alert"("itemId");
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX "Alert_alertDate_idx" ON "Alert"("alertDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
