-- Run AFTER add_profile_card_meta_alter_only.sql (column must exist).
UPDATE users
SET profile_card_meta = json_extract(social_links, '$.card_meta')
WHERE social_links IS NOT NULL
  AND json_extract(social_links, '$.card_meta') IS NOT NULL
  AND (profile_card_meta IS NULL OR profile_card_meta = '');
