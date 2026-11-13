# Isolated DEMO on Cloudflare Pages + D1

This is a deployment adapter for the certificates module, not a connection to EventFlow production.

## Required Preview bindings

The Pages project must have a D1 database created specifically for the certificates DEMO and a binding named `CERTIFICATES_DB`. Apply both migrations in order:

1. `migrations/0001_create_certificates.sql`
2. `migrations/0002_create_demo_sessions.sql`

Configure these values in the **Preview** environment only:

- `DEMO_USER_ID` — fixed synthetic actor ID for the isolated demo.
- `DEMO_ORGANIZATION_ID` — fixed synthetic organization ID owned by the demo.
- `DEMO_LOGIN_USERNAME` — Preview secret containing the DEMO login.
- `DEMO_LOGIN_PASSWORD` — Preview secret containing the DEMO password.

Credentials must remain in Cloudflare Pages environment secrets. Never put them in source control, URLs, HTML, or browser code. Do not reuse production credentials.

## Preview authentication

- `POST /api/auth/login` validates configured credentials server-side.
- Successful login creates a random opaque session ID and sets a `__Host-` cookie with `HttpOnly; Secure; SameSite=Strict; Path=/`, without a `Domain` attribute.
- D1 stores only the SHA-256 hash of the session ID, synthetic actor/organization context and absolute expiry.
- Sessions expire after 8 hours. Logout revokes the server-side session and clears the cookie.
- Login attempts are limited to 5 per 15-minute window per Cloudflare client IP. The IP is hashed with the configured password before persistence; raw IP addresses are not stored.
- Mutating requests require an exact same-origin `Origin` header. SameSite is not treated as the only CSRF defense.
- The server resolves actor and organization from the validated session. Browser-supplied IDs are never trusted.

This is a single-user Preview-only mechanism, not EventFlow production authentication. Public registration, password recovery, multi-user administration and organization switching are intentionally absent.

## Routes

- `GET /login` — DEMO login form.
- `POST /api/auth/login` — authenticate and create a session.
- `POST /api/auth/logout` — revoke the current session.
- `GET /cabinet` — protected cabinet UI.
- `GET /api/certificates` — authenticated list, search and status filter for the current DEMO organization.
- `POST /api/certificates` — issue a certificate; actor and organization are resolved server-side.
- `GET /certificates/:token` — public read-only HTML page.
- `GET /api/public/certificates/:token` — public read-only JSON projection.

The cabinet supports issuing service and monetary certificates, viewing details, copying public links, searching by code/title/recipient and filtering by status. Edit, cancel, redeem, partial use, ledger/history and organization-management actions remain excluded.

## Deployment boundary

This repository contains code and migrations only. It does not create Cloudflare resources, configure bindings or secrets, deploy anything, connect to production Supabase, or modify the main EventFlow repository. Keep all DEMO bindings and credentials in Preview. Do not expose Preview externally until rate limiting, Origin checks and security settings have been reviewed in the actual Cloudflare environment.

## Local development

Use `wrangler pages dev` with a local D1 binding and local-only variables. Never commit local secret files.
