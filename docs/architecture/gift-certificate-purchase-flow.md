# Gift certificate purchase flow (DEMO)

## Approved buyer journey

1. Buyer opens the public service catalogue and selects a concrete service and tariff.
2. The server creates an order and snapshots the current title, tariff, amount and currency. Later catalogue edits must not change an existing order.
3. Buyer selects **«Я оплатил»**. The order moves from `awaiting_payment` to `payment_reported`. The personalization form becomes available immediately.
4. Buyer can save the certificate date, recipient full name, greeting and sender signature before payment is confirmed.
5. The specialist reviews the transfer in the authenticated cabinet and confirms payment. The server changes the order to `confirmed`.
6. Only after confirmation and valid personalization can the buyer request issuance. The server re-checks payment status and issues the existing certificate using the authenticated organization actor. The public certificate URL is then returned to the buyer.

## Security invariants

- Public order access uses an unguessable random token; never use sequential order IDs as public credentials.
- Buyer-supplied organization, actor, price, currency, certificate ID and payment status are ignored.
- The server derives organization from the selected active catalog variant and the order.
- The price and service description are copied into the order at creation time.
- Reporting payment is not confirmation. Only an authenticated specialist session can confirm payment.
- Issuance is impossible until payment is confirmed and required personalization fields are valid. This check is server-side and must be atomic/idempotent; the certificate insert reads the current personalization directly from the order row within the same D1 batch that links the issued certificate.
- The public order endpoint exposes only the order's buyer-facing snapshot and personalization fields; never expose internal IDs, organization ID, session data or admin notes.
- Mutations require exact same-origin Origin validation.
- No payment provider, automatic bank verification, partial redemption or refund workflow is included. Full single-use marking is a separate specialist-only lifecycle action.

## Recipient certificate lifecycle

- Each catalogue service may store an `activation_url`. The order snapshots it, and issuance copies it to the certificate so later catalogue edits do not change an existing gift.
- The public page is noindex and uses a native, keyboard-accessible disclosure interaction for the gift reveal. Viewing the page remains read-only.
- The recipient's explicit **«Активировать подарок»** action sends a same-origin POST. The server records the first `activation_requested_at` timestamp and redirects to the snapshotted HTTP(S) contact URL. Repeated activation remains possible and does not redeem the certificate.
- Contact destinations are service-specific, not hard-coded to Tatyana. The catalogue is still empty until the specialist confirms all services, prices and descriptions; an activation URL must be configured on each relevant service before it can be activated.
- A specialist can mark an active certificate as used (`redeemed`) or revoke its public link. Used certificates remain viewable as keepsake pages; revoked links are excluded from the public read model and return not found.
- Public links use the existing random 256-bit token and remain available indefinitely unless explicitly revoked. No automatic link expiry or data deletion is introduced by this phase.

## Catalogue completeness

The VK source was CAPTCHA-limited. Three product cards were discovered, but this is not verified as the complete price list. Do not activate catalogue entries or claim completeness until the specialist confirms all services, variants, prices and descriptions. Known prices and provisional descriptions are documented separately in the price-list artifact.

## Migration

Apply migrations in order in the isolated DEMO database only: `0001_create_certificates.sql`, `0002_create_demo_sessions.sql`, `0003_gift_orders_and_catalog.sql`, `0004_gift_certificate_personalization.sql`, then `0005_public_certificate_lifecycle.sql`. The catalog tables are intentionally empty until the specialist confirms the complete service list and prices.
