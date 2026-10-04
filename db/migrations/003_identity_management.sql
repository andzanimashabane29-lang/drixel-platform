-- The identity API is the only login allowed to administer account data.
-- Every write still requires an OIDC-authenticated and scope-authorized API request.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'drixel_management_api') THEN
    CREATE ROLE drixel_management_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;
ALTER ROLE drixel_management_api NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE TABLE IF NOT EXISTS drixel.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES drixel.organizations(id) ON DELETE CASCADE,
  application_id uuid REFERENCES drixel.applications(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES drixel.roles(id) ON DELETE RESTRICT,
  membership_kind drixel.membership_kind NOT NULL,
  invited_by uuid REFERENCES drixel.accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  CHECK (organization_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS drixel.bootstrap_state (
  key text PRIMARY KEY,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitation_pending_idx
  ON drixel.invitations (lower(token_hash), expires_at) WHERE accepted_at IS NULL;

GRANT USAGE ON SCHEMA drixel TO drixel_management_api;
GRANT SELECT ON drixel.organizations, drixel.applications, drixel.roles TO drixel_management_api;
GRANT SELECT, INSERT, UPDATE ON drixel.accounts, drixel.account_identities, drixel.account_emails,
  drixel.organization_memberships, drixel.application_memberships, drixel.role_assignments,
  drixel.audit_events, drixel.invitations TO drixel_management_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA drixel TO drixel_management_api;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations', 'applications', 'accounts', 'account_identities', 'account_emails',
    'organization_memberships', 'application_memberships', 'roles', 'role_assignments',
    'audit_events', 'invitations'
  ] LOOP
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
