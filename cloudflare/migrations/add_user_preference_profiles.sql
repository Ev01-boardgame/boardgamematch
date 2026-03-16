-- 桌友適性「桌遊偏好」測驗結果儲存用
-- 若生產環境 D1 尚未建立此表，會出現 Table "user_preference_profiles" not found，需執行本 migration

CREATE TABLE IF NOT EXISTS user_preference_profiles (
  user_id TEXT PRIMARY KEY,
  conflict INTEGER DEFAULT 0,
  strategy INTEGER DEFAULT 0,
  social_fun INTEGER DEFAULT 0,
  immersion INTEGER DEFAULT 0,
  accessibility INTEGER DEFAULT 0,
  manipulation INTEGER DEFAULT 0,
  coop INTEGER DEFAULT 0,
  luck INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);
