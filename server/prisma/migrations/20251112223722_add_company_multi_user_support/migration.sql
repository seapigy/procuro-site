-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "realmId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "companyId" INTEGER,
    "quickbooksId" TEXT,
    "quickbooksAccessToken" TEXT,
    "quickbooksRefreshToken" TEXT,
    "quickbooksRealmId" TEXT,
    "quickbooksConnectedAt" DATETIME,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "onboardingCompleted", "quickbooksAccessToken", "quickbooksConnectedAt", "quickbooksId", "quickbooksRealmId", "quickbooksRefreshToken", "updatedAt") SELECT "createdAt", "email", "id", "name", "onboardingCompleted", "quickbooksAccessToken", "quickbooksConnectedAt", "quickbooksId", "quickbooksRealmId", "quickbooksRefreshToken", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Company_realmId_key" ON "Company"("realmId");

-- CreateIndex
CREATE INDEX "Company_realmId_idx" ON "Company"("realmId");
