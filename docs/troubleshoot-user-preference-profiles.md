# 桌遊偏好儲存失敗：Table "user_preference_profiles" not found

## 自動建表（目前版本）

**若你已部署最新版 Worker**：Worker 會在第一次讀寫 `user_preference_profiles` 時自動執行 `CREATE TABLE IF NOT EXISTS`，**不需手動建表**。  
若仍出現此錯誤，請確認生產環境已部署含「自動建表」邏輯的 Worker，並重新部署一次。

---

## 若仍報錯，請依序確認

### 1. 表是建在「生產環境」用的同一個 D1

- 到 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → 點你的 **Worker**（例如 `mbti-boardgame-api`）。
- 上方分頁選 **Settings** → 下方 **Variables** 區塊找到 **D1 database bindings**，看綁定的資料庫名稱（例如 `boardgame-match-db`）。
- 到 **Workers & Pages** → **D1** → 點進**同一個**資料庫（同名、同 Account）。
- 在該 D1 的 **主控台** 執行：
  ```sql
  SELECT name FROM sqlite_master WHERE type='table' AND name='user_preference_profiles';
  ```
- 若回傳一列 `user_preference_profiles`，代表表已存在；若空，代表你之前建表可能建在**另一個** D1（例如本機或別的專案），請在**這個** D1 主控台再執行一次建表：

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

### 2. 生產網站用的 API 是否就是這個 Worker

- 若 `boardgamematch.com.tw` 的 API 是透過 **Cloudflare Worker** 轉發到 D1，請確認上線的 Worker 就是你在 Dashboard 看到的那一個（同 Account、同名稱）。
- 若有「預覽 / 正式」或「staging / production」不同部署，請在**正式環境**對應的 D1 建表。

### 3. 建表後不需重啟 Worker

- 建表後 D1 立刻生效，Worker 不需要重新 Deploy。若仍報錯，多半是步驟 1（建錯資料庫）或步驟 2（用錯環境）。
