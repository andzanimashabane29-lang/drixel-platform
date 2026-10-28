# DRIXEL ID — staged self-hosted migration

This branch is **not a production identity cutover**. Keep Auth0, Firebase Auth and all deployed callbacks operational until a staged DRIXEL ID issuer passes integration and account-continuity checks.

## Existing architecture
- This repository is the DRIXEL Platform directory of central account IDs, verified emails, identities, roles and application memberships in PostgreSQL.
- `identity/keycloak/drixel-realm.json` defines a development Keycloak realm and clients. The Docker Compose development server must not be exposed as a production identity service.
- `drixelsa.github.io` (separate repository) currently uses Firebase Auth and Firestore customer data. Its Auth0-to-Firebase bridge currently calls `/api/auth/drixel/exchange` on the DRIXEL API worker, which calls `/api/apps/drixel-sa-store/session` here.
- Render staging currently sets an Auth0 issuer and JWKS. Do not change those values before deploying and validating a production-ready self-hosted issuer.

## Implementation sequence
1. Provision a dedicated Keycloak **production** service with durable PostgreSQL storage, backups, HTTPS ingress, Keycloak hostname/proxy configuration, email delivery and monitored admin access. Use `id.drixelsa.co.za` only after DNS and TLS validation. Never deploy Keycloak in development mode to public internet.
2. Create a new *staging* issuer and separate staging OIDC clients for the platform console and DRIXEL SA store. Public clients use Authorization Code + PKCE S256, exact redirect URI allowlists and exact web origins; no implicit or password grants.
3. Implement and test a DRIXEL-owned, branded Universal Login **theme** on the self-hosted issuer. Preserve recovery, anti-enumeration, lockout/rate limiting, MFA/passkeys and accessibility.
4. Verify issuer, audience, nonce, PKCE code exchange, key rotation and token expiration server-side. The DRIXEL Platform authorization service remains the authority for scoped memberships/roles; Keycloak authenticates identities.
5. Add a *new* issuer-qualified identity link in `drixel.account_identities` only after interactive proof of ownership. Do not merge accounts by email alone. Preserve the current central account UUID, roles, audit history and invitations.
6. Bridge the DRIXEL SA identity to its **existing Firebase UID** using verified linking and Firebase Admin custom tokens where needed. Preserve `users/{uid}`, orders, customer records, Google sign-in and existing password flows throughout migration.
7. Run the browser journey end-to-end: existing Google customer, existing email/password customer, new DRIXEL ID customer, logout, expired state/PKCE, MFA, recovery, account conflicts, and return to original checkout URL. Check staging on mobile and desktop.
8. Prepare rollback by retaining the current Auth0 issuer, credentials and callback routes. Only switch users after successful staging checks, backups and an approved release. No automatic Auth0 account deletion.

## Release gate
- No provider configuration or production DNS switch before the new issuer and store bridge pass security tests.
- No automatic migrations that rewrite Firebase UIDs or overwrite Firestore user documents.
- No secrets, private signing keys, database passwords or management API tokens in source control.
- Run `npm run test:api` and `npm run build` plus the separate DRIXEL SA workflow checks before promoting a release.

## Staging artifacts now in the feature branch

- `identity/compose.staging.yml` runs an isolated **production-mode** Keycloak 26.3 container with its own durable PostgreSQL volume. It deliberately exposes the application port only inside Docker networking.
- `identity/keycloak/Dockerfile` embeds the `drixel` login theme; `identity/keycloak/themes/drixel/` contains the branded styling. Select the theme through the Keycloak realm admin UI after the realm is securely provisioned.
- `identity/.env.staging.example` lists required values, but is **not** a credential source and should never be populated in the repository.
- `server/identity-config.test.js` covers existing OIDC clients, staging isolation, and branding expectations.

### Operational preflight (not yet completed)

1. Provide a staging HTTPS domain and a correctly configured TLS reverse proxy or managed load balancer. Only 443 should be publicly reachable.
2. Provision independent PostgreSQL storage and ensure backups are encrypted, routinely restored in a test environment, and monitored.
3. Provision identity service secrets in the hosting provider's secret manager, not in GitHub. Test outbound SMTP, email verification, recovery, MFA and account throttling before opening registration.
4. Provision the realm via an authenticated admin session. Import local realm definitions only after reviewing production-specific redirect URIs and client audiences; do **not** reuse local-development or production Auth0 credentials.
5. Add staging issuer and verified signing-key metadata to DRIXEL Platform staging and the store's staging bridge. Run the account-linking tests and preserve existing Firebase UIDs.
6. Roll back by retaining the existing Auth0 bridge and original environment variables. Do not decommission Auth0 during this stage.

These artifacts are integration groundwork; they do not indicate that a production identity provider, SMTP system, DNS, provider secrets or migration has been deployed.
