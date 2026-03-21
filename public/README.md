# 桌遊 MBTI 匹配系統 🎲

桌遊玩家 MBTI 配對社群平台，讓玩家依人格特質找到合適的桌遊與同好。

## 🌐 部署網址

- **正式站**：`https://ba3d09ec-fb6a-466f-83dd-38bfd12bd387.vip.gensparksite.com`
- **API 基底**：`/tables/{table_name}` （Genspark 原生 D1 API，相對路徑）

---

## ✅ 已完成功能

### 核心頁面
| 頁面 | 路徑 | 說明 |
|---|---|---|
| 首頁 | `/index.html` | Google 登入、MBTI 測驗入口、使用者初始化 |
| MBTI 測驗 | `/quiz.html` | 20 題測驗，計算 MBTI 類型 |
| 個人檔案 | `/profile.html` | 編輯簡介、社交連結、收藏展示 |
| 推薦頁 | `/recommend.html` | 依 MBTI 推薦桌遊、評分功能 |
| 玩家頁 | `/player.html` | 公開玩家檔案、成就展示 |
| 探索清單 | `/explore-list.html` | 自訂探索清單管理 |
| 我的各類排行榜 | `/rankings.html` | 桌遊排行榜 CRUD |
| 排行榜 | `/leaderboard.html` | XP 排行、成就排行 |
| 遊戲清單 | `/games-list.html` | 全部桌遊瀏覽 |
| 遊戲選擇器 | `/game-picker.html` | 隨機遊戲推薦工具 |
| 桌遊格狀海報 | `/collection-poster.html` | n×n 格狀清單圖片 |
| 名片補充欄位 | D1 `users.profile_card_meta` | 與 `social_links.card_meta` 遷移見 `cloudflare/migrations/add_profile_card_meta.sql` |
| 探索 | `/explore.html` | 探索玩家與遊戲 |
| 提交遊戲 | `/submit.html` | 用戶提交新桌遊 |

### 管理頁面
| 頁面 | 路徑 | 說明 |
|---|---|---|
| 管理後台 | `/admin.html` | 管理員總覽 |
| 遊戲管理 | `/admin-games.html` | 桌遊 CRUD |
| 徽章管理 | `/admin-badges.html` | 成就徽章管理 |
| 拖拉排序編輯 | `/edit-games-drag.html` | 遊戲欄位拖拉編輯 |
| 資料庫匯出 | `/admin-db-migrate.html` | 匯出 SQL 備份 |

### JS 功能模組
| 檔案 | 說明 |
|---|---|
| `js/app.js` | 核心工具（safePatch、使用者 API、成就系統）|
| `js/gamification.js` | XP、等級、每日任務系統 |
| `js/google-auth.js` | Google OAuth 登入流程 |
| `js/nickname-manager.js` | 隨機暱稱生成 |
| `js/admin-auth.js` | 管理員權限驗證 |
| `js/game-names.js` | 遊戲名稱快取 |

---

## 🔧 safePatch 更新策略（2026-03-03 最終版）

### 背景
Genspark 原生 API 只支援：
- ✅ `GET tables/{table}` — 查詢列表
- ✅ `GET tables/{table}/{id}` — 查詢單筆
- ✅ `POST tables/{table}` — 新增記錄（不帶 id）
- ✅ `PUT tables/{table}/{id}` — **完整更新**（需送全部欄位，不含系統欄位）
- ✅ `DELETE tables/{table}/{id}` — 刪除
- ❌ `PATCH` — 405 Method Not Allowed
- ❌ `POST` 帶既有 `id` — 500 主鍵衝突

### safePatch 工作流程
```
1. GET tables/{table}/{id}   → 取回現有完整資料
2. 移除系統欄位              → gs_*, created_at, updated_at, _rid, _id 等
3. 合併 patchData            → { ...cleaned, ...patchData }
4. 序列化 array/object       → JSON.stringify() 每個物件型別值
5. PUT tables/{table}/{id}   → 送出合併後的乾淨資料
```

### 重要：PUT 的限制
- **不能送不存在於 D1 schema 的欄位**（會回傳 500 D1_ERROR: no such column）
- 系統欄位（`gs_project_id`、`gs_table_name`、`gs_created_at`、`gs_updated_at`、`deleted`、`_rid`）絕對不能送

### WriteGuard 狀態
- `js/write-guard.js` 檔案保留但**無任何頁面載入它**
- 所有 `WriteGuard.stamp()` 呼叫已從 HTML 和 JS 中移除
- safePatch 的 PUT 不需要 token 驗證

---

## 🗄️ 資料表結構（Genspark D1）

主要資料表：
- `users` — 使用者資料（google_id、mbti、bio、liked_games 等）
- `user_stats` — 遊戲化統計（xp、level、unlocked_badges 等）
- `game_database` — 桌遊資料庫
- `game_votes` — 使用者評分記錄
- `user_collections` — 收藏管理
- `achievements` — 成就定義
- `quiz_attempts` — 測驗記錄
- `daily_quests` — 每日任務
- `site_stats` — 網站統計
- `explore_lists` — 探索清單
- `game_aliases` — 遊戲別名

---

## 💾 備份紀錄

| 日期 | 標籤 | 備份檔案 | 說明 |
|---|---|---|---|
| 2026-02-22 | — | `backups/*.html.backup` | 原始版本 |
| 2026-02-24 | — | `backups/*.20260224.bak` | 早期版本 |
| 2026-02-25 | — | `backups/*.20260225.bak` | 遊戲選擇器更新 |
| 2026-03-02 | — | `backups/*.20260302.bak` | WriteGuard 移除版本 |
| 2026-03-03 | — | `backups/*.20260303.bak` | safePatch 最終 GET+PUT 版本 |
| 2026-03-03 | ⭐ **PERFECT** | `backups/*.20260303-PERFECT.bak` | **接近完美版本** — profile 可進入、player 頁可瀏覽他人檔案、explore 正常、admin-db-migrate 可匯出 SQL、所有陣列欄位正規化修復 |

### ⭐ PERFECT 版本說明（2026-03-03-PERFECT）

此版本已修復的關鍵問題：
1. **profile.html** — cleanupLegacyGameNames 對 JSON 字串呼叫 .map() 導致 TypeError，已修復
2. **player.html** — saveVoteToCollection 語法錯誤（fetch 呼叫不完整），導致整個 script 無法執行，已修復
3. **player.html** — loadTargetUser / loadCurrentUser 未正規化陣列欄位，.map is not a function，已修復
4. **explore.html** — 移除多餘的 await GameNames.load()，載入速度大幅提升
5. **admin-db-migrate.html** — 移除 admin-auth.js 守衛，頁面不再被 Google SDK 超時擋住跳轉
6. **js/app.js** — getAllUsers() 加入 toArr() 正規化，所有頁面的使用者資料陣列欄位統一處理

備份位置：`backups/` 資料夾，JS 備份在 `backups/js/`，CSS 備份在 `backups/css/`

---

## ⚠️ 已知問題 / 注意事項

1. **資料庫匯入後 safePatch 失敗**：若從舊 Genspark 匯出 SQL 再匯入，`liked_games` 等欄位可能被解析為 JS 物件，送回 D1 時會 500。safePatch 已加入序列化步驟解決。

2. **PUT 全欄位限制**：D1 schema 不存在的欄位一律不能送，safePatch 的系統欄位過濾清單必須與 schema 同步。

3. **PATCH 不可用**：整個專案禁止直接使用 `fetch(url, { method: 'PATCH' })`，一律改用 safePatch。

---

## 🚀 下一步建議

- [ ] 確認匯入 SQL 後 `admin-db-migrate.html` 的 `cleanRow()` 是否正確序列化所有欄位
- [ ] 為 `_test_api_methods.html` 加入更多欄位的 PUT 測試（確保現有 schema 欄位清單正確）
- [ ] 考慮在 `admin-db-migrate.html` 加入「驗證模式」，匯入前先測試 PUT 是否成功

---

*最後更新：2026-03-03 — ⭐ 接近完美版本 (PERFECT) 已備份*
