# Isolated DEMO on Cloudflare Pages + D1

This is a deployment adapter for the certificates module, not a connection to EventFlow production.

## Pages project configuration

Connect the private `pelzdesign/eventflow-certificates` repository to a separate Cloudflare Pages project.

- Root directory: repository root.
- Framework preset: None.
- Build command: `npm run build`.
- Build output directory: `public`.
- Build image/runtime: Node.js 22.
- Keep the Pages Functions directory at repository root as `functions/`; it must not be moved into the static output directory.
- The root route `/` redirects to `/login`.
- Static output contains only crawler/security metadata; application pages and APIs are Pages Functions.

**Preview-only deployment guard:** the project must have automatic production deployments disabled and Preview deployments enabled. Verify this setting before the first build/deployment. Do not run a production deployment, do not configure Production bindings or secrets, and do not merge or push a change that could trigger an enabled Production deployment. If the account/UI does not allow Preview deployments while Production deployments are disabled, stop and request a separate decision rather than enabling Production.

Cloudflare's Pages Preview Access policy protects preview deployment URLs (hash-based and branch aliases); it does not automatically protect the base `<project>.pages.dev` hostname. Keep production deployments disabled and verify that the base hostname does not expose the application. Enable the project's Preview access policy before sharing any Preview URL. Restrict the Access policy to the account owner / explicitly authorized testers. Do not rely on an unguessable URL.

## Required Preview bindings

Create a D1 database exclusively for the certificates DEMO and add a binding named `CERTIFICATES_DB` to the **Preview environment only**.

Apply all migrations in order to that dedicated D1 database:

1. `migrations/0001_create_certificates.sql`
2. `migrations/0002_create_demo_sessions.sql`
3. `migrations/0003_gift_orders_and_catalog.sql`
4. `migrations/0004_gift_certificate_personalization.sql`
5. `migrations/0005_public_certificate_lifecycle.sql`

Configure these values in the **Preview environment only**:

- `DEMO_USER_ID` — fixed synthetic actor ID for the isolated demo.
- `DEMO_ORGANIZATION_ID` — fixed synthetic organization ID owned by the demo.
- `DEMO_LOGIN_USERNAME` — Preview secret containing the DEMO login.
- `DEMO_LOGIN_PASSWORD` — Preview secret containing the DEMO password.

Credentials must remain in Cloudflare Pages Preview environment secrets. Never put them in source control, URLs, HTML, browser code, GitHub comments, or reports. Do not reuse production credentials. No Production variables, secrets, or D1 binding are required or authorized.

## Preview authentication

- `POST /api/auth/login` validates configured credentials server-side.
- Successful login creates a random opaque session ID and sets a `__Host-` cookie with `HttpOnly; Secure; SameSite=Strict; Path=/`, without a `Domain` attribute.
- D1 stores only the SHA-256 hash of the session ID, synthetic actor/organization context and absolute expiry.
- Sessions expire after 8 hours. Logout revokes the server-side session and clears the cookie.
- Login attempts are limited to 5 per fixed, UTC epoch-aligned 15-minute bucket per Cloudflare client IP. The bucket starts at `00`, `15`, `30` or `45` minutes past each hour; the counter resets immediately at the next boundary (this is not a rolling 15-minute window). A sixth attempt in the same bucket is rejected. The IP is hashed with the configured password before persistence; raw IP addresses are not stored.
- Mutating requests require an exact same-origin `Origin` header. SameSite is not treated as the only CSRF defense.
- The server resolves actor and organization from the validated session. Browser-supplied IDs are never trusted.

This is a single-user Preview-only mechanism, not EventFlow production authentication. Public registration, password recovery, multi-user administration and organization switching are intentionally absent.

## Routes

- `GET /` — redirects to `/login`.
- `GET /login` — DEMO login form.
- `POST /api/auth/login` — authenticate and create a session.
- `POST /api/auth/logout` — revoke the current session.
- `GET /cabinet` — protected cabinet UI.
- `GET /api/certificates` — authenticated list, search and status filter for the current DEMO organization.
- `POST /api/certificates` — issue a certificate; actor and organization are resolved server-side.
- `GET /certificates/:token` — public read-only HTML page.
- `GET /api/public/certificates/:token` — public read-only JSON projection.
- `POST /api/public/certificates/:token/activate` — explicit recipient activation; records the first activation timestamp and redirects to the service-specific contact URL.
- `POST /api/certificates/:id/redeem` — specialist marks an active certificate as used.
- `POST /api/certificates/:id/revoke-public-link` — specialist revokes public access while retaining the certificate record.
- `GET /buy` and `GET /api/catalog` — public gift catalogue and active service variants.
- `POST /api/orders` — create a buyer order with a server-side price snapshot.
- `GET /order/:token` and `GET /api/orders/:token` — buyer order page and public order status.
- `POST /api/orders/:token/payment-reported` — buyer reports payment; personalization becomes available, but the certificate is not issued.
- `PUT /api/orders/:token` — save buyer personalization.
- `GET /api/orders/admin` and `POST /api/orders/:id/confirm-payment` — authenticated specialist order inbox and manual payment confirmation.
- `POST /api/orders/:token/issue` — issue only after server-side payment confirmation and completed personalization.

The cabinet supports issuing service and monetary certificates, viewing details, copying public links, manually confirming gift-order payments, marking a certificate as used, revoking its public link, and viewing recipient activation timestamps. The list endpoint reads at most the 100 most recently issued certificates for the organization; search and status filtering apply only within that bounded result set, not across older history. The cabinet displays this limit explicitly. Pagination, editing, cancellation, partial use, ledger/history and organization-management actions remain excluded.

## Deployment boundary

This repository contains code and migrations only. It does not create Cloudflare resources, configure bindings or secrets, deploy anything, connect to production Supabase, or modify the main EventFlow repository. Keep all DEMO bindings and credentials in Preview. Do not expose Preview externally until the Preview Access policy, rate limiting, Origin checks and security settings have been reviewed in the actual Cloudflare environment.

## Local development

Use `wrangler pages dev public` with a local D1 binding and local-only variables. Never commit local secret files. Pages Functions remain in the repository-root `functions/` directory.

The gift catalogue tables are intentionally empty after migration. Do not expose an empty or partial catalog as a finished offer: populate and activate services only after the specialist confirms the complete price list, descriptions and fixed tariff variants. Payment is manual in this DEMO; the buyer's "I paid" action is only a report and never confirms receipt of funds. The specialist's authenticated confirmation is required before the server-side issuance endpoint can create a certificate.
