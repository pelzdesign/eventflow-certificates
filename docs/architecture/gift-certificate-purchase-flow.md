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
- Issuance is impossible until payment is confirmed and required personalization fields are valid. This check is server-side and must be atomic/idempotent.
- The public order endpoint exposes only the order's buyer-facing snapshot and personalization fields; never expose internal IDs, organization ID, session data or admin notes.
- Mutations require exact same-origin Origin validation.
- No payment provider, automatic bank verification, redemption, partial redemption or refund workflow is included.

## Catalogue completeness

The VK source was CAPTCHA-limited. Three product cards were discovered, but this is not verified as the complete price list. Do not activate catalogue entries or claim completeness until the specialist confirms all services, variants, prices and descriptions. Known prices and provisional descriptions are documented separately in the price-list artifact.

## Migration

Apply `0003_gift_orders_and_catalog.sql` after migrations 0001 and 0002 in the isolated DEMO database only.
