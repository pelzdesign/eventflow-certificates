-- Recipient-facing lifecycle: persistent public page, explicit activation request and revocable public access.
ALTER TABLE catalog_services ADD COLUMN activation_url TEXT;
ALTER TABLE gift_orders ADD COLUMN activation_url TEXT;
ALTER TABLE certificates ADD COLUMN activation_url TEXT;
ALTER TABLE certificates ADD COLUMN activation_requested_at TEXT;
ALTER TABLE certificates ADD COLUMN public_access_revoked_at TEXT;

CREATE INDEX IF NOT EXISTS idx_certificates_public_access
  ON certificates (public_token, public_access_revoked_at);
