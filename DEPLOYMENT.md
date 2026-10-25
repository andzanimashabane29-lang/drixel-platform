# Drixel Accounts production deployment

Production hostname: `https://www.accounts.drixelsa.co.za`

The application is a Vite SPA plus a Node API, PostgreSQL, and an OIDC identity provider. The production hostname should terminate HTTPS and send browser traffic to the built frontend while keeping `/api/*` same-origin with the API.

## Required DNS

Create a DNS record for the hostname `www.accounts.drixelsa.co.za` pointing to the frontend/reverse-proxy deployment target supplied by the hosting provider.

Typical configuration:

- Type: `CNAME`
- Name: `www.accounts`
- Target: the hostname supplied by the deployment provider
- Proxy: enabled when using Cloudflare and supported by the chosen host
- TLS: Full (strict) once the origin has a valid certificate

Do not point DNS at a placeholder target. Use the exact target issued by the production host.

## SPA routing

The host must serve `index.html` for application paths that are not physical files. These routes include:

- `/`
- `/overview`
- `/businesses`
- `/services`
- `/accounts`
- `/access-roles`
- `/audit-log`
- `/settings`
- `/businesses/:slug`
- `/services/:slug`
- `/auth/callback`
- `/accept-invitation`

Requests to `/api/*` must be proxied to the Drixel Platform API instead of falling back to the SPA.

## Production identity configuration

The imported Drixel ID client already trusts:

- Redirect URI: `https://www.accounts.drixelsa.co.za/auth/callback`
- Web origin: `https://www.accounts.drixelsa.co.za`
- Post-logout destination: `https://www.accounts.drixelsa.co.za/*`

For a shared/production identity provider, set the real public provider values in the deployment environment:

```env
OIDC_ISSUER=https://<identity-host>/realms/drixel
OIDC_AUDIENCE=drixel-platform-api
OIDC_CLIENT_ID=drixel-platform-console
OIDC_JWKS_URI=https://<identity-host>/realms/drixel/protocol/openid-connect/certs

VITE_OIDC_ISSUER=https://<identity-host>/realms/drixel
VITE_OIDC_AUTHORIZATION_ENDPOINT=https://<identity-host>/realms/drixel/protocol/openid-connect/auth
VITE_OIDC_TOKEN_ENDPOINT=https://<identity-host>/realms/drixel/protocol/openid-connect/token
VITE_OIDC_CLIENT_ID=drixel-platform-console
VITE_OIDC_AUDIENCE=drixel-platform-api
```

Replace `<identity-host>` with the actual public identity host. Never expose PostgreSQL or management passwords to Vite/browser variables.

## Production build

```bash
npm ci
npm run build
npm run test:api
```

The static frontend output is `dist/`.

## Reverse proxy contract

The public reverse proxy should implement this contract:

1. Force HTTPS.
2. Use `www.accounts.drixelsa.co.za` as the canonical host.
3. Proxy `/api/*` to the Node API.
4. Serve immutable Vite assets from `/assets/*` with long cache headers.
5. Serve `index.html` with no-cache/revalidation headers.
6. Fall back to `index.html` for SPA paths.
7. Add baseline security headers such as `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a deployment-tested Content Security Policy.

## Go-live checklist

- DNS resolves `www.accounts.drixelsa.co.za` to the deployment provider.
- HTTPS certificate is valid for `www.accounts.drixelsa.co.za`.
- `/api/health` succeeds through the public origin.
- Root `/` shows the Drixel Accounts ecosystem hub.
- `/overview` shows the administration console.
- Drixel ID sign-in returns to `/auth/callback` successfully.
- Browser back/forward and deep links work without 404s.
- Production database and identity credentials are not committed to Git.
- PostgreSQL and the identity administration port are not publicly exposed unless explicitly secured for that purpose.
