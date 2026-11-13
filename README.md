# EventFlow — Digital Certificates

Independent business module for issuing, viewing and redeeming digital certificates within the EventFlow ecosystem.

## Current stage

Architecture-approved DEMO foundation. This repository is intentionally separate from the main EventFlow application.

## Boundaries

- The module owns certificate domain logic, templates, public certificate views and redemption history.
- EventFlow remains the source of truth for users, organizations, authentication, membership, permissions, cabinet shell and shared platform infrastructure.
- A certificate belongs to an organization. An event relationship is optional and is not part of the initial model.
- DEMO identity, authorization and persistence must be isolated behind replaceable ports/adapters.
- No production Supabase connection, production schema changes, SQL migrations or modifications to the main EventFlow repository are allowed without separate approval.
- Public certificate access is read-only. Issuing, changing and redeeming certificates require server-side authorization and state-changing logic.
- Never commit secrets, tokens, passwords or real customer data.

## Development approach

The first implementation milestone establishes domain contracts and application use cases before selecting or provisioning a remote DEMO persistence provider. The storage port must support durable, cross-device public links once a persistent adapter is connected.

## Planned capabilities

- Service and monetary gift certificates
- Organization-scoped issuance and management
- Public read-only certificate page
- Partial and full redemption with operation history
- Multiple templates and multiple organizations/users
- Replaceable integration with EventFlow platform context and authorization

These are target capabilities, not claims that they are already implemented.

## Repository structure

- `docs/architecture/` — module architecture and boundaries
- `docs/decisions/` — technical decision records
- `src/domain/` — framework-independent domain model
- `src/ports/` — replaceable platform and persistence contracts
- `src/application/` — use cases

## Status

Initial foundation is under development. No production services are connected.
