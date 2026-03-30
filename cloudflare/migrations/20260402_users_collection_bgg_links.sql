-- 收藏清單：顯示字串 → BGG ID（JSON），供後台入庫後依 ID 對齊主名，不靠名稱猜測
-- D1 執行： wrangler d1 execute boardgame-match-db --remote --file=cloudflare/migrations/20260402_users_collection_bgg_links.sql
ALTER TABLE users ADD COLUMN collection_bgg_links TEXT;
