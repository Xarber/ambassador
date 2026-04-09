CREATE TABLE IF NOT EXISTS auth_login_intents (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  email_domain TEXT,
  source TEXT NOT NULL DEFAULT 'auth_page',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_user_id TEXT REFERENCES users(id),
  completed_hca_id TEXT,
  completed_email_hash TEXT,
  completed_email_domain TEXT,
  was_existing_user BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_intents_started_at
  ON auth_login_intents(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_intents_completed_at
  ON auth_login_intents(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_intents_email_hash
  ON auth_login_intents(email_hash);

CREATE INDEX IF NOT EXISTS idx_auth_login_intents_source
  ON auth_login_intents(source);
