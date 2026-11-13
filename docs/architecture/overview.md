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
- `IdGenerator`, `PublicTokenGenerator`, `Clock` — deterministic infrastructure dependencies for testability.

Adapters will provide DEMO implementations first. A future EventFlow adapter can implement the same platform port after the platform contract is implemented and agreed.

## 4. DEMO persistence

A browser-only store or process-memory store is insufficient for public links that must work across devices and survive restarts. A remote persistent DEMO adapter is therefore required before the public DEMO can be considered complete.

The persistence provider has deliberately not been provisioned or connected in this foundation commit. The attached Cloudflare Pages setup excerpt describes a deployment workflow, but does not by itself establish a selected database, server runtime, or security contract for this module.

## 5. Initial implementation sequence

1. Establish framework-independent domain types and ports.
2. Implement issuance and public read use cases with server-side access checks.
3. Add a persistent isolated DEMO adapter and server endpoints.
4. Add the cabinet/public UI and templates.
5. Add redemption operations with atomicity, idempotency and operation history.
6. Replace DEMO adapters only after EventFlow provides implemented platform contracts.

## 6. Explicitly deferred decisions

- Exact service-certificate redemption semantics (single use, units, or another model)
- Monetary certificate partial-redemption rules, including rounding and currency constraints
- Template editor capabilities and template versioning
- DEMO persistence provider provisioning and deployment configuration
- Production EventFlow adapter details

These are not silently inferred by the initial code foundation.
