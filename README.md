# EventFlow Certificates

Independent digital certificates module for EventFlow. The module owns certificate business logic, templates, public read-only pages, lifecycle and operation history. EventFlow owns user identities, organizations, membership, authentication, roles and permissions.

## Current implementation

- Framework-independent certificate domain and application use cases.
- Replaceable platform-access and repository ports.
- Isolated Cloudflare Pages Functions + D1 DEMO adapter for issuance and public lookup.
- Preview-only browser login using an HttpOnly session cookie backed by hashed D1 session records.
- Minimal certificate cabinet for listing, issuing, viewing and copying public links, with search and status filtering over the latest 100 records.
- Public HTML page at `/certificates/:token`, backed by the public read model and protected against HTML injection.
- Root route redirects to `/login`; login and cabinet pages are served by Pages Functions.
- SQL migrations for a dedicated DEMO database.
- Automated unit tests and GitHub Actions validation.

The Preview login uses one synthetic actor and organization configured server-side. It is not EventFlow production authentication and does not connect to production Supabase. The browser never receives a bearer API token or trusted actor/organization IDs. The public certificate page and JSON endpoint are read-only; opening either does not redeem a certificate. Redemption and partial-use rules remain deferred until product semantics are defined.

See [architecture overview](docs/architecture/overview.md), [ADR-001](docs/decisions/ADR-001-demo-boundaries.md), and [Cloudflare Pages DEMO setup](docs/setup/cloudflare-pages-demo.md).

## Development

- `npm run typecheck` — strict TypeScript checks for application and Pages Functions.
- `npm test` — build the application and run unit tests.
- Cloudflare Pages build command: `npm run build`.
- Cloudflare Pages build output directory: `public`.
- Use the Pages Functions directory at repository root (`functions/`); do not move it inside `public/`.

