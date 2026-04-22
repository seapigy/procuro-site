-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "realmId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "isQuickBooksConnected" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Company" ("createdAt", "id", "isSubscribed", "name", "realmId", "stripeCustomerId", "stripeSubscriptionId") SELECT "createdAt", "id", "isSubscribed", "name", "realmId", "stripeCustomerId", "stripeSubscriptionId" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_realmId_key" ON "Company"("realmId");
CREATE INDEX "Company_realmId_idx" ON "Company"("realmId");
CREATE INDEX "Company_stripeCustomerId_idx" ON "Company"("stripeCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
