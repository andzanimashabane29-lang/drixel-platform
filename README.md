# Drixel Platform foundation

This repository starts the shared organization and account directory for Drixel Labs Inc. It provides a PostgreSQL foundation for the group, business units, services, global accounts, scoped memberships, role assignments, consent records, and audit events.

## Initial portfolio

- Drixel Labs Inc — group parent
- Drixel SA — fashion and ecommerce business
- Excel Tutoring Academy SA — education business
- DrixelOne — technology business
- Drixel Digital Products — A-Chatz and SkrpTure
- Drixel ID — group-wide identity service

These are modeled as operating units and services. The database does not assert that each is a separate registered company.

## Start the local database

1. Copy `.env.example` to `.env` and set a local password.
2. From this folder, run `docker compose up -d`.
3. The first database start runs `db/migrations/001_initial.sql` and `db/seed/001_portfolio.sql` automatically.

The compose setup requires Docker Desktop or Docker Engine with the Compose plugin. The password in `.env` is for local development only.

## Start the admin console

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.

The console uses a restrained white, charcoal, and gray interface. It contains overview, business, service, account, access-role, audit, and settings pages, with no gradients or decorative artwork. The business and service pages currently show the same initial portfolio listed in the SQL seed. Account, audit, and configuration actions stay unavailable until the OIDC identity provider and management API are connected; the interface does not invent account data.

## Account and data model

- `accounts` represents one Drixel person identity.
- `account_identities` links the account to an identity provider's stable OIDC issuer and subject. Passwords and authentication secrets are deliberately not stored in this database.
- `account_emails` stores verified contact addresses separately from identity-provider credentials.
- `organizations` represents the group, business units, subsidiaries, and customer organizations.
- `applications` records each product or service and its owning organization.
- `organization_memberships` distinguishes employees, customers, contractors, and partners, with an independent lifecycle for each business.
- `application_memberships` records access to a service; `role_assignments` scopes permissions to the group, a business, a service, or customer workspace.
- `consents` and `audit_events` capture user choices and high-value administrative actions.

The migration enables PostgreSQL row-level security on account and organization tables with no public policies. Application services must authenticate through an identity provider, check scoped membership and roles, and use a restricted database role. Do not connect end-user clients directly to the database or use the migration owner as the runtime account.

## Next implementation step

Connect an OIDC identity provider (Drixel ID) and add a backend API that validates tokens and authorizes every request against organization memberships and scoped role assignments. The console is prepared as the operator surface but is not yet connected to that API. Then integrate one service at a time, starting with the service selected by Drixel. Existing users should be linked by verified identity, not merged solely by matching email text.

See [Drixel_Group_and_Account_Architecture.md](Drixel_Group_and_Account_Architecture.md) for the operating model and rollout decisions.
