INSERT INTO drixel.organizations (kind, slug, display_name)
VALUES ('group', 'drixel-labs', 'Drixel Labs Inc')
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
SELECT id, 'business_unit', 'drixel-sa', 'Drixel SA'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, parent_organization_id = EXCLUDED.parent_organization_id;

INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
SELECT id, 'business_unit', 'excel-tutoring-academy-sa', 'Excel Tutoring Academy SA'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, parent_organization_id = EXCLUDED.parent_organization_id;

INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
SELECT id, 'business_unit', 'drixelone', 'DrixelOne'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, parent_organization_id = EXCLUDED.parent_organization_id;

INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
SELECT id, 'business_unit', 'drixel-digital-products', 'Drixel Digital Products'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, parent_organization_id = EXCLUDED.parent_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'drixel-id', 'Drixel ID'
FROM drixel.organizations WHERE slug = 'drixel-labs'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'drixel-sa-store', 'Drixel SA Store'
FROM drixel.organizations WHERE slug = 'drixel-sa'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'excel-tutoring-academy', 'Excel Tutoring Academy Learning Platform'
FROM drixel.organizations WHERE slug = 'excel-tutoring-academy-sa'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'a-chatz', 'A-Chatz'
FROM drixel.organizations WHERE slug = 'drixel-digital-products'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, owner_organization_id = EXCLUDED.owner_organization_id;

INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
SELECT id, 'skrpture', 'SkrpTure'
FROM drixel.organizations WHERE slug = 'drixel-digital-products'
ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, owner_organization_id = EXCLUDED.owner_organization_id;
