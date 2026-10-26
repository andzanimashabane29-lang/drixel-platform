DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='drixel' AND t.typname='membership_kind') THEN
    CREATE TYPE drixel.membership_kind AS ENUM ('employee','customer','contractor','partner');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='drixel' AND t.typname='membership_status') THEN
    CREATE TYPE drixel.membership_status AS ENUM ('invited','active','suspended','ended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='drixel' AND t.typname='role_scope') THEN
    CREATE TYPE drixel.role_scope AS ENUM ('group','organization','application','customer_workspace');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS drixel.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  status drixel.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drixel.account_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject),
  UNIQUE (account_id, issuer)
);

CREATE TABLE IF NOT EXISTS drixel.account_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  normalized_email text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  is_verified boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (normalized_email)
);
CREATE UNIQUE INDEX IF NOT EXISTS account_one_primary_email ON drixel.account_emails(account_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS drixel.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES drixel.organizations(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  kind drixel.membership_kind NOT NULL,
  status drixel.membership_status NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES drixel.accounts(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  ended_at timestamptz,
  UNIQUE (organization_id, account_id)
);

CREATE TABLE IF NOT EXISTS drixel.application_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES drixel.applications(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  status drixel.membership_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, account_id)
);

CREATE TABLE IF NOT EXISTS drixel.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope drixel.role_scope NOT NULL,
  code text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  UNIQUE (scope, code),
  UNIQUE (id, scope)
);

CREATE TABLE IF NOT EXISTS drixel.role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  role_id uuid NOT NULL,
  scope drixel.role_scope NOT NULL,
  organization_id uuid REFERENCES drixel.organizations(id) ON DELETE CASCADE,
  application_id uuid REFERENCES drixel.applications(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES drixel.accounts(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  FOREIGN KEY (role_id, scope) REFERENCES drixel.roles(id, scope) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS drixel.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_account_id uuid REFERENCES drixel.accounts(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES drixel.organizations(id) ON DELETE SET NULL,
  application_id uuid REFERENCES drixel.applications(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

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
  accepted_at timestamptz
);

ALTER TABLE drixel.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.account_identities DISABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.account_emails DISABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.organization_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.application_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.role_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.audit_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.invitations DISABLE ROW LEVEL SECURITY;

INSERT INTO drixel.roles (scope, code, display_name, description) VALUES
  ('group','group_owner','Group owner','Full group governance access'),
  ('group','group_admin','Group administrator','Manage group settings and portfolio'),
  ('organization','business_admin','Business administrator','Manage one business unit'),
  ('organization','manager','Manager','Manage assigned business operations'),
  ('organization','employee','Employee','Standard employee access for one business'),
  ('application','app_admin','Application administrator','Manage one application'),
  ('application','support_agent','Support agent','Support users of one application'),
  ('application','end_user','End user','Use the assigned application')
ON CONFLICT (scope, code) DO UPDATE SET display_name=EXCLUDED.display_name, description=EXCLUDED.description;
