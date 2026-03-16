# 遊戲資料庫 8 軸設計（玩家影響遊戲數值）

## 一、目標

- 遊戲要有 **8 軸分數**（與玩家偏好測驗同一套：衝突、策略、社交樂趣、沉浸感、易學、操控心機、合作、運氣）。
- 這 8 軸要能 **由玩家行為影響**：例如「喜歡這款遊戲的玩家」的偏好輪廓，反饋成這款遊戲的 8 軸。

---

## 二、資料結構建議

### 1. 玩家端：存「誰的 8 軸」

測驗做完後，要把該使用者的 8 軸分數存起來，之後才能用「喜歡這款遊戲的人」的輪廓去算遊戲的 8 軸。

**做法 A：存在 `users` 表**

- 新增一欄 `preference_profile TEXT DEFAULT '{}'`，存 JSON，例如：  
  `{"conflict":2,"strategy":8,"social_fun":0,"immersion":0,"accessibility":2,"manipulation":2,"coop":1,"luck":0}`  
- 優點：不用新表、一筆使用者就有一份輪廓。  
- 缺點：查「所有有輪廓的 user_id」要掃 users、對 D1 做聚合時不如數字欄位好寫。

**做法 B：獨立表 `user_preference_profiles`**（推薦）

- 一筆一使用者，存 8 個數字欄位，方便之後做 AVG / 查詢。

```sql
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
```

- 使用者做完「桌遊偏好」測驗並送出／儲存時，寫入或更新這張表。  
- 數值範圍可與測驗一致（例如 0～12 或 0～100，建議先 0～12 與測驗原始分一致）。

---

### 2. 遊戲端：存「每款遊戲的 8 軸」

**做法 A：在 `game_database` 加 8 欄**（推薦）

- 每款遊戲一筆，直接 8 個 REAL 或 INTEGER，查詢、推薦、雷達圖都好做。

```sql
-- 新增 8 軸（可為 NULL = 尚未計算）
ALTER TABLE game_database ADD COLUMN axis_conflict REAL;
ALTER TABLE game_database ADD COLUMN axis_strategy REAL;
ALTER TABLE game_database ADD COLUMN axis_social_fun REAL;
ALTER TABLE game_database ADD COLUMN axis_immersion REAL;
ALTER TABLE game_database ADD COLUMN axis_accessibility REAL;
ALTER TABLE game_database ADD COLUMN axis_manipulation REAL;
ALTER TABLE game_database ADD COLUMN axis_coop REAL;
ALTER TABLE game_database ADD COLUMN axis_luck REAL;
```

- 數值範圍建議 0～100（或與玩家輪廓同一尺度再正規化）。  
- `NULL` = 還沒算過或沒有足夠玩家資料，前端可顯示「尚無資料」或隱藏雷達。

**做法 B：獨立表 `game_preference_profiles`**

- `game_id` + 8 個軸分數，不更動 `game_database`。  
- 適合想完全分離「遊戲基本資料」與「偏好輪廓」的情境；查詢時要多 JOIN 一次。

---

## 三、「玩家影響遊戲 8 軸」的計算方式

核心概念：**用「喜歡這款遊戲的玩家」的 8 軸平均（或加權平均）當成這款遊戲的 8 軸。**

### 步驟

1. **誰算「喜歡」？**  
   依你現有設計，可用：  
   - `game_votes` 裡 `vote_type = 'super_like'` 或 `'like'` 的 user_id，  
   - 或 `users.super_liked_games` / `users.liked_games` 裡有該遊戲的 user_id。

2. **這些人有 8 軸嗎？**  
   只取在 `user_preference_profiles` 裡有資料的 user_id（即做過偏好測驗且已存檔的）。

3. **怎麼算遊戲的 8 軸？**  
   - 對該遊戲的每個「喜歡且有意願輪廓」的玩家，取他的 8 軸。  
   - 遊戲的 `axis_*` = 這些玩家在該軸的 **平均**（或中位數，較抗極端值）。  
   - 若人數不足（例如 < 3），可選擇不更新、或標記為「低信心」。

4. **何時重算？**  
   - **選項 1**：每次有人對該遊戲按喜歡／超級喜歡，或更新自己的偏好輪廓時，就重算該遊戲的 8 軸（即時或排隊）。  
   - **選項 2**：定時批次（例如每日）掃描有 like/super_like 的遊戲，重算 8 軸。  
   - 建議先做「有事件就排隊重算該遊戲」，再視負載加批次補跑。

### 公式（概念）

```
game.axis_strategy = AVG(profile.strategy) 
  WHERE profile.user_id IN (SELECT user_id FROM game_votes WHERE game_name = game.name AND vote_type IN ('like','super_like'))
  AND profile.strategy IS NOT NULL
```

（實際用 D1 時可能拆成：先查該遊戲的 like 用戶 → 再查這些用戶的 profile → 在應用層算平均寫回 game_database。）

---

## 四、新遊戲／還沒人按喜歡的遊戲

- **沒有 like 資料時**：`axis_*` 維持 `NULL`，前端顯示「尚無 8 軸資料」或隱藏該遊戲的雷達。  
- **可選：種子資料**  
  - 若之後有 BGG 或編輯資料，可再寫一層「預設 8 軸」（例如從 BGG weight → 易學／策略 的對照表）。  
  - 計算時可採：`game.axis_* = 加權平均(玩家平均, 種子值)`，權重依「喜歡人數」或「是否有種子」決定。  
  - 這可以等玩家驅動上線後再補。

---

## 五、實作順序建議

1. **Schema**  
   - 新增 `user_preference_profiles`。  
   - `game_database` 加 8 欄 `axis_*`（或新表 `game_preference_profiles`）。

2. **前端**  
   - 做完「桌遊偏好」測驗後，多一步「儲存到我的檔案」：呼叫 API 寫入 `user_preference_profiles`（需登入）。

3. **後端 API**  
   - 寫入／更新 `user_preference_profiles`（依 user_id）。  
   - 「重算某款遊戲 8 軸」：查該遊戲 like 用戶 → 取這些人的 profile → 算平均 → 更新 `game_database.axis_*`。  
   - 觸發時機：使用者對某遊戲 like/super_like 時，或更新自己偏好輪廓時，對該遊戲排隊重算。

4. **前端顯示**  
   - 遊戲詳情／推薦頁：若 `axis_*` 非全 NULL，顯示該遊戲的 8 軸雷達或長條。  
   - 推薦邏輯：比對「玩家 8 軸」與「遊戲 8 軸」的相似度（例如餘弦或歐氏距離）。

---

## 六、小結

| 項目 | 建議 |
|------|------|
| 玩家 8 軸存哪 | 新表 `user_preference_profiles`（一 user 一列，8 個數字欄） |
| 遊戲 8 軸存哪 | `game_database` 加 8 欄 `axis_*`（REAL，nullable） |
| 遊戲 8 軸怎麼來 | 由「喜歡該遊戲且做過偏好測驗的玩家」的 8 軸平均（或加權）寫入 |
| 何時重算 | 有人 like/super_like 或更新偏好時，對該遊戲排隊重算（或每日批次） |
| 新遊戲／沒 like | 維持 NULL，之後可選加 BGG 或編輯種子 |

若你願意，下一步可以：  
- 把上面這套寫進 `schema.sql`（含 ALTER 與新表），並加一節「既有 DB 遷移」；  
- 或先做「只存玩家 8 軸 + 遊戲 8 軸欄位」，計算與觸發邏輯之後再接。

你要先從 schema 開始，還是先定「觸發重算」的規格（例如用 Cloudflare Queue / 批次）？
