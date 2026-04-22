-- Remove Walmart retailer matches and legacy Item Walmart columns.
DELETE FROM "ItemRetailerMatch" WHERE retailer = 'Walmart';

ALTER TABLE "Item" DROP COLUMN IF EXISTS "walmartProductId";
ALTER TABLE "Item" DROP COLUMN IF EXISTS "walmartProductUrl";
ALTER TABLE "Item" DROP COLUMN IF EXISTS "walmartMatchedAt";
