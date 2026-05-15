ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stardance_referral_code TEXT;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_stardance_referral_code_format;

ALTER TABLE users
  ADD CONSTRAINT users_stardance_referral_code_format
    CHECK (stardance_referral_code IS NULL OR stardance_referral_code ~ '^[A-Z1-9]{5}$');

CREATE UNIQUE INDEX IF NOT EXISTS users_stardance_referral_code_unique
  ON users (stardance_referral_code)
  WHERE stardance_referral_code IS NOT NULL;

WITH generated_codes AS (
  SELECT
    users.id AS user_id,
    string_agg(
      substr(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
        (get_byte(decode(md5(users.id || ':stardance'), 'hex'), positions.position) % 35) + 1,
        1
      ),
      ''
      ORDER BY positions.position
    ) AS code
  FROM users
  CROSS JOIN generate_series(0, 4) AS positions(position)
  WHERE users.stardance_referral_code IS NULL
  GROUP BY users.id
)
UPDATE users
SET stardance_referral_code = generated_codes.code
FROM generated_codes
WHERE users.id = generated_codes.user_id
  AND users.stardance_referral_code IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM users existing
    WHERE existing.stardance_referral_code = generated_codes.code
  );

INSERT INTO app_safeguards (key, enabled)
VALUES
  ('posters_enabled', TRUE),
  ('referrals_enabled', TRUE)
ON CONFLICT (key) DO NOTHING;
