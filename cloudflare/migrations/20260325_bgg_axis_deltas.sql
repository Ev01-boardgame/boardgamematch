-- BGG 主題／機制 → 六軸 delta 線上覆寫（與 Worker GET/PUT /api/* 搭配）
CREATE TABLE IF NOT EXISTS bgg_axis_deltas (
  id TEXT PRIMARY KEY,
  category_deltas TEXT NOT NULL DEFAULT '{}',
  mechanic_deltas TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
