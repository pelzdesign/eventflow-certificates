CREATE TABLE IF NOT EXISTS demo_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_expiry ON demo_sessions (expires_at);
CREATE TABLE IF NOT EXISTS demo_login_attempts (
  key_hash TEXT NOT NULL,
  window_start TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 1),
  PRIMARY KEY (key_hash, window_start)
);
