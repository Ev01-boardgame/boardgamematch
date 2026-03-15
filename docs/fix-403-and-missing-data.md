# 修復：網站 403、0 筆、帳號不見

## 原因

入口 Worker（boardgamematch-entry）轉發 `/tables/*` 到 API 時會帶上 **X-Api-Key**，值來自 `env.BOARDGAME_API_KEY`。  
若部署時本機的 `wrangler-entry.toml` 沒有這個變數，會蓋掉遠端設定，導致 **BOARDGAME_API_KEY 遺失**，API 收到請求但回傳 **403 Forbidden**，所以：

- 總覽統計變成 0
- 登入後讀不到使用者資料（帳號像不見）

## 修復步驟（約 2 分鐘）

### 1. 取得 API 金鑰

到 **Cloudflare Dashboard**：

1. **Workers & Pages** → 點 **mbti-boardgame-api**
2. **Settings** → **Variables and Secrets**
3. 找到 **API_SECRET**（或用來驗證 X-Api-Key 的那個 Secret），點 **Reveal** 或 **Edit**，複製其**值**（一整串字）

（若你本來就知道這支 API 的 X-Api-Key 金鑰，用那個也可以。）

### 2. 把金鑰設回入口 Worker

在專案目錄執行（在 `cloudflare` 資料夾裡執行也可以）：

```bash
cd cloudflare
npx wrangler secret put BOARDGAME_API_KEY -c wrangler-entry.toml
```

出現提示時，**貼上剛才複製的 API 金鑰**，按 Enter。

### 3. 重新部署入口 Worker

```bash
npx wrangler deploy -c wrangler-entry.toml
```

### 4. 驗證

重新整理 **https://boardgamematch.com.tw**（建議 Ctrl+Shift+R 強制重新整理），總覽統計應恢復，登入後帳號資料也應正常。

---

**重點**：`BOARDGAME_API_KEY` 的值必須和 **mbti-boardgame-api** 用來驗證 X-Api-Key 的那個 Secret（API_SECRET）**完全一致**，否則仍會 403。
