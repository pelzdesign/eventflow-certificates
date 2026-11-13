# ADR-001: Isolated DEMO foundation and replaceable platform access

- **Status:** Accepted
- **Date:** 2026-11-13
- **Scope:** Certificates module only

## Context

EventFlow's current platform baseline does not provide an implemented organization membership model or a reusable server-side contract for active organization and permissions. The platform has selected Supabase Auth, but the organizer authentication flow and organization integration are not yet implemented.

The certificates module must be developed independently without duplicating platform infrastructure or connecting to production.

## Decision

1. Keep the certificate business model independent of any authentication vendor or platform schema.
2. Define a narrow server-side platform access port. It must resolve the actor from a trusted server session and verify organization-scoped permissions.
3. Keep DEMO identity and authorization in replaceable adapters. Do not create permanent module-owned users, roles or organizations.
4. Keep persistence behind a repository port. A browser-only or in-memory store is not accepted as the final public DEMO persistence mechanism.
5. Do not provision external services or connect production infrastructure as part of this decision.

## Consequences

- Application use cases can be tested without Supabase or Cloudflare.
- DEMO and future platform adapters can be replaced independently of certificate business logic.
- Public cross-device links remain blocked until an isolated persistent server-side adapter is implemented.
- Redemption details remain subject to explicit domain rules; they must not be guessed in infrastructure code.
