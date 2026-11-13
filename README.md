# EventFlow Certificates

Independent digital certificates module for EventFlow. The module owns certificate business logic, templates, public read-only pages, lifecycle and operation history. EventFlow owns user identities, organizations, membership, authentication, roles and permissions.

## Current implementation

- Framework-independent certificate domain and application use cases.
- Replaceable platform-access and repository ports.
- Isolated Cloudflare Pages Functions + D1 DEMO adapter for server-side issuance and read-only public lookup.
- SQL migration for a dedicated DEMO database.
- Automated unit tests and GitHub Actions validation.

The DEMO adapter uses a server-side configured synthetic actor and organization with a secret bearer token. It is not a production authentication system and does not connect to EventFlow production Supabase. The public certificate endpoint is read-only. Redemption and partial-use rules remain deferred until their product semantics are defined.

See [architecture overview](docs/architecture/overview.md), [ADR-001](docs/decisions/ADR-001-demo-boundaries.md), and [Cloudflare Pages DEMO setup](docs/setup/cloudflare-pages-demo.md).

## Development

- `npm run typecheck` — strict TypeScript checks for application and Pages Functions.
- `npm test` — build the application and run unit tests.
