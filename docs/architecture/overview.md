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

## 4. Isolated DEMO runtime and persistence

The first server adapter targets Cloudflare Pages Functions with a dedicated D1 database:
- `functions/api/certificates` issues certificates through the application use case.
- `functions/api/public/certificates/:token` exposes only the public read model and is read-only.
- `D1CertificateRepository` is an infrastructure adapter behind `CertificateRepositoryPort`.
- `migrations/0001_create_certificates.sql` creates the isolated DEMO certificate table and index.

The DEMO access adapter resolves a synthetic user and organization from server-side environment configuration and validates a secret bearer token. The client cannot select the actor or organization. This is a narrow DEMO gate, not a replacement login system and not suitable as production authentication.

Cloudflare D1 binding and encrypted Pages secrets must be configured separately in the Preview environment. No Cloudflare resource has been created or connected by this code change. The Pages Functions source follows Cloudflare's documented `/functions` routing and D1 binding model: https://developers.cloudflare.com/pages/functions/get-started/ and https://developers.cloudflare.com/pages/functions/bindings/.

A browser-only store or process-memory store is insufficient for public links that must work across devices and survive restarts. The D1 adapter is the persistent DEMO path, but it is not live until a dedicated D1 resource and binding are configured.

## 5. Initial implementation sequence

1. Establish framework-independent domain types and ports.
2. Implement issuance and public read use cases with server-side access checks.
3. Implement an isolated persistent DEMO adapter and server endpoints.
4. Configure a dedicated Preview D1 binding and secret, then verify end-to-end behavior.
5. Add the cabinet/public UI and templates.
6. Add redemption operations with atomicity, idempotency and operation history.
7. Replace DEMO adapters only after EventFlow provides implemented platform contracts.

## 6. Explicitly deferred decisions

- Exact service-certificate redemption semantics (single use, units, or another model)
- Monetary certificate partial-redemption rules, including rounding and currency constraints
- Template editor capabilities and template versioning
- Provisioning and binding of the dedicated DEMO D1 resource
- Production EventFlow adapter details

These are not silently inferred by the initial code foundation.
