-- 選用：移除經驗值／等級欄位，減輕 user_stats 儲存空間
-- 執行前請確認全站已不再使用 XP／等級（前端與 API 已改為不讀寫這些欄位）
-- 在 Cloudflare D1 主控台對 boardgame-match-db 執行下列 SQL（需支援 SQLite 3.35+ DROP COLUMN）

ALTER TABLE user_stats DROP COLUMN xp;
ALTER TABLE user_stats DROP COLUMN level;
ALTER TABLE user_stats DROP COLUMN total_xp;
