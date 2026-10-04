-- Optional one-time bootstrap for the first Drixel group owner.
-- Values are injected by the local initialization script, never by the browser.
DO $$
DECLARE
  bootstrap_email text := lower(btrim(current_setting('drixel.bootstrap_email')));
  bootstrap_name text := btrim(current_setting('drixel.bootstrap_name'));
  bootstrap_issuer text := current_setting('drixel.bootstrap_issuer');
  bootstrap_subject text := current_setting('drixel.bootstrap_subject');
  bootstrap_account_id uuid;
  group_id uuid;
  owner_role_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drixel.bootstrap_state WHERE key = 'initial_group_owner') THEN
    RETURN;
  END IF;

  SELECT identity.account_id INTO bootstrap_account_id
  FROM drixel.account_identities AS identity
  WHERE identity.issuer = bootstrap_issuer AND identity.subject = bootstrap_subject;

  IF bootstrap_account_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM drixel.account_emails WHERE normalized_email = bootstrap_email) THEN
      RAISE EXCEPTION 'Bootstrap email already belongs to an account; verify and link its identity manually';
    END IF;

    INSERT INTO drixel.accounts (display_name) VALUES (bootstrap_name) RETURNING id INTO bootstrap_account_id;
    INSERT INTO drixel.account_emails (account_id, email, is_verified, is_primary)
      VALUES (bootstrap_account_id, bootstrap_email, true, true);
    INSERT INTO drixel.account_identities (account_id, issuer, subject)
      VALUES (bootstrap_account_id, bootstrap_issuer, bootstrap_subject);
  ELSIF NOT EXISTS (
    SELECT 1 FROM drixel.account_emails
    WHERE account_emails.account_id = bootstrap_account_id
      AND normalized_email = bootstrap_email AND is_verified
  ) THEN
    RAISE EXCEPTION 'Bootstrap identity is already linked to an account with a different or unverified email';
  END IF;

  SELECT id INTO group_id FROM drixel.organizations WHERE slug = 'drixel-labs';
  SELECT id INTO owner_role_id FROM drixel.roles WHERE scope = 'group' AND code = 'group_owner';
  IF group_id IS NULL OR owner_role_id IS NULL THEN
    RAISE EXCEPTION 'Drixel group or group_owner role is missing';
  END IF;

  INSERT INTO drixel.organization_memberships (organization_id, account_id, kind, status, joined_at)
    VALUES (group_id, bootstrap_account_id, 'employee', 'active', now())
    ON CONFLICT (organization_id, account_id) DO NOTHING;
  INSERT INTO drixel.role_assignments (account_id, role_id, scope, organization_id)
    VALUES (bootstrap_account_id, owner_role_id, 'group', group_id)
    ON CONFLICT DO NOTHING;
  INSERT INTO drixel.bootstrap_state (key) VALUES ('initial_group_owner');
END
$$;
