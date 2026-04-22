/* Disable RLS when using Supabase SESSION POOLER.
 * Session variables (set_config) do not persist across pooler connections,
 * so RLS cannot enforce tenant isolation. Use this so the app works with the pooler.
 * Tenant isolation is still enforced in application code (withCompany + where: { companyId }).
 * Run in Supabase SQL Editor once. */

ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Item" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Price" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Alert" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SavingsSummary" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Invite" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceHistory" DISABLE ROW LEVEL SECURITY;

/* Drop policies so they don't apply if you re-enable RLS later */
DROP POLICY IF EXISTS "User_select_tenant" ON "User";
DROP POLICY IF EXISTS "User_insert_tenant" ON "User";
DROP POLICY IF EXISTS "User_update_tenant" ON "User";
DROP POLICY IF EXISTS "User_delete_tenant" ON "User";
DROP POLICY IF EXISTS "Item_select_tenant" ON "Item";
DROP POLICY IF EXISTS "Item_insert_tenant" ON "Item";
DROP POLICY IF EXISTS "Item_update_tenant" ON "Item";
DROP POLICY IF EXISTS "Item_delete_tenant" ON "Item";
DROP POLICY IF EXISTS "Price_select_tenant" ON "Price";
DROP POLICY IF EXISTS "Price_insert_tenant" ON "Price";
DROP POLICY IF EXISTS "Price_update_tenant" ON "Price";
DROP POLICY IF EXISTS "Price_delete_tenant" ON "Price";
DROP POLICY IF EXISTS "Alert_select_tenant" ON "Alert";
DROP POLICY IF EXISTS "Alert_insert_tenant" ON "Alert";
DROP POLICY IF EXISTS "Alert_update_tenant" ON "Alert";
DROP POLICY IF EXISTS "Alert_delete_tenant" ON "Alert";
DROP POLICY IF EXISTS "SavingsSummary_select_tenant" ON "SavingsSummary";
DROP POLICY IF EXISTS "SavingsSummary_insert_tenant" ON "SavingsSummary";
DROP POLICY IF EXISTS "SavingsSummary_update_tenant" ON "SavingsSummary";
DROP POLICY IF EXISTS "SavingsSummary_delete_tenant" ON "SavingsSummary";
DROP POLICY IF EXISTS "Invite_select_tenant" ON "Invite";
DROP POLICY IF EXISTS "Invite_insert_tenant" ON "Invite";
DROP POLICY IF EXISTS "Invite_update_tenant" ON "Invite";
DROP POLICY IF EXISTS "Invite_delete_tenant" ON "Invite";
DROP POLICY IF EXISTS "PriceHistory_select_tenant" ON "PriceHistory";
DROP POLICY IF EXISTS "PriceHistory_insert_tenant" ON "PriceHistory";
DROP POLICY IF EXISTS "PriceHistory_update_tenant" ON "PriceHistory";
DROP POLICY IF EXISTS "PriceHistory_delete_tenant" ON "PriceHistory";
