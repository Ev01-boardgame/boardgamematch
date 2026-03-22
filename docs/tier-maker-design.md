# Tier Maker（V1 架構延伸）— 名詞與規格釐清

> **實作與維護**：請以 `public/tier-maker.html` 為**唯一來源**（膠囊 + 待分區 + Tier + 站內導覽／頁首）。  
> `demo-tier-maker-v1-image.html` 若仍存在，僅作舊離線備份參考，**可刪除**，不影響正式站。  
> 對齊 `collection-poster.html` 時，請分兩層理解，**不要**把「海報背景」與「單格封面怎麼塞進格子」混在一起。

---

## 一、兩個不同層級的「背景／顯示」

### A. Tier／海報「整張圖」的背景（collection-poster 裡的 🌈 背景色）

- **是什麼**：最後匯出 PNG 時，**整塊畫布**（`#export-root` / `poster-root`）後面的顏色或效果。
- **典型用途**：讓長條 Tier 圖在社群上好看、與品牌色一致。
- **不是什麼**：**不是**某一格遊戲封面裡面的底色（除非我們刻意做成同一塊—但語意上仍應分開設定）。

### B. 單一遊戲「封面圖在格子裡怎麼顯示」（collection-poster 的「封面圖顯示方式」）

因 BGG `image_url` **長寬比不一**，同一個固定格子（例如 72×72）必須決定：

| 模式 | 說明 |
|------|------|
| **保留比例＋模糊底** (`contain-blur`) | 前景 `object-fit: contain`；背後用同一張圖放大+模糊當襯底 |
| **保留比例＋黑底** (`contain-black`) | contain，上下或左右留白填黑 |
| **保留比例＋白底** (`contain-white`) | contain，留白填白 |
| **填滿裁切** (`cover`) | `object-fit: cover`，可能裁掉邊；每格 ⚙ 可選置中／靠上／下／左／右（`object-position`） |

另：**遊戲名稱**在格內可 **一直顯示** / **不顯示**（overlay 條），與上面「顯示方式」是獨立選項。

---

## 二、「全域預設」vs「每格自訂」— 白話說明

| 名詞 | 意思 |
|------|------|
| **全域預設** | 使用者**還沒**針對某一格改過時，新加入的遊戲封面一律用這組（例如預設 `contain-blur` + 名稱一直顯示）。省得每個都要調。 |
| **每格自訂** | 使用者**點某一格封面**，只改**那一格**的 `imgFit` / 是否顯示名稱；其他格維持各自設定或繼續跟全域預設。 |

**不衝突**：全域 =「預設值」；每格 =「覆寫」。  
實作上建議每格存 `imgFit`、`showName`；若某格為 `null` 則 fallback 到全域 `defaultImgFit`、`defaultShowName`。

---

## 三、與目前離線 V1 的差異（需更正之處）

- 目前 V1 把「漸層／🌈」當成**無真實盒圖時的 fallback 封面**，語意上較接近 poster 的 **無圖 fallback**，不是「整張 Tier 圖的背景」。
- 目標調整方向：
  1. **整張 Tier 匯出區**：獨立一區「**Tier 背景**」（純色／漸層／模糊大圖等—對齊 poster 的 `cfg.bgType` / `bgColor` 概念）。
  2. **有 BGG 封面時**：格子內用 **imgFit** + **名稱顯示** 四選項 + 二選項。
  3. **無封面／離線**：可保留現有漸層 fallback 當「假封面」。

---

## 四、匯出範圍

- **待分區**：**不**畫進最終 PNG（維持與現行一致：`#export-root` 僅含 Tier 列）。

---

## 五、用 D1／現有 API 抓真封面做測試

Worker 已暴露 `game_database` 讀取（與 `edit-games-drag.html` 相同 base：`tables/...`）。

**搜尋（適合膠囊 autocomplete）：**

```http
GET tables/game_database?search={關鍵字}&limit=20&page=1
```

回傳 JSON 內 `data[]` 含 `name_zh`、`name_en`、`image_url`、`bgg_id`、`id` 等。

**隨機抽一批（快速測尺寸／載入）：**

```http
GET tables/game_database?random=12
```

`random` 上限 50（見 `cloudflare/worker.js`）。

**單筆 by id：**

```http
GET tables/game_database/{id}
```

前端測試時：選一筆後用 `image_url` 當 `<img src>`；若遇 CORS，可沿用 `collection-poster` 的 weserv 代理或 base64 流程（匯出時）。

---

## 六、建議的下一步實作順序（討論用）

1. **資料**：膠囊改為連線時走 `search=`，選一筆後建立「真封面」tile（存 `gameId` / `image_url` / 顯示名）。
2. **整張背景**：`#export-root` 加上可選 Tier 背景（對齊 poster 的 🌈 區塊語意）。
3. **格子**：每格 DOM 結構對齊 poster 的 `imgFit` 分支；**點格**開小面板改該格的 fit + 名稱顯示。
4. **預設**：面板頂部維持「全域預設」，新格繼承；已改的格不隨全域變更（或提供「一鍵套用全域到全部」）。

此文件僅釐清與對齊用；實作以 `public/tier-maker.html` 為主幹迭代。

---

## 七、實作狀態（`public/tier-maker.html`）

- [x] Tier 排名預覽：多組**風格預設**（6 階 S–F／優戊；5 階預設最後一階灰底）；**格子間距／封面邊長**（CSS 變數）；點**左欄**編輯／刪除，**整列拖放**換序；**＋ 新增階層**；本機圖＝**檔名**；⚙ **覆寫顯示名稱**；匯出 PNG 前**等圖載入**並 **onclone** 強化封面 object-fit（對齊 collection-poster 用 Canvas 自繪的穩定度思路）
- [x] D1：`tables/game_database?search=` 膠囊搜尋（同 edit-games-drag）
- [x] Tier 整張匯出區背景（色盤 + 預設漸層 chip），與單格封面分開
- [x] 全域預設：`imgFit`、`遊戲名稱顯示`
- [x] 每格 ⚙：真實封面可單獨改 `imgFit` + 名稱；`cover` 時可加 `coverAlign`（置中／靠邊）；假封面可改「名稱條」開關
- [x] 圖片網址經 `images.weserv.nl` 代理以利 html2canvas
- [x] 待分區在 `#export-root` 外，不匯出
