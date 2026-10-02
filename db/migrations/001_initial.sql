-- Drixel shared organization and account directory.
-- Authentication credentials are held by an OIDC identity provider, never here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS drixel;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'drixel_runtime') THEN
    CREATE ROLE drixel_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

CREATE TYPE drixel.organization_kind AS ENUM (
  'group',
  'business_unit',
  'subsidiary',
  'customer'
);

CREATE TYPE drixel.record_status AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE drixel.membership_kind AS ENUM ('employee', 'customer', 'contractor', 'partner');
CREATE TYPE drixel.membership_status AS ENUM ('invited', 'active', 'suspended', 'ended');
CREATE TYPE drixel.role_scope AS ENUM ('group', 'organization', 'application', 'customer_workspace');

CREATE TABLE drixel.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_organization_id uuid REFERENCES drixel.organizations(id) ON DELETE RESTRICT,
  kind drixel.organization_kind NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text NOT NULL,
  status drixel.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'group' AND parent_organization_id IS NULL)
      OR (kind <> 'group' AND parent_organization_id IS NOT NULL))
);

CREATE TABLE drixel.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_organization_id uuid NOT NULL REFERENCES drixel.organizations(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text NOT NULL,
  status drixel.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drixel.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  status drixel.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A login may have multiple identity-provider links, but each provider subject maps to one account.
CREATE TABLE drixel.account_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject),
  UNIQUE (account_id, issuer)
);

CREATE TABLE drixel.account_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  normalized_email text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  is_verified boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (normalized_email)
);

CREATE UNIQUE INDEX account_one_primary_email
  ON drixel.account_emails(account_id) WHERE is_primary;

CREATE TABLE drixel.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES drixel.organizations(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  kind drixel.membership_kind NOT NULL,
  status drixel.membership_status NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES drixel.accounts(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  ended_at timestamptz,
  UNIQUE (organization_id, account_id),
  CHECK ((status = 'active' AND joined_at IS NOT NULL) OR status <> 'active')
);

CREATE TABLE drixel.application_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES drixel.applications(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  status drixel.membership_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, account_id)
);

CREATE TABLE drixel.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope drixel.role_scope NOT NULL,
  code text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  UNIQUE (scope, code),
  UNIQUE (id, scope)
);

CREATE TABLE drixel.role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  role_id uuid NOT NULL,
  scope drixel.role_scope NOT NULL,
  organization_id uuid REFERENCES drixel.organizations(id) ON DELETE CASCADE,
  application_id uuid REFERENCES drixel.applications(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES drixel.accounts(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CHECK (
    (scope IN ('group', 'organization', 'customer_workspace') AND organization_id IS NOT NULL AND application_id IS NULL)
    OR (scope = 'application' AND application_id IS NOT NULL AND organization_id IS NULL)
  ),
  FOREIGN KEY (role_id, scope) REFERENCES drixel.roles(id, scope) ON DELETE RESTRICT,
  UNIQUE NULLS NOT DISTINCT (account_id, role_id, scope, organization_id, application_id)
);

CREATE TABLE drixel.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES drixel.accounts(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES drixel.applications(id) ON DELETE RESTRICT,
  purpose_code text NOT NULL,
  notice_version text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (account_id, application_id, purpose_code, notice_version)
);

CREATE TABLE drixel.audit_events (
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

CREATE INDEX organization_parent_idx ON drixel.organizations(parent_organization_id);
CREATE INDEX org_membership_account_idx ON drixel.organization_memberships(account_id, status);
CREATE INDEX app_membership_account_idx ON drixel.application_memberships(account_id, status);
CREATE INDEX role_assignment_account_idx ON drixel.role_assignments(account_id);
CREATE INDEX audit_org_time_idx ON drixel.audit_events(organization_id, occurred_at DESC);
CREATE INDEX audit_app_time_idx ON drixel.audit_events(application_id, occurred_at DESC);

GRANT USAGE ON SCHEMA drixel TO drixel_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA drixel TO drixel_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA drixel TO drixel_runtime;

-- These tables are private by default. Add explicit policies before giving application
-- services direct database access. Keep the migration owner separate from runtime roles.
ALTER TABLE drixel.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.account_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.account_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.application_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE drixel.audit_events ENABLE ROW LEVEL SECURITY;
