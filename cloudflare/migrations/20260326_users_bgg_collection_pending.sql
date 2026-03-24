-- 使用者從 BGG 匯入收藏時，站內尚無對照的 BGG objectid 暫存（後台可批次對照）
ALTER TABLE users ADD COLUMN owned_games_bgg_pending TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN to_buy_games_bgg_pending TEXT DEFAULT '[]';
