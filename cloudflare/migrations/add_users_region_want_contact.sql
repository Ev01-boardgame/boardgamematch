-- 為 users 表新增「地區」「是否想被桌友連絡」欄位
-- 未執行此 migration 前，編輯簡介的地區與願意被聯絡不會真正寫入 D1
ALTER TABLE users ADD COLUMN region TEXT;
ALTER TABLE users ADD COLUMN want_contact INTEGER DEFAULT 0;
