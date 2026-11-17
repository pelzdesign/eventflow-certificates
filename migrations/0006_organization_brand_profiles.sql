-- Seller-editable brand content is stored per organization; visual tokens and gift stories stay EventFlow-managed.
CREATE TABLE IF NOT EXISTS organization_brand_profiles (
  organization_id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  provider_name TEXT,
  tagline TEXT NOT NULL,
  contact_url TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
