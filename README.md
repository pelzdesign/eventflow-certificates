# EventFlow Certificates

Independent digital certificates module for EventFlow. The module owns certificate business logic, templates, public read-only pages, lifecycle and operation history. EventFlow owns user identities, organizations, membership, authentication, roles and permissions.

## Current implementation

- Framework-independent certificate domain and application use cases.
- Replaceable platform-access and repository ports.
- Isolated Cloudflare Pages Functions + D1 DEMO adapter for issuance and public lookup.
- Preview-only browser login using an HttpOnly session cookie backed by hashed D1 session records.
- Certificate cabinet for listing and issuing certificates, plus a gift-order inbox with manual payment confirmation.
- Public service catalogue and buyer order flow: order creation, payment reporting, pre-confirmation personalization, and server-gated certificate issuance.
- First isolated brand pilot: **PelzDesign | пространство по васту**, with a replaceable brand profile and an idempotent DEMO bootstrap for the provisional Vastu express-review service.
- Gift-date, greeting and sender signature are stored on the certificate and shown after an accessible gift-opening interaction.
- Recipient activation is an explicit same-origin POST that records the first activation timestamp and redirects to the service contact URL snapshotted from the catalogue.
- Specialists can mark a certificate as used or revoke its public link; used certificates remain available as keepsake pages, while revoked links return not found.
- Public HTML page at `/certificates/:token`, backed by the public read model and protected against HTML injection.
- Root route redirects to `/login`; login and cabinet pages are served by Pages Functions.
- SQL migrations for a dedicated DEMO database.
- Automated unit tests and GitHub Actions validation.

The Preview login uses one synthetic actor and organization configured server-side. It is not EventFlow production authentication and does not connect to production Supabase. The browser never receives a bearer API token or trusted actor/organization IDs. Opening the public certificate page and JSON endpoint is read-only. The separate explicit activation POST records recipient intent; it does not redeem the certificate. Full redemption is a specialist action in the DEMO cabinet; partial-use and monetary redemption rules remain deferred.

See [architecture overview](docs/architecture/overview.md), [Vastu-gift scenarios and pilot flow](docs/products/vastu-gift.md), [ADR-001](docs/decisions/ADR-001-demo-boundaries.md), and [Cloudflare Pages DEMO setup](docs/setup/cloudflare-pages-demo.md).

## Development

- `npm run typecheck` — strict TypeScript checks for application and Pages Functions.
- `npm test` — build the application and run unit tests.
- Cloudflare Pages build command: `npm run build`.
- Cloudflare Pages build output directory: `public`.
- Use the Pages Functions directory at repository root (`functions/`); do not move it inside `public/`.

