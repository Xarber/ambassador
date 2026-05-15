CREATE TABLE IF NOT EXISTS stardance_referral_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'secondary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stardance_referral_codes_code_format CHECK (code ~ '^[A-Z1-9]{5}$'),
  CONSTRAINT stardance_referral_codes_kind_check CHECK (kind IN ('primary', 'secondary')),
  CONSTRAINT stardance_referral_codes_label_check CHECK (char_length(BTRIM(label)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS stardance_referral_codes_user_primary_unique
  ON stardance_referral_codes(user_id)
  WHERE kind = 'primary';

CREATE UNIQUE INDEX IF NOT EXISTS stardance_referral_codes_user_label_unique
  ON stardance_referral_codes(user_id, LOWER(label));

CREATE INDEX IF NOT EXISTS stardance_referral_codes_user_created_idx
  ON stardance_referral_codes(user_id, created_at ASC, id ASC);

INSERT INTO stardance_referral_codes (id, user_id, code, label, kind)
SELECT
  'sdref_' || md5(users.id || ':primary') AS id,
  users.id,
  users.stardance_referral_code,
  'Default',
  'primary'
FROM users
WHERE users.stardance_referral_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM stardance_referral_codes
    WHERE stardance_referral_codes.user_id = users.id
      AND stardance_referral_codes.kind = 'primary'
  )
ON CONFLICT DO NOTHING;
