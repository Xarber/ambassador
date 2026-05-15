ALTER TABLE stardance_referral_codes
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DROP INDEX IF EXISTS stardance_referral_codes_user_label_unique;

CREATE UNIQUE INDEX IF NOT EXISTS stardance_referral_codes_user_label_unique
  ON stardance_referral_codes(user_id, LOWER(label))
  WHERE archived_at IS NULL;
