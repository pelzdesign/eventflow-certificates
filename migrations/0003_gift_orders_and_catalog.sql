-- Gift purchase workflow. Catalog records are organization-owned and prices are snapshotted into orders.
CREATE TABLE IF NOT EXISTS catalog_services (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_catalog_services_org_active
  ON catalog_services (organization_id, is_active, sort_order, title);

CREATE TABLE IF NOT EXISTS catalog_variants (
  id TEXT PRIMARY KEY NOT NULL,
  service_id TEXT NOT NULL REFERENCES catalog_services(id),
  title TEXT NOT NULL,
  description TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_variants_service_active
  ON catalog_variants (service_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS gift_orders (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  catalog_service_id TEXT NOT NULL,
  catalog_variant_id TEXT NOT NULL,
  service_title_snapshot TEXT NOT NULL,
  variant_title_snapshot TEXT NOT NULL,
  description_snapshot TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('awaiting_payment', 'payment_reported', 'confirmed')),
  payment_reported_at TEXT,
  payment_confirmed_at TEXT,
  certificate_date TEXT,
  recipient_name TEXT,
  greeting_text TEXT,
  sender_signature TEXT,
  certificate_id TEXT UNIQUE REFERENCES certificates(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gift_orders_org_created
  ON gift_orders (organization_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_gift_orders_org_payment
  ON gift_orders (organization_id, payment_status, created_at DESC);
