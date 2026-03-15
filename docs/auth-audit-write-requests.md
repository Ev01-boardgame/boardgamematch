# 寫入請求（POST/PUT/PATCH/DELETE）認證檢查清單

後端對 `tables/*` 的寫入要求帶 `Authorization: Bearer <google_id_token>`，否則回 401。以下為各頁/模組的檢查結果。

---

## 一、已帶認證（無需改動）

| 檔案 | 說明 |
|------|------|
| **public/admin-collections.html** | 已用 `authHeaders()` 帶 JWT（儲存、同步 stats、啟用/停用、刪除） |
| **public/admin-whitelist-and-badge-report.html** | 已用 `authHeaders()`（PATCH/DELETE 白名單、POST 新增、PATCH user_stats） |
| **public/admin-community.html** | 載入 app.js，`getAuthHeaders()` + `safePatch` 帶 token（POST/PUT/DELETE community_links） |
| **public/admin-db-migrate.html** | 請求前注入 `Authorization: Bearer ` + token |
| **public/index.html** | 建立使用者時用 `getAuthHeaders()`（POST users） |
| **public/profile.html** | `safePatch` 內建帶 token；game_votes POST 用 `getAuthHeaders()`；頭貼上傳用 Bearer token |
| **public/recommend.html** | 評分/想玩等寫入用 `getAuthHeaders()` |
| **public/quiz.html** | 作答送出用 `getAuthHeaders()`（POST quiz_attempts 等） |
| **public/personality-test.html** | 寫入用 `getAuthHeaders()` |
| **public/player.html** | 寫入用 `getAuthHeaders()` |
| **public/random-recommend.html** | 用 `getAuthHeaders()` |
| **public/js/app.js** | `safePatch` 內建 `getAuthHeaders(headers)`；`createUser`/`createUserStats` POST 用 `getAuthHeaders()`；**但** 下列幾處寫入**未**帶 auth，見「需要改」 |

---

## 二、需要改（寫入未帶認證）

### 後台 admin 頁（寫入皆需帶 JWT）

| 檔案 | 缺少認證的請求 | 建議作法 |
|------|----------------|----------|
| **public/admin-games.html** | site_stats PATCH/POST、game_database PUT/POST/DELETE、users PATCH、game_database DELETE（多處） | 頁面已載 app.js → 新增或使用 `getAuthHeaders()`，所有寫入 fetch 的 `headers` 改為 `getAuthHeaders()` 或 `{ ...getAuthHeaders(), ... }` |
| **public/admin-quiz.html** | quiz_collections PATCH/POST/DELETE、quiz_questions PATCH/POST/DELETE（多處） | 已載 app.js → 同上，寫入時帶 `getAuthHeaders()` |
| **public/admin-game-aliases.html** | users PATCH、game_aliases PUT/POST/DELETE（多處） | **未載 app.js** → 自訂 `authHeaders()`（從 `localStorage.getItem('google_id_token')` 組 Bearer），或改為載入 app.js 後用 `getAuthHeaders()` |
| **public/admin-merge-games.html** | users PUT、game_votes PUT、game_collections PUT、game_aliases PUT（多處） | **未載 app.js** → 同上，自訂 `authHeaders()` 或載 app.js |
| **public/admin-badges.html** | user_stats PATCH、tester/influencer 白名單 POST/PATCH/DELETE、achievements PUT/POST/DELETE、user_stats PATCH（多處） | 已載 app.js → 所有寫入改為帶 `getAuthHeaders()` |
| **public/admin-add-games.html** | game_database POST（新增遊戲） | 已載 app.js → 該 fetch 加上 `headers: getAuthHeaders()` |
| **public/admin-game-db-editor.html** | game_database POST、PUT | **只載 admin-auth.js** → 自訂 `authHeaders()` 或載 app.js 後用 `getAuthHeaders()` |

### 玩家端

| 檔案 | 缺少認證的請求 | 建議作法 |
|------|----------------|----------|
| **public/my-collections.html** | 刪除清單：`fetch(..., { method: 'DELETE' })` 無 headers | 已載 app.js → 改為 `headers: getAuthHeaders()`。更新清單用 `safePatch`（app.js 會帶 token）已正確。 |
| **public/js/app.js** | `deleteUser`: DELETE 無 headers | 改為 `headers: getAuthHeaders()` |
| **public/js/app.js** | 清除重複 user_stats 時：`fetch(..., { method: 'DELETE' })` 無 headers | 改為 `headers: getAuthHeaders()` |
| **public/js/app.js** | 清除重複 achievements 時：`fetch(..., { method: 'DELETE' })` 無 headers | 改為 `headers: getAuthHeaders()` |
| **public/js/nickname-manager.js** | `updateUserNickname`: PUT users 僅 `Content-Type`，無 Authorization | 改為從 `localStorage.getItem('google_id_token')` 帶 `Authorization: Bearer `，或若頁面有 `getAuthHeaders` 則用 `getAuthHeaders()` |

### 備註

- **edit-games.html**：透過 `GameMBTI.updateUser()`（app.js），內部用 `safePatch`，已有帶 token，無需改。
- **edit-games-drag.html**：載 app.js，儲存時呼叫 `safePatch(tables/users/...)`，app.js 的 `safePatch` 會帶 token，無需改。
- **explore.html**：只有 GET users，無寫入，無需改。

---

## 三、總結

- **已正確帶認證**：admin-collections、admin-whitelist-and-badge-report、admin-community、admin-db-migrate、index、profile、recommend、quiz、personality-test、player、random-recommend；以及 app.js 內大部分寫入（safePatch、createUser、createUserStats、部分 POST）。
- **需要改**：  
  - 後台：admin-games、admin-quiz、admin-game-aliases、admin-merge-games、admin-badges、admin-add-games、admin-game-db-editor（共 7 個檔案）。  
  - 玩家端 / 共用 JS：my-collections（DELETE）、app.js（deleteUser、user_stats DELETE、achievements DELETE）、nickname-manager.js（PUT users）（共 3 個檔案／模組）。

確認無誤後可依上表逐項加上 `getAuthHeaders()` 或自訂 `authHeaders()`。
