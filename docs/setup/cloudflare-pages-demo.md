# Isolated DEMO on Cloudflare Pages + D1

This is a deployment adapter for the certificates module, not a connection to EventFlow production.

## Required Pages bindings

The Pages project must have a D1 database created specifically for the certificates DEMO and a binding named `CERTIFICATES_DB`. Apply `migrations/0001_create_certificates.sql` to that DEMO database before deploying the API.

Configure these values in the **Preview** environment first:

- `DEMO_USER_ID` — fixed synthetic actor ID for the isolated demo.
- `DEMO_ORGANIZATION_ID` — fixed synthetic organization ID owned by the demo.
- `DEMO_API_TOKEN` — encrypted Pages secret; never put it in source control or browser code.

The current adapter intentionally supports only `certificate:issue` for the one configured demo organization. It is not a general login system and must not be exposed as production authentication. Requests with no valid bearer token are rejected. The organization ID and actor ID are resolved from server-side environment configuration; the request body cannot choose either identity.

## Endpoints

- `POST /api/certificates` — issue a certificate. Send `Authorization: Bearer <DEMO_API_TOKEN>` and a JSON draft containing `code`, `kind`, `value`, `title`, and optional description/recipient/expiry fields. Server-owned ID, public token, status, issuer and issue time are not accepted from the client.
- `GET /certificates/:token` — public read-only HTML page. The issuance response returns this URL as `publicUrl`.
- `GET /api/public/certificates/:token` — read-only JSON projection for integrations and testing. Neither endpoint redeems or otherwise mutates a certificate.

## Deployment boundary

Cloudflare Pages Functions require a Pages project and an already-created binding resource. This repository contains the adapter and migration only; it does not create a Cloudflare account resource, configure a live Pages project, add secrets, or deploy anything. Keep the first binding and secret in Preview, not Production. A production environment must not reuse the demo token, user or organization.

## Local development

Use `wrangler pages dev` with a local D1 binding and local-only `.dev.vars`. Never commit `.dev.vars`. The Pages Functions source is typechecked separately from the framework-independent application code.
