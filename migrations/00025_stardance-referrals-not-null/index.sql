UPDATE stardance_referrals
SET slack_id = 'U' || UPPER(REGEXP_REPLACE(name, '[^A-Za-z]+', '', 'g'))
WHERE slack_id IS NULL;

UPDATE stardance_referrals
SET email = LOWER(REGEXP_REPLACE(name, '[^A-Za-z]+', '', 'g')) || '@example.test'
WHERE email IS NULL;

ALTER TABLE stardance_referrals
  ALTER COLUMN slack_id SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;
