-- Drixel Labs group and initial businesses/services.
INSERT INTO drixel.organizations (kind, slug, display_name)
VALUES ('group', 'drixel-labs', 'Drixel Labs Inc')
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
SELECT id, 'business_unit', 'drixel-sa', 'Drixel SA'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  parent_organization_id = EXCLUDED.parent_organization_id;

INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
SELECT id, 'business_unit', 'excel-tutoring-academy-sa', 'Excel Tutoring Academy SA'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  parent_organization_id = EXCLUDED.parent_organization_id;

INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
SELECT id, 'business_unit', 'drixelone', 'DrixelOne'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  parent_organization_id = EXCLUDED.parent_organization_id;

INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
SELECT id, 'business_unit', 'drixel-digital-products', 'Drixel Digital Products'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  parent_organization_id = EXCLUDED.parent_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'drixel-id', 'Drixel ID'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'drixel-sa-store', 'Drixel SA Store'
FROM drixel.organizations WHERE slug = 'drixel-sa'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'excel-tutoring-academy', 'Excel Tutoring Academy Learning Platform'
FROM drixel.organizations WHERE slug = 'excel-tutoring-academy-sa'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'a-chatz', 'A-Chatz'
FROM drixel.organizations WHERE slug = 'drixel-digital-products'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'skrpture', 'SkrpTure'
FROM drixel.organizations WHERE slug = 'drixel-digital-products'
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.roles (scope, code, display_name, description) VALUES
  ('group', 'group_owner', 'Group owner', 'Full group governance access'),
  ('group', 'group_admin', 'Group administrator', 'Manage group settings and portfolio'),
  ('organization', 'business_admin', 'Business administrator', 'Manage one business unit'),
  ('organization', 'manager', 'Manager', 'Manage assigned business operations'),
  ('organization', 'employee', 'Employee', 'Standard employee access for one business'),
  ('application', 'app_admin', 'Application administrator', 'Manage one application'),
  ('application', 'support_agent', 'Support agent', 'Support users of one application'),
  ('application', 'end_user', 'End user', 'Use the assigned application'),
  ('customer_workspace', 'workspace_owner', 'Workspace owner', 'Manage one customer workspace'),
  ('customer_workspace', 'workspace_member', 'Workspace member', 'Use one customer workspace')
ON CONFLICT (scope, code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;
