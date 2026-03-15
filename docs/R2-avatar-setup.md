# R2 大頭貼設定教學

大頭貼改為**圖片存 R2、D1 只存網址**，其他玩家用公開 URL 就能看到頭貼。

---

## 1. 建立 R2 Bucket（只需做一次）

在專案目錄執行：

```bash
cd cloudflare
npx wrangler r2 bucket create boardgamematch-avatars
```

或在 [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Create bucket**，名稱填 `boardgamematch-avatars`。

---

## 2. 已改動的檔案

| 檔案 | 改動 |
|------|------|
| `cloudflare/wrangler.toml` | 新增 R2 綁定 `AVATAR_BUCKET`、變數 `AVATAR_PUBLIC_BASE` |
| `cloudflare/worker.js` | 新增 `POST /api/upload-avatar`（需 JWT）、`GET /avatars/:userId`（公開） |
| `cloudflare/entry-worker.js` | `/api/*`、`/avatars/*` 轉發到 API Worker |
| `public/profile.html` | 上傳頭貼時先呼叫 `/api/upload-avatar`，再將回傳的 URL 寫入 D1 |

---

## 3. 流程說明

1. **上傳**：使用者在個人頁上傳/裁切頭貼 → 前端送 `POST /api/upload-avatar`，body `{ image: "data:image/jpeg;base64,..." }`，帶 `Authorization: Bearer <JWT>`。
2. **Worker**：驗證 JWT，用 `sub`（Google ID）當檔名，寫入 R2 `avatars/{sub}.jpg`，回傳 `{ url: "https://boardgamematch.com.tw/avatars/{sub}" }`。
3. **D1**：前端用回傳的 URL 做 `PATCH tables/users/:id`，只存 `avatar_url: "https://boardgamematch.com.tw/avatars/xxx"`，不再存整段 base64。
4. **讀取**：其他玩家或排行榜載入 `https://boardgamematch.com.tw/avatars/xxx` → 入口 Worker 轉給 API Worker → 從 R2 讀取並回傳圖片（公開、可快取）。

---

## 4. 部署

```bash
cd cloudflare
# 1. 部署 API Worker（含 R2 綁定）
npx wrangler deploy -c wrangler.toml

# 2. 部署入口 Worker（轉發 /api、/avatars）
npx wrangler deploy -c wrangler-entry.toml
```

---

## 5. 既有使用者

- 已存成 data URL 的舊頭貼仍可正常顯示（`<img src="data:...">` 照樣能用）。
- 下次在個人頁**重新儲存簡介或換頭貼**時，若選的是自訂圖片（data URL），會先上傳到 R2，之後 D1 就會變成存新 URL。

若要批次把舊 data URL 搬上 R2，需要另寫腳本：讀出每個 user 的 `avatar_url`，若為 data URL 則上傳到 R2 再更新該筆 `avatar_url`（需後台或一次性腳本）。
