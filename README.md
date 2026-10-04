# Drixel Platform foundation

This repository starts the shared organization and account directory for Drixel Labs Inc. It provides a PostgreSQL foundation for the group, business units, services, global accounts, scoped memberships, role assignments, consent records, and audit events. The admin console now reads the business and service register from PostgreSQL through a small read-only API.

## Initial portfolio

- Drixel Labs Inc — group parent
- Drixel SA — fashion and ecommerce business
- Excel Tutoring Academy SA — education business
- DrixelOne — technology business
- Drixel Digital Products — A-Chatz and SkrpTure
- Drixel ID — group-wide identity service

These are modeled as operating units and services. The database does not assert that each is a separate registered company.

## Start the local database

1. Copy `.env.example` to `.env` and set separate local passwords for PostgreSQL administration and the directory reader.
2. From this folder, run `docker compose up --build -d`.
3. On a new database volume, PostgreSQL runs `db/migrations/001_initial.sql` and `db/seed/001_portfolio.sql`. The `directory_init` service applies the repeatable read-role policy and password setup, including when an existing database volume is reused.
4. The API is available on port 3000. `GET /api/health` checks database connectivity; `GET /api/portfolio` returns business and service records only.

The compose setup requires Docker Desktop or Docker Engine with the Compose plugin. Both passwords in `.env` are for local development only. Do not use these credentials for a shared or production deployment.

## Start the admin console

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Start the API and database with `docker compose up --build -d`.
4. Run `npm run dev` and open the local URL printed by Vite. Vite forwards `/api` requests to the API on port 3000.

The console uses a restrained white, charcoal, and gray interface. Each screen has its own direct URL: `/overview`, `/businesses`, `/services`, `/accounts`, `/access-roles`, `/audit-log`, and `/settings`. Individual directory records have shareable detail routes at `/businesses/:slug` and `/services/:slug`; related business and service links connect those records. Navigation supports direct links, browser back/forward, and mobile navigation. Business and service pages use live directory responses, sortable columns, status filters, service owner filters, pagination, and CSV export of all matching loaded records. When the API is unavailable, the interface reports that state rather than showing hard-coded records. The current API is read-only, so business/service editing, account invitations, audit events, and identity-provider configuration require Drixel ID and an authenticated management API. The interface does not simulate those operations.

## API and database security

- The portfolio API uses the dedicated `drixel_directory_reader` PostgreSQL role. It can only select group, business-unit, subsidiary, and their service records.
- Row-level security hides customer organizations and their applications from this API role. Account, membership, role-assignment, consent, and audit tables are not granted to it.
- The API accepts `GET` requests only. It does not create or change directory or account records.
- Set both passwords in `.env`; the API receives only the directory-reader password. Never put credentials in frontend code.
- The console must be served behind the same-origin `/api` route in a deployment. The Vite proxy in this repository is for local development only.

Run `npm run test:api` for API route and failure-mode tests, and `npm run build` for the frontend TypeScript and production build.

## Account and data model

- `accounts` represents one Drixel person identity.
- `account_identities` links the account to an identity provider's stable OIDC issuer and subject. Passwords and authentication secrets are deliberately not stored in this database.
- `account_emails` stores verified contact addresses separately from identity-provider credentials.
- `organizations` represents the group, business units, subsidiaries, and customer organizations.
- `applications` records each product or service and its owning organization.
- `organization_memberships` distinguishes employees, customers, contractors, and partners, with an independent lifecycle for each business.
- `application_memberships` records access to a service; `role_assignments` scopes permissions to the group, a business, a service, or customer workspace.
- `consents` and `audit_events` capture user choices and high-value administrative actions.

The migration enables PostgreSQL row-level security on the account and organization tables. A dedicated reader policy exposes only group and business portfolio records to the read-only directory API; account and customer-workspace data remain unavailable to that role. Application services must authenticate through an identity provider, check scoped membership and roles, and use restricted database roles. Do not connect end-user clients directly to the database or use the migration owner as the runtime account.

## Next implementation step

Connect an OIDC identity provider (Drixel ID) and add a backend API that validates tokens and authorizes every request against organization memberships and scoped role assignments. The console is prepared as the operator surface but is not yet connected to that API. Then integrate one service at a time, starting with the service selected by Drixel. Existing users should be linked by verified identity, not merged solely by matching email text.

See [Drixel_Group_and_Account_Architecture.md](Drixel_Group_and_Account_Architecture.md) for the operating model and rollout decisions.
