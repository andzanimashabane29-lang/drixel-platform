CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS drixel;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'drixel' AND t.typname = 'organization_kind'
  ) THEN
    CREATE TYPE drixel.organization_kind AS ENUM ('group', 'business_unit', 'subsidiary', 'customer');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'drixel' AND t.typname = 'record_status'
  ) THEN
    CREATE TYPE drixel.record_status AS ENUM ('active', 'suspended', 'closed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS drixel.organizations (
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

CREATE TABLE IF NOT EXISTS drixel.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_organization_id uuid NOT NULL REFERENCES drixel.organizations(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text NOT NULL,
  status drixel.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_parent_idx ON drixel.organizations(parent_organization_id);
