CREATE TABLE IF NOT EXISTS hackatime_trust_levels (
  slack_id TEXT PRIMARY KEY,
  trust_level TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
