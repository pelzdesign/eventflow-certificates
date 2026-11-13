PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'monetary')),
  value_json TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'redeemed', 'cancelled', 'expired')),
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  created_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_certificates_org_issued
  ON certificates (organization_id, issued_at DESC, id DESC);
