-- ================================================
-- MBTI × 桌遊配對 - Cloudflare D1 建表 SQL
-- 資料庫：mbti-board-game-matcher-db
-- ================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT,
  email TEXT,
  username TEXT,
  nickname TEXT,
  picture TEXT,
  avatar_url TEXT,
  mbti_type TEXT,
  super_liked_games TEXT DEFAULT '[]',
  liked_games TEXT DEFAULT '[]',
  neutral_games TEXT DEFAULT '[]',
  disliked_games TEXT DEFAULT '[]',
  no_interest_games TEXT DEFAULT '[]',
  wishlist TEXT DEFAULT '[]',
  owned_games TEXT DEFAULT '[]',
  to_buy_games TEXT DEFAULT '[]',
  owned_games_bgg_pending TEXT DEFAULT '[]',
  to_buy_games_bgg_pending TEXT DEFAULT '[]',
  pinned_games TEXT,
  daily_question_count INTEGER DEFAULT 0,
  last_question_date INTEGER,
  last_login INTEGER,
  bio TEXT,
  social_links TEXT,
  profile_card_meta TEXT,
  region TEXT,
  want_contact INTEGER DEFAULT 0,
  explore_list TEXT,
  explore_list_public INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS user_stats (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  unlocked_badges TEXT DEFAULT '[]',
  daily_quest_completed INTEGER DEFAULT 0,
  last_quest_reset INTEGER,
  streak_days INTEGER DEFAULT 0,
  last_login INTEGER,
  total_contributions INTEGER DEFAULT 0,
  weekly_contributions INTEGER DEFAULT 0,
  last_weekly_reset INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS game_database (
  id TEXT PRIMARY KEY,
  name_zh TEXT,
  name_ja TEXT,
  name_en TEXT,
  year INTEGER,
  min_players INTEGER,
  max_players INTEGER,
  min_playtime INTEGER,
  max_playtime INTEGER,
  -- playing_time 代表「估計每位玩家平均花費時間（分鐘）」，由 min/max_playtime 與人數推估
  playing_time INTEGER,
  complexity REAL,
  image_url TEXT,
  bgg_id TEXT,
  -- BGG 數值與屬性欄位
  baverage REAL,               -- BGG 平均評分（投票推薦度）
  rank INTEGER,                -- BGG 排名
  bggbestplayers TEXT,         -- BGG 推薦最佳遊玩人數（原始字串，之後可再細拆）
  bgglanguagedependence INTEGER, -- BGG 文字依賴度（1–5）
  itemtype TEXT,               -- 主遊戲 / 擴充 等
  category TEXT,               -- BGG Board Game Category（JSON 陣列字串，存官方名稱）
  mechanics TEXT,              -- BGG Board Game Mechanic（JSON 陣列字串，存官方名稱）
  bgg_type TEXT,               -- BGG Type（Abstract Games / Family Games 等）
  -- 新版遊戲 6 維度（一維一欄，0 = 偏左端、12 = 偏右端）
  -- 1) 進入門檻：易學 ↔ 複雜
  axis_entry REAL,
  -- 2) 情緒氛圍：歡樂 ↔ 燒腦
  axis_mood REAL,
  -- 3) 掌控程度：運氣 ↔ 策略
  axis_control REAL,
  -- 4) 資訊透明：磊落 ↔ 心機
  axis_openness REAL,
  -- 5) 互動模式：社交 ↔ 沉浸
  axis_sociality REAL,
  -- 6) 競爭關係：合作 ↔ 對抗
  axis_competition REAL,
  -- 審稿人對該軸的加減（與 BGG 推論相加後 clamp 0–12 寫入 axis_*）
  axis_entry_reviewer_delta REAL DEFAULT 0,
  axis_mood_reviewer_delta REAL DEFAULT 0,
  axis_control_reviewer_delta REAL DEFAULT 0,
  axis_openness_reviewer_delta REAL DEFAULT 0,
  axis_sociality_reviewer_delta REAL DEFAULT 0,
  axis_competition_reviewer_delta REAL DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS game_aliases (
  id TEXT PRIMARY KEY,
  primary_name TEXT,
  aliases TEXT DEFAULT '[]',
  bgg_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS game_votes (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  game_name TEXT,
  vote_type TEXT,
  mbti_type TEXT,
  collection_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS game_collections (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT,
  category TEXT,
  games TEXT DEFAULT '[]',
  icon TEXT,
  description TEXT,
  games_cache TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  start_date INTEGER,
  end_date INTEGER,
  questions_per_session INTEGER DEFAULT 10,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS collection_game_stats (
  id TEXT PRIMARY KEY,
  collection_id TEXT,
  game_name TEXT,
  like_count INTEGER DEFAULT 0,
  wishlist_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS user_collections (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  games TEXT DEFAULT '[]',
  created_by TEXT,
  creator_name TEXT,
  is_public INTEGER DEFAULT 1,
  play_count INTEGER DEFAULT 0,
  vote_stats TEXT,
  rated_by TEXT DEFAULT '[]',
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS user_collection_votes (
  id TEXT PRIMARY KEY,
  collection_id TEXT,
  voter_id TEXT,
  game_name TEXT,
  vote TEXT,
  voted_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name_zh TEXT,
  name_en TEXT,
  icon TEXT,
  description TEXT,
  rarity TEXT,
  unlock_type TEXT,
  unlock_value TEXT,
  is_limited INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS admin_whitelist (
  id TEXT PRIMARY KEY,
  google_id TEXT,
  email TEXT,
  nickname TEXT,
  picture TEXT,
  role TEXT DEFAULT 'admin',
  added_by TEXT,
  added_at INTEGER,
  last_access INTEGER,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS tester_whitelist (
  id TEXT PRIMARY KEY,
  google_id TEXT,
  note TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS influencer_whitelist (
  id TEXT PRIMARY KEY,
  google_id TEXT,
  note TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS publisher_badge_series (
  id TEXT PRIMARY KEY,
  publisher_name TEXT,
  publisher_name_en TEXT,
  icon TEXT,
  image_url TEXT,
  game_list TEXT DEFAULT '[]',
  fan_thresholds TEXT,
  customer_thresholds TEXT,
  is_active INTEGER DEFAULT 1,
  created_by TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS quiz_collections (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  icon TEXT,
  tags TEXT DEFAULT '[]',
  time_limit INTEGER DEFAULT 30,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  collection_id TEXT,
  question TEXT,
  options TEXT DEFAULT '[]',
  answer_index INTEGER,
  explanation TEXT,
  image_url TEXT,
  time_limit INTEGER DEFAULT 30,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  submitted_by TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  collection_id TEXT,
  user_id TEXT,
  answers TEXT DEFAULT '[]',
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  completed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS daily_quests (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  xp_reward INTEGER DEFAULT 0,
  quest_type TEXT,
  requirement TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS limited_events (
  id TEXT PRIMARY KEY,
  title TEXT,
  icon TEXT,
  description TEXT,
  start_date INTEGER,
  end_date INTEGER,
  game_list TEXT DEFAULT '[]',
  rewards TEXT,
  is_active INTEGER DEFAULT 1,
  created_by TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS event_progress (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  user_id TEXT,
  game_id TEXT,
  rating TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS site_stats (
  id TEXT PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

-- 揪桌趣處連結（Line/Discord/FB/自架/店家 Google Map 等，多分類、可上架/下架）
CREATE TABLE IF NOT EXISTS community_links (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 999,
  is_active INTEGER DEFAULT 1,
  source_tag TEXT NOT NULL,
  category_discussion INTEGER DEFAULT 0,
  category_regions TEXT DEFAULT '[]',
  category_platforms TEXT DEFAULT '[]',
  category_meetup INTEGER DEFAULT 0,
  category_store INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

-- 索引（加速常用查詢）
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_game_votes_user_id ON game_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_game_votes_game_name ON game_votes(game_name);
CREATE INDEX IF NOT EXISTS idx_game_database_name_zh ON game_database(name_zh);
CREATE INDEX IF NOT EXISTS idx_game_database_bgg_id ON game_database(bgg_id);
CREATE INDEX IF NOT EXISTS idx_user_collection_votes_collection_id ON user_collection_votes(collection_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_collection_id ON quiz_questions(collection_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_event_progress_user_id ON event_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_game_stats_collection_id ON collection_game_stats(collection_id);
CREATE INDEX IF NOT EXISTS idx_community_links_active_sort ON community_links(is_active, sort_order);

-- 若為既有資料庫，請執行：ALTER TABLE community_links ADD COLUMN category_store INTEGER DEFAULT 0;

-- ========== 玩家 8 軸偏好輪廓（做完桌遊偏好測驗後寫入，供「玩家影響遊戲 8 軸」用） ==========
CREATE TABLE IF NOT EXISTS user_preference_profiles (
  user_id TEXT PRIMARY KEY,
  -- 新版玩家 6 維度（與遊戲欄位語意相同，0 = 偏左端、12 = 偏右端）
  -- 1) 進入門檻：易學 ↔ 複雜
  axis_entry INTEGER DEFAULT 0,
  -- 2) 情緒氛圍：歡樂 ↔ 燒腦
  axis_mood INTEGER DEFAULT 0,
  -- 3) 掌控程度：運氣 ↔ 策略
  axis_control INTEGER DEFAULT 0,
  -- 4) 資訊透明：磊落 ↔ 心機
  axis_openness INTEGER DEFAULT 0,
  -- 5) 互動模式：社交 ↔ 沉浸
  axis_sociality INTEGER DEFAULT 0,
  -- 6) 競爭關係：合作 ↔ 對抗
  axis_competition INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
);

-- ========== 遊戲 / 玩家 6 維度 ==========
-- 遊戲：由「喜歡該遊戲的玩家」輪廓平均計算；玩家：由桌友適性題目計算
-- 若為既有資料庫，需要補欄位：
--   遊戲：
--     ALTER TABLE game_database ADD COLUMN axis_entry REAL;
--     ALTER TABLE game_database ADD COLUMN axis_mood REAL;
--     ALTER TABLE game_database ADD COLUMN axis_control REAL;
--     ALTER TABLE game_database ADD COLUMN axis_openness REAL;
--     ALTER TABLE game_database ADD COLUMN axis_sociality REAL;
--     ALTER TABLE game_database ADD COLUMN axis_competition REAL;
--   玩家：
--     ALTER TABLE user_preference_profiles ADD COLUMN axis_entry INTEGER DEFAULT 0;
--     ALTER TABLE user_preference_profiles ADD COLUMN axis_mood INTEGER DEFAULT 0;
--     ALTER TABLE user_preference_profiles ADD COLUMN axis_control INTEGER DEFAULT 0;
--     ALTER TABLE user_preference_profiles ADD COLUMN axis_openness INTEGER DEFAULT 0;
--     ALTER TABLE user_preference_profiles ADD COLUMN axis_sociality INTEGER DEFAULT 0;
--     ALTER TABLE user_preference_profiles ADD COLUMN axis_competition INTEGER DEFAULT 0;
-- 既有 DB 若曾建 description/source，可移除：ALTER TABLE game_database DROP COLUMN description; ALTER TABLE game_database DROP COLUMN source;
-- 既有 users 表補欄位（地區、是否想被桌友連絡）：ALTER TABLE users ADD COLUMN region TEXT; ALTER TABLE users ADD COLUMN want_contact INTEGER DEFAULT 0;
-- 既有 users 表補欄位（擁有 / 想買遊戲）：ALTER TABLE users ADD COLUMN owned_games TEXT DEFAULT '[]'; ALTER TABLE users ADD COLUMN to_buy_games TEXT DEFAULT '[]';
