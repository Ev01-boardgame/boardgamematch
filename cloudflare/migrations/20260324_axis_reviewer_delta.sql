-- 既有 D1：審稿人六軸加減（與 BGG 推論相加後 clamp 0–12）
-- wrangler d1 execute boardgame-match-db --file=cloudflare/migrations/20260324_axis_reviewer_delta.sql

ALTER TABLE game_database ADD COLUMN axis_entry_reviewer_delta REAL DEFAULT 0;
ALTER TABLE game_database ADD COLUMN axis_mood_reviewer_delta REAL DEFAULT 0;
ALTER TABLE game_database ADD COLUMN axis_control_reviewer_delta REAL DEFAULT 0;
ALTER TABLE game_database ADD COLUMN axis_openness_reviewer_delta REAL DEFAULT 0;
ALTER TABLE game_database ADD COLUMN axis_sociality_reviewer_delta REAL DEFAULT 0;
ALTER TABLE game_database ADD COLUMN axis_competition_reviewer_delta REAL DEFAULT 0;
