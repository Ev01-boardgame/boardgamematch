# D1 Migrations

## add_user_preference_profiles.sql

建立 `user_preference_profiles` 表，供「桌友適性」→ 桌遊偏好測驗結果儲存。  
若未建立，點「儲存到我的檔案」會出現 **Table "user_preference_profiles" not found**。  
**若已建表仍報錯**：請看專案根目錄 `docs/troubleshoot-user-preference-profiles.md`，確認表是建在「生產 Worker 綁定的同一個 D1」。

### 方式一：Cloudflare 主控台

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Workers & Pages** → **D1** → 選你的 D1 資料庫（例如 boardgame-match-db）
3. 分頁選 **Console**
4. 貼上 `migrations/add_user_preference_profiles.sql` 內容，按 **Run**

### 方式二：本機 wrangler（遠端 DB）

```bash
cd cloudflare
npx wrangler d1 execute boardgame-match-db --remote --file=./migrations/add_user_preference_profiles.sql
```

---

## remove_xp_level.sql

移除 `user_stats` 的 `xp`、`level`、`total_xp` 三欄，減輕儲存空間。  
全站已不再讀寫這三欄，可安全執行。

### 方式一：Cloudflare 主控台

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左側 **Workers & Pages** → **D1**
3. 點選 **boardgame-match-db**
4. 上方分頁選 **Console**
5. 在 SQL 輸入框**一次貼上一行**執行（或分三次執行）：
   ```sql
   ALTER TABLE user_stats DROP COLUMN xp;
   ALTER TABLE user_stats DROP COLUMN level;
   ALTER TABLE user_stats DROP COLUMN total_xp;
   ```
6. 按 **Run** 執行

### 方式二：本機 wrangler（遠端 DB）

在專案根目錄或 `cloudflare` 目錄下執行：

```bash
cd cloudflare
npx wrangler d1 execute boardgame-match-db --remote --file=./migrations/remove_xp_level.sql
```

執行前會提示確認，輸入 `y` 後會對**遠端** D1 執行。

---

## add_users_region_want_contact.sql

為 `users` 表新增 `region`（地區，存 JSON 陣列）、`want_contact`（是否想被桌友連絡）。  
**未執行前**：個人頁編輯簡介的地區與「願意被桌友連絡」不會真正寫入，儲存後重新整理會消失。

### 方式一：Cloudflare 主控台

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Workers & Pages** → **D1** → 選 **boardgame-match-db**
3. 分頁選 **Console**
4. **一次貼上一行**執行：
   ```sql
   ALTER TABLE users ADD COLUMN region TEXT;
   ALTER TABLE users ADD COLUMN want_contact INTEGER DEFAULT 0;
   ```
5. 按 **Run**

### 方式二：本機 wrangler（遠端 DB）

```bash
cd cloudflare
npx wrangler d1 execute boardgame-match-db --remote --file=./migrations/add_users_region_want_contact.sql
```
