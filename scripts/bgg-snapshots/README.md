# BGG browse 頁快照

此資料夾保存從 BoardGameGeek **官方 browse 頁**匯出的連結清單（markdown 格式），用來產生站內的**完整主題／機制表**。

- `categories.md` — <https://boardgamegeek.com/browse/boardgamecategory>
- `mechanics.md` — <https://boardgamegeek.com/browse/boardgamemechanic>

## 更新流程

1. 在瀏覽器開啟上述網址，將頁面上所有 `[名稱](https://boardgamegeek.com/boardgamecategory/…)`／`boardgamemechanic` 連結複製到對應 `.md`（或整頁另存後自行整理成一行一連結）。
2. 在專案根目錄執行：
   ```bash
   node scripts/build-bgg-taxonomy.mjs
   ```
3. 會寫入 `public/data/bgg-taxonomy.json`，參考頁 `admin-bgg-axis-reference.html` 會讀取此檔。

**說明：** BGG 對自動請求有 Cloudflare 保護，因此不適合在瀏覽器或 CI 即時抓整頁；以快照 + 腳本產生 JSON 較穩定。
