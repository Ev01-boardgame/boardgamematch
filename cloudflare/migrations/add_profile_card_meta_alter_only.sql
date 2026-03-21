-- Use if you prefer to run in two steps, or if UPDATE fails on first deploy.
ALTER TABLE users ADD COLUMN profile_card_meta TEXT;
