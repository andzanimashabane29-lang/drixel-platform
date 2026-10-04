# Drixel Platform foundation

This repository provides a shared organization and account directory for Drixel Labs Inc. It includes a PostgreSQL foundation for group businesses, services, global accounts, scoped memberships, role assignments, consent records, and audit events. The console reads the portfolio through a read-only API and provides OIDC-protected account administration.

## Initial portfolio

- Drixel Labs Inc — group parent
- Drixel SA — fashion and ecommerce business
- Excel Tutoring Academy SA — education business
- DrixelOne — technology business
- Drixel Digital Products — A-Chatz and SkrpTure
- Drixel ID — group-wide identity service

These are modeled as operating units and services. The database does not assert that each is a separate registered company.

## Start the local database

1. Copy `.env.example` to `.env` and set separate local passwords for PostgreSQL administration, the directory reader, and the management API. OIDC settings can remain blank until an identity provider is selected.
2. From this folder, run `docker compose up --build -d`.
3. On a new database volume, PostgreSQL runs `db/migrations/001_initial.sql` and `db/seed/001_portfolio.sql`. The `directory_init` service applies the read-role and management-role migrations, and sets local database passwords, including when an existing database volume is reused.
4. The API is available on port 3000. `GET /api/health` checks database connectivity; `GET /api/portfolio` returns business and service records only.

The compose setup requires Docker Desktop or Docker Engine with the Compose plugin. Passwords in `.env` are for local development only. Do not use these credentials for a shared or production deployment.

## Start the admin console

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Start the API and database with `docker compose up --build -d`.
4. Run `npm run dev` and open the local URL printed by Vite. Vite forwards `/api` requests to the API on port 3000.

The console uses a restrained white, charcoal, and gray interface. Each screen has its own direct URL: `/overview`, `/businesses`, `/services`, `/accounts`, `/access-roles`, `/audit-log`, and `/settings`. Individual directory records have shareable detail routes at `/businesses/:slug` and `/services/:slug`; related business and service links connect those records. Navigation supports direct links, browser back/forward, and mobile navigation. Business and service pages use live directory responses, sortable columns, status filters, service owner filters, pagination, and CSV export of all matching loaded records. When the API is unavailable, the interface reports that state rather than showing hard-coded records. The account page supports OIDC sign-in, business-scoped account listing, business and service invitations, and invitation acceptance. Invitation and acceptance actions write audit events. Business/service editing and arbitrary role changes are not implemented yet.

## Configure OIDC sign-in

1. Create an OIDC public client for the admin console. Enable authorization code flow with PKCE and allow the redirect URI `http://localhost:5173/auth/callback` for local development. Do not create a browser client secret. Allow the console origin to call the provider's token endpoint if it enforces CORS.
2. Set `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_CLIENT_ID`, and `OIDC_JWKS_URI` in `.env`. Set the matching `VITE_OIDC_ISSUER`, `VITE_OIDC_AUDIENCE`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_AUTHORIZATION_ENDPOINT`, and `VITE_OIDC_TOKEN_ENDPOINT` values. The API expects RS256 JWT access tokens whose audience is `OIDC_AUDIENCE`; it verifies issuer, audience, signature, expiry, and not-before time against the JWKS endpoint.
3. To provision the first group owner, set `OIDC_BOOTSTRAP_ADMIN_EMAIL`, `OIDC_BOOTSTRAP_ADMIN_NAME`, and `OIDC_BOOTSTRAP_ADMIN_SUBJECT` to that person's verified provider identity. The initializer links the exact issuer and subject and applies the `group_owner` role once. The bootstrap email must not already belong to a different account. The marker prevents later restarts from re-granting a revoked role.
4. Restart Docker Compose and Vite after changing environment values. Use HTTPS for shared deployments and register that deployment's exact callback URI. Never commit `.env` or expose `POSTGRES_MANAGEMENT_PASSWORD` to the browser.

The SPA keeps access and ID tokens in memory. Each invitation link contains a random one-time token in the URL fragment, which is not sent in HTTP requests or referrer headers. The invitation is bound to the normalized email address, expires after seven days, and only activates its business or service membership and role after the invitee signs in with the same verified OIDC identity. A person already linked to a different identity cannot be merged by email alone. The administrator copies and sends the invitation link through an approved channel; no email delivery service is configured yet.

## API and database security

- The portfolio API uses the dedicated `drixel_directory_reader` PostgreSQL role. It can only select group, business-unit, subsidiary, and their service records.
- Row-level security hides customer organizations and their applications from this API role. Account, membership, role-assignment, consent, and audit tables are not granted to it.
- Account administration uses a separate `drixel_management_api` login available only to the server. The API checks the verified issuer and subject, then authorizes account and audit queries against active group or business administrator roles.
- The API accepts writes only for business or service-scoped invitations and invitation acceptance. Roles are activated only after the invited identity is verified. Business administrators can grant employee/manager and service roles within their business; group administrators can invite across group businesses.
- Invitation acceptance requires a verified ID token whose issuer and subject match the API access token. Existing identities are linked by issuer and subject, never by matching email alone.
- `GET /api/accounts`, `GET /api/audit-log`, `POST /api/invitations`, and `POST /api/invitations/accept` require OIDC bearer tokens. Account and audit responses are limited to the actor's active group/business scopes.
- Set all local passwords in `.env`; the browser receives no database credentials or client secret. Never expose the management database credential to frontend code.
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

The migration enables PostgreSQL row-level security on the account and organization tables. A dedicated reader policy exposes only group and business portfolio records to the read-only directory API; account and customer-workspace data remain unavailable to that role. The management API uses a separate service credential, and its routes enforce membership and role scope after OIDC token validation. Application services must repeat those authorization checks for their own data; do not connect end-user clients directly to the database or use the migration owner as a runtime account.

## Remaining implementation work

Configure the OIDC provider and bootstrap the initial group owner. Then add business/service editing and scoped role changes, and integrate one service at a time. Existing identities must link by the provider's stable issuer and subject, not by email text alone.

See [Drixel_Group_and_Account_Architecture.md](Drixel_Group_and_Account_Architecture.md) for the operating model and rollout decisions.
