-- profile_card_meta: JSON text for profile card fields (play times, preferences, etc.)
-- Run this FILE with: wrangler d1 execute <DB_NAME> --remote --file=./migrations/add_profile_card_meta.sql
-- Do NOT use --command=add_profile_card_meta.sql (that passes the filename as SQL and causes: near "add_profile_card_meta" syntax error)

ALTER TABLE users ADD COLUMN profile_card_meta TEXT;

UPDATE users
SET profile_card_meta = json_extract(social_links, '$.card_meta')
WHERE social_links IS NOT NULL
  AND json_extract(social_links, '$.card_meta') IS NOT NULL
  AND (profile_card_meta IS NULL OR profile_card_meta = '');
