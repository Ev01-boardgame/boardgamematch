# D1 Migrations

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
