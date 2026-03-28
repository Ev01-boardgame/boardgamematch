# Admin：遊戲名稱聚合 API

供 **`admin-game-aliases.html`** 使用，避免在瀏覽器分批下載整份 `users` / `game_database`。

## 端點

- **方法**：`GET`
- **路徑**：`/admin/aggregate-game-names`
- **驗證**（與既有 Worker 一致）：
  - 若設定了 `API_SECRET`，需 `X-Api-Key`
  - 需 `Authorization: Bearer <Google JWT>`
  - JWT 對應的 `sub` 須在 `admin_whitelist` 且 `is_active = 1`，**或**與 `public/js/admin-auth.js` 的 `SUPER_ADMIN_IDS` 相同（寫在 `worker.js` 的 `SUPER_ADMIN_GOOGLE_IDS`）

## 回應 JSON

```json
{
  "participatingUsers": 123,
  "nameCounts": [{ "name": "某遊戲", "count": 5 }],
  "bggPendingIdCounts": [
    { "bgg_id": "377303", "count": 2, "owned_pending": 1, "buy_pending": 1 }
  ],
  "games": [{ "name_zh": "中文名", "name_en": "English" }]
}
```

- `participatingUsers`：至少有一筆 `liked_games` / `neutral_games` / `disliked_games` / `wishlist` / **`owned_games` / `to_buy_games`** 字串，或 **`owned_games_bgg_pending` / `to_buy_games_bgg_pending`** 內有 BGG ID 的使用者人數。
- `nameCounts`：上述六個「名稱清單」欄位合併後，每個字串出現次數。
- `bggPendingIdCounts`：全站待對照 BGG ID（依出現次數降序）。`count` 為欄位內出現總次數（同一使用者在擁有待對照與想買待對照各一筆會算 2）；`owned_pending` / `buy_pending` 為分別出現在兩欄的次數。
- `games`：`game_database` 的 `name_zh`、`name_en`（略過 `deleted_at` 已刪除列，若表有該欄）。

## 部署注意

1. **API Worker**（`cloudflare/worker.js`）：部署後才會有此路由。
2. **入口 Worker**（`cloudflare/entry-worker.js`）：須一併部署，且已將 **`/admin/*`** 轉發到 API Worker（否則正式網域會拿不到聚合結果，前端會 fallback 整表載入）。

## 前端 fallback

若 `GET /admin/aggregate-game-names` 非 2xx（舊 Worker、路由未轉發等），頁面會改回舊版「分批抓取 `game_database` + `users`」行為。
