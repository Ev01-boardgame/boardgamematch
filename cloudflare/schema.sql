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
  pinned_games TEXT,
  daily_question_count INTEGER DEFAULT 0,
  last_question_date INTEGER,
  last_login INTEGER,
  bio TEXT,
  social_links TEXT,
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
  playing_time INTEGER,
  complexity REAL,
  image_url TEXT,
  description TEXT,
  source TEXT,
  bgg_id TEXT,
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
