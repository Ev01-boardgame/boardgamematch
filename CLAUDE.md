# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概覽

「MBTI × 桌遊配對」— 桌遊玩家 MBTI 配對社群平台。純前端靜態網站（vanilla HTML/CSS/JS），無建構工具、無框架、無 npm。後端 API 由 Cloudflare Worker + D1 SQLite 提供。

- **正式站**：`https://boardgamematch.com.tw`
- **開發站**：`https://boardgamematch.mlab.host`（Herd/Nginx）、`https://boardgamematch.demo1.app`（CloudPanel）
- **API**：相對路徑 `/tables/{table_name}`，由 Nginx 反向代理至 Cloudflare Worker

## Git 工作流

- **origin**：`wake/boardgamematch`（fork）
- **upstream**：`Ev01-boardgame/boardgamematch`（客戶 repo）
- 建立 upstream PR 時，使用 `.upstream-exclude` 排除不應推送的檔案（CLAUDE.md、.gitignore、.upstream-exclude、cloudflare/wrangler.dev.toml）
- 做法：從 `upstream/main` 建 `upstream-pr/*` 分支，`git merge --squash` 後 `git reset HEAD` 排除清單中的檔案

## 環境設定

### Wrangler 設定檔

| 檔案 | 環境 | Worker 名稱 | D1 資料庫 | ALLOWED_ORIGINS |
|---|---|---|---|---|
| `cloudflare/wrangler.toml` | 正式 | `mbti-boardgame-api` | `mbti-board-game-matcher-db` | `https://boardgamematch.com.tw` |
| `cloudflare/wrangler.dev.toml` | 開發 | `mbti-boardgame-api-dev` | `boardgame-dev-db` | `mlab.host`, `demo1.app` |

- `wrangler.dev.toml` 不進 git（在 `.upstream-exclude` 和 `.gitignore` 中）
- `API_SECRET` 透過 `wrangler secret put` 設定，勿寫入設定檔
- 部署：`npx wrangler deploy`（正式）/ `npx wrangler deploy -c wrangler.dev.toml`（開發）

## 架構

### API 層（Cloudflare Worker）

`cloudflare/worker.js` — 完整 CRUD REST API，對接 Cloudflare D1：
- `GET /tables/{table}` — 列表（支援 page, limit, search, sort）
- `GET /tables/{table}/{id}` — 單筆
- `POST /tables/{table}` — 新增
- `PUT /tables/{table}/{id}` — 完整更新
- `DELETE /tables/{table}/{id}` — 刪除
- **PATCH 不可用**（405）— 一律使用 `safePatch()`

### API 安全機制（三層驗證）

| 層級 | 驗證方式 | 適用範圍 |
|---|---|---|
| public | API Secret（Nginx 注入 `X-Api-Key` header） | GET 公開表 |
| auth | API Secret + Google JWT | POST/PUT/DELETE 一般表 |
| admin | API Secret + JWT + `admin_whitelist` 比對 | 敏感表（admin_whitelist 等） |

- JWT 驗證：Worker 從 Google JWKS 端點取得公鑰，驗證 `Authorization: Bearer <token>`
- CORS：僅允許 `ALLOWED_ORIGINS` 中的網域

### safePatch — 最關鍵的更新模式

因 API 不支援 PATCH，所有部分更新必須走 `safePatch()`（定義於 `public/js/app.js:136`）：

```
1. GET 取回完整資料
2. 移除系統欄位（gs_*, _rid, created_at, updated_at 等）
3. 合併 patchData
4. 序列化 array/object 為 JSON 字串
5. PUT 送出合併後的資料
```

**禁止直接使用 `fetch(url, { method: 'PATCH' })`**。PUT 不能送不存在於 D1 schema 的欄位，否則 500。

### 前端 JS 模組（全域物件，非 ES Module）

| 檔案 | 全域物件 | 職責 |
|---|---|---|
| `js/app.js` | `window.GameMBTI` | 核心：MBTI 資料、使用者 CRUD、safePatch、成就系統、遊戲化（XP/等級） |
| `js/google-auth.js` | `window.GoogleAuth` | Google OAuth 登入/登出、使用者建立/更新 |
| `js/admin-auth.js` | `window.AdminAuth` | 管理員白名單驗證、admin 頁面存取控制 |
| `js/game-names.js` | `window.GameNames` | 桌遊多語言名稱對照（中/英/日）、封面圖片、LocalStorage 快取 |
| `js/gamification.js` | （直接函式） | XP 規則、等級計算、每日任務 |
| `js/nickname-manager.js` | `window.NicknameManager` | 隨機暱稱生成、暱稱驗證與設定彈窗 |
| `js/write-guard.js` | `window.WriteGuard` | 寫入防護層（目前未被任何頁面載入） |
| `js/show-admin-link.js` | `window.AdminLinkCache` | 前台自動檢查管理員身份並在 navbar 顯示後台連結 |

### 資料表（D1 SQLite）

主要表：`users`, `user_stats`, `game_database`, `game_aliases`, `game_votes`, `user_collections`, `achievements`, `quiz_attempts`, `daily_quests`, `site_stats`, `admin_whitelist`

陣列欄位（如 `liked_games`, `unlocked_badges`）存為 JSON 字串。讀取後需用 `JSON.parse()` 還原，寫入前需 `JSON.stringify()`。safePatch 已自動處理序列化。

## 目錄結構

```
boardgamematch/
├── public/          # 網頁根目錄（HTML/CSS/JS），由 Nginx 提供靜態檔案
├── cloudflare/      # Cloudflare Worker 相關（不可放在 public/ 下）
│   ├── worker.js
│   ├── schema.sql
│   ├── wrangler.toml
│   └── wrangler.dev.toml  (不進 git)
├── backups/         # 歷史版本備份（帶日期標籤）
├── .upstream-exclude  # upstream PR 排除清單
└── .gitignore
```

## 開發注意事項

- 沒有建構步驟，直接編輯 `public/` 下的 HTML/CSS/JS
- 所有頁面透過 `<script>` 標籤載入 JS，依賴順序重要（app.js 須在其他模組前載入）
- API 呼叫使用相對路徑 `tables/...`，Nginx 反向代理至 Worker 並注入 `X-Api-Key`
- `backups/` 保存歷史版本備份，帶日期標籤（如 `*.20260303-PERFECT.bak`）
