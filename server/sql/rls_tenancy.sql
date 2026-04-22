/* Row Level Security (RLS) for multi-tenant isolation.
 * Run once: npm run db:rls (or apply this file in Supabase SQL Editor).
 * Requires: app.company_id set per request via set_config('app.company_id', companyId::text, true).
 * Tenancy key: Company.id (integer).
 * IMPORTANT: Session variables (set_config) require the DIRECT connection, not the pooler.
 * In Supabase use: host db.xxx.supabase.co port 5432 (Direct), not pooler.supabase.com. */

/* 1. Helper: current company id from session (integer) */
CREATE SCHEMA IF NOT EXISTS app;
CREATE OR REPLACE FUNCTION app.current_company_id() RETURNS integer AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')::integer;
$$ LANGUAGE sql STABLE;

/* 2. Enable RLS on tenant tables (do not enable on Company so login/connect can resolve company) */
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Price" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Alert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavingsSummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceHistory" ENABLE ROW LEVEL SECURITY;

/* 3. User: tenant by "companyId". Allow companyId IS NULL when app.company_id is not set (e.g. callback). */
DROP POLICY IF EXISTS "User_select_tenant" ON "User";
CREATE POLICY "User_select_tenant" ON "User" FOR SELECT USING (
  ("companyId" = app.current_company_id()) OR ("companyId" IS NULL AND app.current_company_id() IS NULL)
);
DROP POLICY IF EXISTS "User_insert_tenant" ON "User";
CREATE POLICY "User_insert_tenant" ON "User" FOR INSERT WITH CHECK (
  ("companyId" = app.current_company_id()) OR ("companyId" IS NULL AND app.current_company_id() IS NULL)
);
DROP POLICY IF EXISTS "User_update_tenant" ON "User";
CREATE POLICY "User_update_tenant" ON "User" FOR UPDATE USING (
  ("companyId" = app.current_company_id()) OR ("companyId" IS NULL AND app.current_company_id() IS NULL)
) WITH CHECK (
  ("companyId" = app.current_company_id()) OR ("companyId" IS NULL AND app.current_company_id() IS NULL)
);
DROP POLICY IF EXISTS "User_delete_tenant" ON "User";
CREATE POLICY "User_delete_tenant" ON "User" FOR DELETE USING (
  ("companyId" = app.current_company_id()) OR ("companyId" IS NULL AND app.current_company_id() IS NULL)
);

/* 4. Item */
DROP POLICY IF EXISTS "Item_select_tenant" ON "Item";
CREATE POLICY "Item_select_tenant" ON "Item" FOR SELECT USING ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Item_insert_tenant" ON "Item";
CREATE POLICY "Item_insert_tenant" ON "Item" FOR INSERT WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Item_update_tenant" ON "Item";
CREATE POLICY "Item_update_tenant" ON "Item" FOR UPDATE USING ("companyId" = app.current_company_id()) WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Item_delete_tenant" ON "Item";
CREATE POLICY "Item_delete_tenant" ON "Item" FOR DELETE USING ("companyId" = app.current_company_id());

/* 5. Price */
DROP POLICY IF EXISTS "Price_select_tenant" ON "Price";
CREATE POLICY "Price_select_tenant" ON "Price" FOR SELECT USING ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Price_insert_tenant" ON "Price";
CREATE POLICY "Price_insert_tenant" ON "Price" FOR INSERT WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Price_update_tenant" ON "Price";
CREATE POLICY "Price_update_tenant" ON "Price" FOR UPDATE USING ("companyId" = app.current_company_id()) WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Price_delete_tenant" ON "Price";
CREATE POLICY "Price_delete_tenant" ON "Price" FOR DELETE USING ("companyId" = app.current_company_id());

/* 6. Alert */
DROP POLICY IF EXISTS "Alert_select_tenant" ON "Alert";
CREATE POLICY "Alert_select_tenant" ON "Alert" FOR SELECT USING ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Alert_insert_tenant" ON "Alert";
CREATE POLICY "Alert_insert_tenant" ON "Alert" FOR INSERT WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Alert_update_tenant" ON "Alert";
CREATE POLICY "Alert_update_tenant" ON "Alert" FOR UPDATE USING ("companyId" = app.current_company_id()) WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Alert_delete_tenant" ON "Alert";
CREATE POLICY "Alert_delete_tenant" ON "Alert" FOR DELETE USING ("companyId" = app.current_company_id());

/* 7. SavingsSummary */
DROP POLICY IF EXISTS "SavingsSummary_select_tenant" ON "SavingsSummary";
CREATE POLICY "SavingsSummary_select_tenant" ON "SavingsSummary" FOR SELECT USING ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "SavingsSummary_insert_tenant" ON "SavingsSummary";
CREATE POLICY "SavingsSummary_insert_tenant" ON "SavingsSummary" FOR INSERT WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "SavingsSummary_update_tenant" ON "SavingsSummary";
CREATE POLICY "SavingsSummary_update_tenant" ON "SavingsSummary" FOR UPDATE USING ("companyId" = app.current_company_id()) WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "SavingsSummary_delete_tenant" ON "SavingsSummary";
CREATE POLICY "SavingsSummary_delete_tenant" ON "SavingsSummary" FOR DELETE USING ("companyId" = app.current_company_id());

/* 8. Invite */
DROP POLICY IF EXISTS "Invite_select_tenant" ON "Invite";
CREATE POLICY "Invite_select_tenant" ON "Invite" FOR SELECT USING ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Invite_insert_tenant" ON "Invite";
CREATE POLICY "Invite_insert_tenant" ON "Invite" FOR INSERT WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Invite_update_tenant" ON "Invite";
CREATE POLICY "Invite_update_tenant" ON "Invite" FOR UPDATE USING ("companyId" = app.current_company_id()) WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "Invite_delete_tenant" ON "Invite";
CREATE POLICY "Invite_delete_tenant" ON "Invite" FOR DELETE USING ("companyId" = app.current_company_id());

/* 9. PriceHistory */
DROP POLICY IF EXISTS "PriceHistory_select_tenant" ON "PriceHistory";
CREATE POLICY "PriceHistory_select_tenant" ON "PriceHistory" FOR SELECT USING ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "PriceHistory_insert_tenant" ON "PriceHistory";
CREATE POLICY "PriceHistory_insert_tenant" ON "PriceHistory" FOR INSERT WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "PriceHistory_update_tenant" ON "PriceHistory";
CREATE POLICY "PriceHistory_update_tenant" ON "PriceHistory" FOR UPDATE USING ("companyId" = app.current_company_id()) WITH CHECK ("companyId" = app.current_company_id());
DROP POLICY IF EXISTS "PriceHistory_delete_tenant" ON "PriceHistory";
CREATE POLICY "PriceHistory_delete_tenant" ON "PriceHistory" FOR DELETE USING ("companyId" = app.current_company_id());
