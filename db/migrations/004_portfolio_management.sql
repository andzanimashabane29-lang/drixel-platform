-- Portfolio writes are available to the management API only. HTTP routes still
-- require an authenticated group administrator and write audit records.
GRANT INSERT, UPDATE ON drixel.organizations, drixel.applications TO drixel_management_api;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['organizations', 'applications'] LOOP
    EXECUTE format('ALTER TABLE drixel.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE drixel.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS management_api_access ON drixel.%I', table_name);
    EXECUTE format(
      'CREATE POLICY management_api_access ON drixel.%I FOR ALL TO drixel_management_api USING (true) WITH CHECK (true)',
      table_name
    );
  END LOOP;
END
$$;
