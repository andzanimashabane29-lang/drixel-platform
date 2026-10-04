-- The browser console's portfolio API uses this role to read only the
-- non-customer organization and application directory. Account data is not
-- exposed through this connection.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'drixel_directory_reader') THEN
    CREATE ROLE drixel_directory_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA drixel TO drixel_directory_reader;
GRANT SELECT ON drixel.organizations, drixel.applications TO drixel_directory_reader;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'drixel' AND tablename = 'organizations' AND policyname = 'portfolio_directory_read'
  ) THEN
    CREATE POLICY portfolio_directory_read ON drixel.organizations
      FOR SELECT TO drixel_directory_reader
      USING (kind IN ('group', 'business_unit', 'subsidiary'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'drixel' AND tablename = 'applications' AND policyname = 'portfolio_applications_read'
  ) THEN
    CREATE POLICY portfolio_applications_read ON drixel.applications
      FOR SELECT TO drixel_directory_reader
      USING (
        EXISTS (
          SELECT 1 FROM drixel.organizations AS owner
          WHERE owner.id = owner_organization_id
            AND owner.kind IN ('group', 'business_unit', 'subsidiary')
        )
      );
  END IF;
END
$$;

ALTER TABLE drixel.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE drixel.applications FORCE ROW LEVEL SECURITY;
