# Architecture overview — Digital Certificates

**Status:** approved module boundaries; implementation contracts are initial DEMO contracts unless marked otherwise.

## 1. Responsibility split

### EventFlow platform owns
- User identities and authentication
- Organizations and membership
- Roles, permissions and organization selection
- Main cabinet shell, navigation and shared infrastructure

The platform's organization model and server-side context contract are not yet implemented in the inspected platform baseline. The certificates module must not assume that planned tables or APIs already exist.

### Certificates module owns
- Certificate domain model and lifecycle
- Certificate templates
- Public read-only certificate representation
- Issuance and redemption business rules
- Certificate operation history
- Module-specific persistence adapter

## 2. Core invariants

1. A certificate belongs to an organization.
2. A certificate does not require an event relationship. An optional event reference may be added later without making it a prerequisite.
3. The client never establishes a trusted user identity or permission by sending IDs or hiding controls.
4. Every state-changing operation must resolve the authenticated actor and authorize the requested organization/action on the server.
5. Public-token access is read-only; viewing a certificate never redeems it.
6. DEMO identity, authorization and persistence are replaceable adapters, not a second permanent platform identity model.
7. Production Supabase and the main EventFlow repository remain out of scope.

## 3. Runtime boundaries

The application layer depends on ports:
- `PlatformAccessPort` — resolves the authenticated actor and verifies organization-scoped permissions.
- `CertificateRepositoryPort` — persists and retrieves certificate aggregates.
- `IdGeneratorPort`, `PublicTokenGeneratorPort`, `ClockPort` — deterministic infrastructure dependencies for testability.

Adapters provide DEMO implementations first. A future EventFlow adapter can implement the same platform port after the platform contract is implemented and agreed.

## 4. Isolated Preview DEMO runtime

The Preview adapter targets Cloudflare Pages Functions with a dedicated D1 database:
- `POST /api/auth/login` and `POST /api/auth/logout` — temporary Preview-only login/session lifecycle.
- `GET /cabinet` and `GET /login` — module-owned cabinet and login pages.
- `GET /api/certificates` — organization-scoped list, search and status filtering.
- `POST /api/certificates` — server-authorized DEMO issuance.
- `GET /api/public/certificates/:token` — read-only JSON projection.
- `GET /certificates/:token` — public read-only HTML certificate page.

The Preview login uses one synthetic actor and organization configured server-side. DEMO credentials are stored only as Preview environment secrets. Successful login creates a random opaque session ID; the browser receives only a `__Host-` cookie with `HttpOnly; Secure; SameSite=Strict; Path=/` and no `Domain`. D1 stores only the SHA-256 session-token hash, synthetic actor/organization context and absolute expiry. Sessions last eight hours and are revoked server-side at logout. Login attempts are rate-limited, and mutating requests require an exact same-origin `Origin` header.

The server resolves actor and organization from the validated session. The browser cannot assign itself a user or organization ID, and no bearer API token is sent to browser code. This is a replaceable Preview-only adapter, not EventFlow production authentication.

The cabinet supports listing, issuing service and monetary certificates, viewing certificate details, copying public links, searching by code/title/recipient and filtering by status. The list endpoint reads at most the 100 most recently issued records; search and status filtering apply only within that bounded result set. Pagination is not implemented. Editing, cancellation, redemption, partial use, ledger/history and organization switching remain excluded.

The public HTML page reads the public projection. It does not mutate state, requires no login, escapes certificate-supplied text, sends no-store and restrictive security headers, and marks the page noindex.

Cloudflare D1 binding and encrypted Pages secrets must be configured separately in Preview. No Cloudflare resource has been created or connected by this code change. The D1 adapter is not live until a dedicated D1 resource and binding are configured.

## 5. Next implementation sequence

1. Establish framework-independent domain types and ports.
2. Implement issuance and public read use cases with server-side access checks.
3. Implement isolated persistent DEMO adapters and public endpoints.
4. Implement Preview-only browser session and minimum cabinet.
5. Configure a dedicated Preview D1 binding and secrets only after separate user approval, then verify end-to-end behavior.
6. Add redemption operations with atomicity, idempotency and operation history after product semantics are defined.
7. Replace DEMO adapters only after EventFlow provides implemented platform contracts.

## 6. Explicitly deferred decisions

- Exact service-certificate redemption semantics (single use, units, or another model)
- Monetary certificate partial-redemption rules, including rounding and currency constraints
- Template editor capabilities and template versioning
- Provisioning and binding of the dedicated DEMO D1 resource
- Production EventFlow adapter details

These are not silently inferred by the initial code foundation.
