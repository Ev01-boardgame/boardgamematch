-- 標記遊戲列來源：玩家從「編輯桌遊收藏」建檔為簡易列，admin-bgg-axis-sync 可補齊 thing／六軸
-- D1：wrangler d1 execute boardgame-match-db --remote --file=cloudflare/migrations/20260403_game_database_ingest_source.sql
ALTER TABLE game_database ADD COLUMN ingest_source TEXT;
