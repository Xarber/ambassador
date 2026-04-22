CREATE TABLE IF NOT EXISTS app_safeguards (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_safeguards (key, enabled)
VALUES
  ('onboarding_enabled', TRUE),
  ('shirt_ordering_enabled', TRUE)
ON CONFLICT (key) DO NOTHING;
