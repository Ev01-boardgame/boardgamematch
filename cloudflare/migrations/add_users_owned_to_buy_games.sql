-- 為 users 表新增「擁有的遊戲」「想買的遊戲」欄位
-- 未執行此 migration 前，編輯「我的遊戲收藏」僅能本機暫存，無法永久寫入 D1
ALTER TABLE users ADD COLUMN owned_games TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN to_buy_games TEXT DEFAULT '[]';
