CREATE TABLE IF NOT EXISTS stardance_referrals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code_id TEXT NOT NULL REFERENCES stardance_referral_codes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slack_id TEXT NOT NULL,
  email TEXT NOT NULL,
  hours_logged NUMERIC NOT NULL DEFAULT 0,
  hours_approved NUMERIC NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  referred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stardance_referrals_verification_status_check
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'))
);

CREATE INDEX IF NOT EXISTS stardance_referrals_user_idx
  ON stardance_referrals(user_id, referred_at DESC, id);

CREATE INDEX IF NOT EXISTS stardance_referrals_code_idx
  ON stardance_referrals(referral_code_id, referred_at DESC);
