-- 補齊六軸中「門檻以外」五欄。既有庫若已有 axis_entry（複雜度映射）但 PATCH 靜默略過其餘軸，多為缺此五欄。
-- 部署前請先：wrangler d1 execute DB --command "PRAGMA table_info(game_database);"
-- 若某欄已存在，自本檔刪除對應 ALTER 行，避免 duplicate column name。
ALTER TABLE game_database ADD COLUMN axis_mood REAL;
ALTER TABLE game_database ADD COLUMN axis_control REAL;
ALTER TABLE game_database ADD COLUMN axis_openness REAL;
ALTER TABLE game_database ADD COLUMN axis_sociality REAL;
ALTER TABLE game_database ADD COLUMN axis_competition REAL;
